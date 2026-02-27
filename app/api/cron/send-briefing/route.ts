// [Cron] 텔레그램 브리핑 발송 (F-16: 평일/주말 분기)
// - 평일(월~금): UTC 22:00 (KST 07:00), 7~8개 아이템, 제목+1줄 요약+스코어
// - 주말(토~일): UTC 00:00 (KST 09:00), 5개 엄선, 제목+3줄 요약+"왜 중요한가"
// - 토요일: Weekly Digest 섹션 추가
// F-06 설계서: docs/specs/F-06-telegram-briefing/design.md

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

// 웹 URL (인라인 버튼에 사용)
const WEB_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cortex.vercel.app';

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
  const kstDate = new Date(`${kstDateStr}T00:00:00+09:00`);
  return kstDate.getDay() === 6;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. 인증 ────────────────────────────────────────────────────────────
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const todayKst = getTodayKstDate();
  const todayStartIso = getTodayKstStartIso();

  // ─── F-16: 평일/주말 모드 감지 ──────────────────────────────────────────
  const mode: BriefingMode = isWeekend() ? 'weekend' : 'weekday';
  const isSaturdayBriefing = isSaturday();

  try {
    // ─── 2. 오늘 요약 완료 아이템 조회 ──────────────────────────────────
    const supabase = createServerClient();

    const { data: items, error: itemsError } = await supabase
      .from('content_items')
      .select('id, channel, source, source_url, title, summary_ai, score_initial, tags')
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

    // summary_ai가 null인 아이템 필터링 (JS 레벨 보완 처리)
    const validItems = (items ?? []).filter(
      (row): row is NonNullable<typeof row> => row.summary_ai !== null,
    );

    const contentItems: BriefingItem[] = validItems.map((row) => ({
      id: row.id as string,
      channel: row.channel as string,
      source: row.source as string,
      source_url: row.source_url as string,
      title: row.title as string,
      summary_ai: row.summary_ai as string,
      score_initial: (row.score_initial as number) ?? 0.5,
      tags: (row.tags as string[]) ?? [],
    }));

    // ─── 3. 아이템이 없으면 스킵 ────────────────────────────────────────
    if (contentItems.length === 0) {
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

    // ─── 4. F-16: 모드별 아이템 선정 ──────────────────────────────────
    const selectedItems = selectBriefingItems(contentItems, mode);

    // 채널별 카운트
    const channelCounts: Record<string, number> = {};
    for (const item of selectedItems) {
      channelCounts[item.channel] = (channelCounts[item.channel] ?? 0) + 1;
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
        // Weekly Digest 데이터 구성 (DB 조회 실패 시 빈 데이터로 진행)
        const digestData: WeeklyDigestData = {
          topLikedItems: [],
          unreadReminders: [],
          weeklyWeatherSummary: undefined,
          aiComment: undefined,
        };

        // 이번 주 좋아요 Top 3 조회
        try {
          const weekStart = new Date();
          const kstStr = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
          const kst = new Date(`${kstStr}T00:00:00+09:00`);
          const daysFromMonday = kst.getDay() === 0 ? 6 : kst.getDay() - 1;
          const monday = new Date(kst.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);

          const { data: likedRows } = await supabase
            .from('user_interactions')
            .select('content_id, content_items(title, source_url, channel)')
            .eq('action', 'like')
            .gte('created_at', monday.toISOString());

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
        // Weekly Digest 생성 실패 — non-fatal, 브리핑 본문만 발송
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({
          event: 'cortex_weekly_digest_error',
          date: todayKst,
        }));
      }
    }

    // ─── 6. 텔레그램 발송 (재시도 1회 포함) ──────────────────────────────
    let telegramSent = false;
    let telegramMessageId: number | undefined;

    try {
      const result = await sendBriefing(briefingText, WEB_URL);
      telegramSent = true;
      telegramMessageId = result.messageId;
    } catch (sendError) {
      const errMsg = sendError instanceof Error ? sendError.message : String(sendError);
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        event: 'cortex_send_briefing_telegram_error',
        error: errMsg,
        date: todayKst,
        mode,
      }));
      return NextResponse.json(
        {
          success: false,
          error: `텔레그램 발송 실패: ${errMsg}`,
          errorCode: 'TELEGRAM_SEND_FAILED',
        },
        { status: 500 },
      );
    }

    // ─── 7. briefings 테이블에 발송 기록 저장 ────────────────────────────
    const briefingRecord = {
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
      })),
      telegram_sent_at: new Date().toISOString(),
      telegram_message_id: telegramMessageId ?? null,
      mode, // F-16: 평일/주말 모드 기록
    };

    const { error: insertError } = await supabase
      .from('briefings')
      .insert(briefingRecord);

    if (insertError) {
      // 발송은 성공했으나 기록 실패 — non-fatal 에러로 로깅만
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        event: 'cortex_send_briefing_insert_error',
        error: insertError.message,
        date: todayKst,
        telegram_sent: telegramSent,
        mode,
      }));
    }

    // ─── 8. 구조화 로깅 ──────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      event: 'cortex_send_briefing_complete',
      briefing_date: todayKst,
      items_count: selectedItems.length,
      telegram_sent: telegramSent,
      channels: channelCounts,
      mode,
      weekly_digest: isSaturdayBriefing,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        briefing_date: todayKst,
        items_count: selectedItems.length,
        telegram_sent: telegramSent,
        channels: channelCounts,
        mode,
        weekly_digest: isSaturdayBriefing,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      event: 'cortex_send_briefing_fatal_error',
      error: errMsg,
      date: todayKst,
      mode,
    }));
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 },
    );
  }
}
