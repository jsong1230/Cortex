// 브리핑 조회 공통 로직 — today API + [date] API 공유
// 참조: docs/specs/F-10-web-briefing-history/design.md §9.1

import type { SupabaseClient } from '@supabase/supabase-js';

// briefings.items JSONB 아이템 타입
interface BriefingItem {
  content_id: string;
  position: number;
  channel: string;
  reason?: string | null;
}

// content_items 테이블 레코드 타입
interface ContentItem {
  id: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  tags: string[] | null;
}

// user_interactions 테이블 레코드 타입
interface UserInteraction {
  content_id: string;
  interaction: string;
}

// 응답 아이템 타입
export interface BriefingResponseItem {
  content_id: string;
  position: number;
  channel: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  reason: string | null;
  user_interaction: string | null;
}

// getBriefingByDate 반환 타입
export interface BriefingData {
  briefing_id: string;
  briefing_date: string;
  items: BriefingResponseItem[];
}

/**
 * 특정 날짜의 브리핑 데이터를 조회하여 BriefingData 형태로 반환한다.
 * 브리핑이 없으면 null을 반환한다.
 *
 * 3-쿼리 패턴으로 N+1을 방지한다:
 * 1) briefings 조회 (maybeSingle)
 * 2) content_items IN 조회
 * 3) user_interactions IN 조회
 */
export async function getBriefingByDate(
  supabase: SupabaseClient,
  date: string
): Promise<
  | { data: BriefingData; error: null }
  | { data: null; error: { code: 'DB_ERROR' | 'NOT_FOUND'; message: string } }
> {
  // 1. briefings 조회
  const { data: briefing, error: briefingError } = await supabase
    .from('briefings')
    .select('id, briefing_date, items')
    .eq('briefing_date', date)
    .maybeSingle();

  if (briefingError) {
    return {
      data: null,
      error: { code: 'DB_ERROR', message: '브리핑 조회 중 오류가 발생했습니다' },
    };
  }

  if (!briefing) {
    return {
      data: null,
      error: { code: 'NOT_FOUND', message: `해당 날짜(${date})의 브리핑이 존재하지 않습니다` },
    };
  }

  // 2. items JSONB에서 content_id 배열 추출 및 position 순 정렬
  const rawItems = (briefing.items as BriefingItem[]) ?? [];
  const sortedItems = [...rawItems].sort((a, b) => a.position - b.position);
  const contentIds = sortedItems.map((item) => item.content_id);

  if (contentIds.length === 0) {
    return {
      data: {
        briefing_id: briefing.id as string,
        briefing_date: briefing.briefing_date as string,
        items: [],
      },
      error: null,
    };
  }

  // 3. content_items 일괄 조회 (N+1 방지)
  const { data: contentItems, error: contentError } = await supabase
    .from('content_items')
    .select('id, title, summary_ai, source, source_url, tags')
    .in('id', contentIds);

  if (contentError) {
    return {
      data: null,
      error: { code: 'DB_ERROR', message: '콘텐츠 조회 중 오류가 발생했습니다' },
    };
  }

  // 4. user_interactions 일괄 조회 (N+1 방지)
  const { data: interactions, error: interactionError } = await supabase
    .from('user_interactions')
    .select('content_id, interaction')
    .in('content_id', contentIds);

  if (interactionError) {
    return {
      data: null,
      error: { code: 'DB_ERROR', message: '반응 정보 조회 중 오류가 발생했습니다' },
    };
  }

  // 5. content_items Map 구성
  const contentMap = new Map<string, ContentItem>(
    (contentItems ?? []).map((item: ContentItem) => [item.id, item])
  );

  // 6. user_interactions Map 구성 (content_id → 가장 최근 interaction)
  const interactionMap = new Map<string, string>();
  for (const interaction of interactions ?? []) {
    const typed = interaction as UserInteraction;
    if (!interactionMap.has(typed.content_id)) {
      interactionMap.set(typed.content_id, typed.interaction);
    }
  }

  // 7. 응답 조립
  const responseItems: BriefingResponseItem[] = sortedItems.map((briefingItem) => {
    const content = contentMap.get(briefingItem.content_id);
    const userInteraction = interactionMap.get(briefingItem.content_id) ?? null;

    return {
      content_id: briefingItem.content_id,
      position: briefingItem.position,
      channel: briefingItem.channel,
      title: content?.title ?? '',
      summary_ai: content?.summary_ai ?? null,
      source: content?.source ?? '',
      source_url: content?.source_url ?? '',
      reason: briefingItem.reason ?? null,
      user_interaction: userInteraction,
    };
  });

  return {
    data: {
      briefing_id: briefing.id as string,
      briefing_date: briefing.briefing_date as string,
      items: responseItems,
    },
    error: null,
  };
}
