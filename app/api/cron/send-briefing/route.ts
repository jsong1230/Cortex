// [Cron] 텔레그램 브리핑 발송 (F-16: 평일/주말 분기, F-17: 피로도 방지)
// - 평일(월~금): UTC 22:00 (KST 07:00), 7~8개 아이템, 제목+1줄 요약+스코어
// - 주말(토~일): UTC 00:00 (KST 09:00), 5개 엄선, 제목+3줄 요약+"왜 중요한가"
// - 토요일: Weekly Digest 섹션 추가
// - 멀티유저: telegram_users 등록 유저 각자 개인화 브리핑 발송
// F-06 설계서: docs/specs/F-06-telegram-briefing/design.md
// F-17 설계서: docs/specs/F-17-fatigue-prevention/design.md

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  isWeekend,
  selectBriefingItems,
  formatWeekdayBriefing,
  formatWeekendBriefing,
  sendBriefing,
  type BriefingItem,
  type BriefingMode,
} from '@/lib/telegram';
import {
  formatWeeklyDigest,
  type WeeklyDigestData,
} from '@/lib/weekly-digest';
import {
  getMuteStatus,
  getChannelSettings,
  checkNoReactionStreak,
  updateItemReduction,
  detectRepeatingIssues,
  markAsFollowing,
} from '@/lib/fatigue-prevention';
import {
  getActiveKeywords,
  matchContentToKeywords,
  calculateContextScore,
  type KeywordContext,
} from '@/lib/mylifeos';
import { calculateTechScore, calculateRecencyScore } from '@/lib/scoring';
import { assertRequiredEnv } from '@/lib/utils/env';
import { getActiveUsers, type TelegramUserRecord } from '@/lib/telegram-users';

// 웹 URL (인라인 버튼에 사용)
const WEB_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cortex-briefing.vercel.app';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * KST 오늘 날짜 시작 시각 (UTC ISO 문자열 반환)
 * 예: KST 2026-02-28 00:00:00 → UTC 2026-02-27T15:00:00.000Z
 */
function getTodayKstStartIso(): string {
  const kstDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  return new Date(`${kstDateStr}T00:00:00+09:00`).toISOString();
}

/**
 * KST 오늘 날짜 문자열 (YYYY-MM-DD)
 */
function getTodayKstDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * KST 기준 오늘이 토요일인지 확인
 */
function isSaturday(): boolean {
  const kstDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const kstNoon = new Date(`${kstDateStr}T12:00:00+09:00`);
  return kstNoon.getUTCDay() === 6;
}

/** 단일 유저 브리핑 발송 결과 */
interface UserBriefingResult {
  userId: string | null;
  chatId: string;
  displayName: string;
  success: boolean;
  itemsCount: number;
  telegramSent: boolean;
  channels: Record<string, number>;
  skippedReason?: string;
  error?: string;
}

/**
 * 단일 유저에게 브리핑을 발송한다.
 * userId=null: 레거시 싱글유저 모드 (TELEGRAM_CHAT_ID 사용)
 */
