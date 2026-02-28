// F-16 Weekly Digest 생성 모듈
// 토요일 브리핑에 포함되는 주간 요약 섹션 담당
// AC3: 이번 주 좋아요 Top 3, 미완독 리마인더, 토론토 주간 날씨, AI 한줄 코멘트

// ─── 인터페이스 ──────────────────────────────────────────────────────────────

/** 이번 주 좋아요 아이템 (user_interactions 기반) */
export interface LikedItem {
  title: string;
  source_url: string;
  channel: string;
  like_count: number;
}

/** 미완독 리마인더 아이템 (저장했으나 읽지 않은 아이템) */
export interface UnreadReminder {
  title: string;
  source_url: string;
  saved_at: string; // YYYY-MM-DD
}

/** Weekly Digest 섹션 생성에 필요한 데이터 */
export interface WeeklyDigestData {
  /** 이번 주 좋아요 Top 3 */
  topLikedItems: LikedItem[];
  /** 미완독 리마인더 */
  unreadReminders: UnreadReminder[];
  /** 토론토 주간 날씨 요약 */
  weeklyWeatherSummary?: string;
  /** AI 한줄 코멘트 */
  aiComment?: string;
}

// ─── formatWeeklyDigest ──────────────────────────────────────────────────────

/**
 * Weekly Digest 섹션 HTML 문자열 생성 (F-16 AC3)
 * 토요일 브리핑 메시지 하단에 append 용도
 *
 * 포함 섹션:
 * - 이번 주 좋아요 Top 3
 * - 미완독 리마인더
 * - 토론토 주간 날씨
 * - AI 한줄 코멘트
 */
export function formatWeeklyDigest(data: WeeklyDigestData): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('📋 <b>Weekly Digest</b>');

  // ─ 이번 주 좋아요 Top 3 ───────────────────────────────────────────────────
  if (data.topLikedItems.length > 0) {
    lines.push('');
    lines.push('👍 <b>이번 주 좋아요 Top 3</b>');

    const top3 = data.topLikedItems.slice(0, 3);
    top3.forEach((item, idx) => {
      lines.push(
        `${idx + 1}. <a href="${item.source_url}">${item.title}</a>`,
      );
    });
  }

  // ─ 미완독 리마인더 ────────────────────────────────────────────────────────
  if (data.unreadReminders.length > 0) {
    lines.push('');
    lines.push('🔖 <b>미완독 리마인더</b>');

    for (const reminder of data.unreadReminders) {
      lines.push(
        `• <a href="${reminder.source_url}">${reminder.title}</a> (저장일: ${reminder.saved_at})`,
      );
    }
  }

  // ─ 토론토 주간 날씨 ───────────────────────────────────────────────────────
  if (data.weeklyWeatherSummary) {
    lines.push('');
    lines.push(`🍁 ${data.weeklyWeatherSummary}`);
  }

  // ─ AI 한줄 코멘트 ─────────────────────────────────────────────────────────
  if (data.aiComment) {
    lines.push('');
    lines.push(`💬 ${data.aiComment}`);
  }

  return lines.join('\n');
}

// ─── generateWeeklyDigest ────────────────────────────────────────────────────

/**
 * Supabase에서 Weekly Digest 데이터 조회 + AI 코멘트 생성 (F-16 AC3)
 * send-briefing route에서 호출 (토요일만)
 *
 * 실제 DB 연결이 필요하므로 Supabase 클라이언트를 외부에서 주입받음
 * 각 조회 실패는 독립적으로 처리 (채널별 독립 원칙)
 */