async function sendBriefingToUser(params: {
  userId: string | null;
  chatId: string;
  displayName: string;
  todayKst: string;
  todayStartIso: string;
  mode: BriefingMode;
  isSaturdayBriefing: boolean;
  contentItems: BriefingItem[];
}): Promise<UserBriefingResult> {
  const { userId, chatId, displayName, todayKst, todayStartIso, mode, isSaturdayBriefing, contentItems } = params;

  const supabase = createServerClient();

  const baseResult: UserBriefingResult = {
    userId,
    chatId,
    displayName,
    success: true,
    itemsCount: 0,
    telegramSent: false,
    channels: {},
  };

  try {
    // ─── F-17 AC2: 뮤트 상태 확인 ───────────────────────────────────────
    const muteStatus = await getMuteStatus(userId);
    if (muteStatus.isMuted) {
      // eslint-disable-next-line no-console
      console.info(JSON.stringify({
        event: 'cortex_send_briefing_skipped',
        reason: '뮤트 설정됨',
        user_id: userId,
        display_name: displayName,
        date: todayKst,
        mode,
      }));
      return { ...baseResult, skippedReason: 'muted' };
    }

    // ─── F-17 AC1: 채널 설정 조회 ────────────────────────────────────────
    const channelSettings = await getChannelSettings(userId);

    // F-17 AC1: OFF 채널 아이템 제외
    const channelFilteredItems = contentItems.filter((row) => {
      const settingKey = row.channel as keyof typeof channelSettings;
      if (!(settingKey in channelSettings)) return true;
      return channelSettings[settingKey] !== false;
    });

    if (channelFilteredItems.length === 0) {
      return { ...baseResult, skippedReason: 'no_items' };
    }

    // ─── 3-1. F-23: interest_profile 로드 (유저별) ───────────────────────
    const interestProfile = new Map<string, number>();
    try {
      let profileQuery = supabase.from('interest_profile').select('topic, score');
      if (userId) {
        profileQuery = profileQuery.eq('user_id', userId);
      } else {
        profileQuery = profileQuery.is('user_id', null);
      }
      const { data: profileRows } = await profileQuery;

      if (profileRows) {
        for (const row of profileRows) {
          const topic = row.topic as string;
          const score = row.score as number;
          interestProfile.set(topic, score);
        }
      }
    } catch {
      // 프로필 로드 실패 시 빈 Map으로 진행
    }

    // ─── 3-2. F-18: My Life OS 키워드 컨텍스트 로드 ─────────────────
    let activeKeywordContexts: KeywordContext[] = [];
    try {
      activeKeywordContexts = await getActiveKeywords(supabase);
    } catch {
      // non-fatal
    }

    // ─── 3-3. F-18: 컨텍스트 점수로 score_initial 재계산 (tech 채널) ──
    const contextEnrichedItems = channelFilteredItems.map((item) => {
      if (item.channel !== 'tech' || activeKeywordContexts.length === 0) {
        return item;
      }

      const tags = item.tags ?? [];
      const contextScore = calculateContextScore(tags, activeKeywordContexts);

      if (contextScore === 0) return item;

      const interestScores = tags.map((tag) => interestProfile.get(tag) ?? 0.5);
      const interestScore = interestScores.length > 0
        ? interestScores.reduce((sum, s) => sum + s, 0) / interestScores.length
        : 0.5;

      const recencyScore = calculateRecencyScore(item.published_at);

      const newScore = calculateTechScore(
        item.score_initial,
        interestScore,
        contextScore,
        recencyScore,
      );

      return { ...item, score_initial: newScore };
    });

    // ─── 4. F-16: 모드별 아이템 선정 ──────────────────────────────────
    let selectedItems = selectBriefingItems(contextEnrichedItems, mode, interestProfile);

    // ─── F-17 AC3: 7일 무반응 시 아이템 수 자동 감소 ────────────────────
    let itemReduction = 0;
    try {
      const noReaction = await checkNoReactionStreak(userId);
      if (noReaction) {
        itemReduction = await updateItemReduction(userId);
      } else {
        const currentReductionQuery = userId
          ? supabase.from('cortex_settings').select('item_reduction').eq('user_id', userId)
          : supabase.from('cortex_settings').select('item_reduction').eq('id', 'singleton');
        const { data: settingsRow } = await currentReductionQuery.single();
        const currentReduction = (settingsRow?.item_reduction as number | null) ?? 0;
        if (currentReduction > 0) {
          const upsertData = userId
            ? { id: userId, user_id: userId, item_reduction: 0, updated_at: new Date().toISOString() }
            : { id: 'singleton', item_reduction: 0, updated_at: new Date().toISOString() };
          const conflictKey = userId ? 'user_id' : 'id';
          await supabase.from('cortex_settings').upsert(upsertData, { onConflict: conflictKey });
        }
        itemReduction = 0;
      }
    } catch {
      // 감소량 조회 실패 시 0으로 처리
    }

    if (itemReduction > 0 && selectedItems.length > itemReduction) {
      selectedItems = selectedItems.slice(0, selectedItems.length - itemReduction);
    }

    // ─── F-17 AC4: 3일 연속 반복 이슈 감지 + "계속 팔로우 중" 마킹 ─────
    try {
      let pastBriefingsQuery = supabase
        .from('briefings')
        .select('items')
        .order('briefing_date', { ascending: false })
        .limit(2);
      if (userId) {
        pastBriefingsQuery = pastBriefingsQuery.eq('user_id', userId);
      } else {
        pastBriefingsQuery = pastBriefingsQuery.is('user_id', null);
      }
      const { data: pastBriefings } = await pastBriefingsQuery;

      if (pastBriefings && pastBriefings.length >= 2) {
        const pastItemsList = pastBriefings.map((b) => {
          const rawItems = b.items as Array<{
            content_id: string;
            title: string;
            tags?: string[];
            channel: string;
            source: string;
            source_url: string;
            summary_ai?: string;
            score_initial?: number;
          }>;
          return (rawItems ?? []).map((item) => ({
            id: item.content_id,
            title: item.title ?? '',
            tags: item.tags,
            channel: item.channel,
            source: item.source,
            source_url: item.source_url,
            summary_ai: item.summary_ai ?? null,
            score_initial: item.score_initial ?? 0.5,
          } as BriefingItem));
        });

        const repeatingIds = detectRepeatingIssues(selectedItems, pastItemsList);
        if (repeatingIds.size > 0) {
          selectedItems = selectedItems.map((item) =>
            repeatingIds.has(item.id) ? markAsFollowing(item) : item,
          );
        }
      }
    } catch {
      // 반복 이슈 감지 실패 시 무시
    }

    // 채널별 카운트
    const channelCounts: Record<string, number> = {};
    for (const item of selectedItems) {
      channelCounts[item.channel] = (channelCounts[item.channel] ?? 0) + 1;
    }

    // ─── 4-1. F-18: 컨텍스트 매칭 이유 추가 (AC4) ───────────────────
    if (activeKeywordContexts.length > 0) {
      selectedItems = selectedItems.map((item) => {
        const tags = item.tags ?? [];
        const reason = matchContentToKeywords(tags, activeKeywordContexts);
        if (reason) {
          return { ...item, reason };
        }
        return item;
      });
    }

    // ─── 5. F-16: 모드별 브리핑 메시지 포매팅 ─────────────────────────
    let briefingText: string;
    if (mode === 'weekend') {
      briefingText = formatWeekendBriefing(selectedItems);
    } else {
      briefingText = formatWeekdayBriefing(selectedItems);
    }

    // ─── 5-1. F-16: 토요일 → Weekly Digest 섹션 추가 ──────────────────
    if (isSaturdayBriefing) {
      try {
        const digestData: WeeklyDigestData = {
          topLikedItems: [],
          unreadReminders: [],
          weeklyWeatherSummary: undefined,
          aiComment: undefined,
        };

        try {
          const weekStart = new Date();
          const kstStr = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
          const kst = new Date(`${kstStr}T00:00:00+09:00`);
          const kstDow = new Date(`${kstStr}T12:00:00+09:00`).getUTCDay();
          const daysFromMonday = kstDow === 0 ? 6 : kstDow - 1;
          const monday = new Date(kst.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);

          let likedQuery = supabase
            .from('user_interactions')
            .select('content_id, content_items(title, source_url, channel)')
            .eq('action', 'like')
            .gte('created_at', monday.toISOString());
          if (userId) {
            likedQuery = likedQuery.eq('user_id', userId);
          } else {
            likedQuery = likedQuery.is('user_id', null);
          }
          const { data: likedRows } = await likedQuery;

          if (likedRows && likedRows.length > 0) {
            const countMap = new Map<string, { title: string; source_url: string; channel: string; count: number }>();
            for (const row of likedRows) {
              const ci = row.content_items as unknown as { title: string; source_url: string; channel: string } | null;
              if (!ci) continue;
              const cid = row.content_id as string;
              const existing = countMap.get(cid);
              if (existing) {
                existing.count++;
              } else {
                countMap.set(cid, { title: ci.title, source_url: ci.source_url, channel: ci.channel, count: 1 });
              }
            }
            digestData.topLikedItems = Array.from(countMap.values())
              .sort((a, b) => b.count - a.count)
              .slice(0, 3)
              .map((v) => ({ title: v.title, source_url: v.source_url, channel: v.channel, like_count: v.count }));
          }
        } catch {
          // 좋아요 조회 실패 시 빈 배열 유지
        }

        briefingText += formatWeeklyDigest(digestData);
      } catch {
        // Weekly Digest 생성 실패 — non-fatal
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({
          event: 'cortex_weekly_digest_error',
          user_id: userId,
          date: todayKst,
        }));
      }
    }

    // ─── 6. 텔레그램 발송 (F-06 AC6: 실패 시 1회 재시도) ────────────────
    let telegramSent = false;
    let telegramMessageId: number | undefined;

    let lastSendError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          // 재시도 전 2초 대기 (일시적 네트워크/API 오류 대응)
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
        const result = await sendBriefing(briefingText, WEB_URL, chatId);
        telegramSent = true;
        telegramMessageId = result.messageId;
        lastSendError = null;
        break;
      } catch (sendError) {
        lastSendError = sendError instanceof Error ? sendError : new Error(String(sendError));
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify({
          event: 'cortex_send_briefing_telegram_attempt_failed',
          user_id: userId,
          display_name: displayName,
          attempt: attempt + 1,
          error: lastSendError.message,
          date: todayKst,
          mode,
        }));
      }
    }

    if (!telegramSent && lastSendError) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        event: 'cortex_send_briefing_telegram_error',
        user_id: userId,
        display_name: displayName,
        error: lastSendError.message,
        date: todayKst,
        mode,
      }));
      return { ...baseResult, success: false, channels: channelCounts, error: `텔레그램 발송 실패: ${lastSendError.message}` };
    }

    // ─── 7. briefings 테이블에 발송 기록 저장 ────────────────────────────
    const briefingRecord: Record<string, unknown> = {
      briefing_date: todayKst,
      items: selectedItems.map((item, idx) => ({
        content_id: item.id,
        position: idx + 1,
        channel: item.channel,
        title: item.title,
        source: item.source,
        source_url: item.source_url,
        summary_ai: item.summary_ai,
        score_initial: item.score_initial,
        tags: item.tags,
        is_serendipity: item.channel === 'serendipity',
      })),
      telegram_sent_at: new Date().toISOString(),
      telegram_message_id: telegramMessageId ?? null,
      mode,
      user_id: userId ?? null,
    };

    const { error: insertError } = await supabase.from('briefings').insert(briefingRecord);

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        event: 'cortex_send_briefing_insert_error',
        user_id: userId,
        error: insertError.message,
        date: todayKst,
        mode,
      }));
    }

    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      event: 'cortex_send_briefing_complete',
      user_id: userId,
      display_name: displayName,
      briefing_date: todayKst,
      items_count: selectedItems.length,
      telegram_sent: telegramSent,
      channels: channelCounts,
      mode,
      weekly_digest: isSaturdayBriefing,
      item_reduction: itemReduction,
      timestamp: new Date().toISOString(),
    }));

    return {
      ...baseResult,
      itemsCount: selectedItems.length,
      telegramSent,
      channels: channelCounts,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      event: 'cortex_send_briefing_fatal_error',
      user_id: userId,
      display_name: displayName,
      error: errMsg,
      date: params.todayKst,
      mode: params.mode,
    }));
    return { ...baseResult, success: false, error: errMsg };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── 1. 인증 ────────────────────────────────────────────────────────────
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  assertRequiredEnv();

  const todayKst = getTodayKstDate();
  const todayStartIso = getTodayKstStartIso();
  const mode: BriefingMode = isWeekend() ? 'weekend' : 'weekday';
  const isSaturdayBriefing = isSaturday();

  // ─── 2. 오늘 요약 완료 아이템 조회 (모든 유저 공유 콘텐츠 풀) ──────────
  const supabase = createServerClient();

  const { data: items, error: itemsError } = await supabase
    .from('content_items')
    .select('id, channel, source, source_url, title, summary_ai, score_initial, tags, published_at')
    .gte('collected_at', todayStartIso)
    .order('score_initial', { ascending: false });

  if (itemsError) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      event: 'cortex_send_briefing_db_error',
      error: itemsError.message,
      date: todayKst,
      mode,
    }));
    return NextResponse.json(
      { success: false, error: 'DB 조회 실패' },
      { status: 500 },
    );
  }

  // summary_ai가 null인 아이템 필터링
  const validItems = (items ?? []).filter(
    (row): row is NonNullable<typeof row> => row.summary_ai !== null,
  );

  const allContentItems: BriefingItem[] = validItems.map((row) => ({
    id: row.id as string,
    channel: row.channel as string,
    source: row.source as string,
    source_url: row.source_url as string,
    title: row.title as string,
    summary_ai: row.summary_ai as string,
    score_initial: (row.score_initial as number) ?? 0.5,
    tags: (row.tags as string[]) ?? [],
    published_at: (row.published_at as string | null) ?? null,
  }));

  if (allContentItems.length === 0) {
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      event: 'cortex_send_briefing_skipped',
      reason: '오늘 요약 완료 아이템 없음',
      date: todayKst,
      mode,
    }));
    return NextResponse.json({
      success: true,
      data: {
        briefing_date: todayKst,
        items_count: 0,
        telegram_sent: false,
        channels: {},
        mode,
      },
    });
  }

  // ─── 3. 발송 대상 유저 결정 ──────────────────────────────────────────
  const activeUsers = await getActiveUsers();

  let targets: Array<{ userId: string | null; chatId: string; displayName: string }>;

  if (activeUsers.length > 0) {
    // 등록된 유저 전원에게 발송
    targets = activeUsers.map((u) => ({
      userId: u.id,
      chatId: String(u.chat_id),
      displayName: u.first_name ?? u.username ?? `user_${u.telegram_id}`,
    }));
  } else {
    // 레거시 싱글유저 모드: TELEGRAM_CHAT_ID 사용
    const legacyChatId = process.env.TELEGRAM_CHAT_ID;
    if (!legacyChatId) {
      return NextResponse.json(
        { success: false, error: '발송 대상 없음: telegram_users 비어있고 TELEGRAM_CHAT_ID 미설정' },
        { status: 500 },
      );
    }
    targets = [{ userId: null, chatId: legacyChatId, displayName: 'legacy_user' }];
  }

  // ─── 4. 유저별 브리핑 발송 (병렬) ─────────────────────────────────────
  const results = await Promise.allSettled(
    targets.map((target) =>
      sendBriefingToUser({
        ...target,
        todayKst,
        todayStartIso,
        mode,
        isSaturdayBriefing,
        contentItems: allContentItems,
      }),
    ),
  );

  const userResults: UserBriefingResult[] = results.map((r, idx) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      userId: targets[idx]!.userId,
      chatId: targets[idx]!.chatId,
      displayName: targets[idx]!.displayName,
      success: false,
      itemsCount: 0,
      telegramSent: false,
      channels: {},
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  const successCount = userResults.filter((r) => r.success && r.telegramSent).length;
  const totalChannels: Record<string, number> = {};
  for (const r of userResults) {
    for (const [ch, cnt] of Object.entries(r.channels)) {
      totalChannels[ch] = (totalChannels[ch] ?? 0) + cnt;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      briefing_date: todayKst,
      mode,
      weekly_digest: isSaturdayBriefing,
      users_sent: successCount,
      users_total: targets.length,
      channels: totalChannels,
      results: userResults,
    },
  });
}