export async function generateWeeklyDigest(
  supabase: SupabaseClientLike,
  generateAiComment: (topTopics: string[]) => Promise<string>,
): Promise<WeeklyDigestData> {
  // KST 기준 이번 주 월요일 00:00 계산
  const now = new Date();
  const kstDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const kstDate = new Date(`${kstDateStr}T00:00:00+09:00`);
  const dayOfWeek = kstDate.getDay(); // 0:일, 6:토
  // 월요일(1)을 기준으로 이번 주 시작일 계산
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(kstDate.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
  const weekStartIso = weekStart.toISOString();

  // ─ 이번 주 좋아요 Top 3 조회 ───────────────────────────────────────────────
  let topLikedItems: LikedItem[] = [];

  /** 좋아요 조회 행 타입 */
  interface LikedRow {
    content_id: string;
    content_items: { title: string; source_url: string; channel: string } | null;
  }

  try {
    const result = await supabase
      .from('user_interactions')
      .select('content_id, content_items(title, source_url, channel)')
      .eq('action', 'like')
      .gte('created_at', weekStartIso);

    const likedRows = (result.data ?? []) as LikedRow[];

    if (likedRows.length > 0) {
      // content_id 기준 집계
      const countMap = new Map<string, { item: LikedItem; count: number }>();

      for (const row of likedRows) {
        const contentItem = row.content_items;
        if (!contentItem) continue;

        const existing = countMap.get(row.content_id);
        if (existing) {
          existing.count++;
        } else {
          countMap.set(row.content_id, {
            item: {
              title: contentItem.title,
              source_url: contentItem.source_url,
              channel: contentItem.channel,
              like_count: 1,
            },
            count: 1,
          });
        }
      }

      // like_count 내림차순 정렬 후 Top 3
      topLikedItems = Array.from(countMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((v) => ({ ...v.item, like_count: v.count }));
    }
  } catch {
    // 좋아요 조회 실패 시 빈 배열로 진행
    topLikedItems = [];
  }

  // ─ 미완독 리마인더 조회 (F-19 AC5: saved_items 테이블 기반) ──────────────────
  let unreadReminders: UnreadReminder[] = [];

  /** 미완독 조회 행 타입 (saved_items + content_items 조인) */
  interface SavedItemRow {
    content_id: string;
    saved_at: string;
    status: string;
    content_items: { title: string; source_url: string } | null;
  }

  try {
    const savedResult = await supabase
      .from('saved_items')
      .select('content_id, saved_at, status, content_items(title, source_url)')
      .in('status', ['saved', 'reading'])
      .order('saved_at', { ascending: false })
      .limit(5);

    const savedRows = (savedResult.data ?? []) as SavedItemRow[];

    if (savedRows.length > 0) {
      unreadReminders = savedRows
        .map((row) => {
          const contentItem = row.content_items;
          if (!contentItem) return null;

          const savedAt = new Date(row.saved_at)
            .toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

          return {
            title: contentItem.title,
            source_url: contentItem.source_url,
            saved_at: savedAt,
          };
        })
        .filter((item): item is UnreadReminder => item !== null);
    }
  } catch {
    // 미완독 조회 실패 시 빈 배열로 진행
    unreadReminders = [];
  }

  // ─ AI 한줄 코멘트 생성 ─────────────────────────────────────────────────────
  let aiComment: string | undefined;
  try {
    // 좋아요 Top 3의 채널을 토픽으로 전달
    const topTopics = topLikedItems.map((i) => `${i.channel}: ${i.title}`);
    if (topTopics.length > 0) {
      aiComment = await generateAiComment(topTopics);
    }
  } catch {
    // AI 코멘트 생성 실패 시 undefined로 진행
    aiComment = undefined;
  }

  return {
    topLikedItems,
    unreadReminders,
    aiComment,
  };
}

// ─── Supabase 클라이언트 타입 (의존성 역전) ─────────────────────────────────

/** weekly-digest가 사용하는 Supabase 클라이언트 최소 인터페이스 */
export interface SupabaseClientLike {
  from: (table: string) => SupabaseQueryBuilder;
}

interface SupabaseQueryBuilder extends Promise<{ data: unknown[] | null; error: unknown }> {
  select: (columns: string) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  in: (column: string, values: unknown[]) => SupabaseQueryBuilder;
  is: (column: string, value: unknown) => SupabaseQueryBuilder;
  gte: (column: string, value: unknown) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
}
