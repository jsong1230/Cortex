// GET /api/briefings/today — 오늘 브리핑 데이터 조회
// 인증: Supabase Auth 세션 (쿠키 기반)
// 참조: docs/specs/F-08-web-briefing-viewer/design.md

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { getTodayKST } from '@/lib/utils/date';

// 브리핑 JSONB items 배열의 아이템 타입
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
interface BriefingResponseItem {
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

export async function GET(_request: NextRequest): Promise<NextResponse> {
  // 1. Supabase Auth 세션 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. 오늘 날짜 (KST 기준)
  const today = getTodayKST();

  // 3. 서버 클라이언트로 브리핑 조회 (Service Role Key 사용)
  const supabase = createServerClient();

  const { data: briefing, error: briefingError } = await supabase
    .from('briefings')
    .select('id, briefing_date, items')
    .eq('briefing_date', today)
    .maybeSingle();

  if (briefingError) {
    return NextResponse.json(
      { success: false, error: '브리핑 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  // 4. 브리핑이 없으면 404
  if (!briefing) {
    return NextResponse.json(
      {
        success: false,
        error: `오늘(${today})의 브리핑이 아직 생성되지 않았습니다`,
        errorCode: 'BRIEFING_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  // 5. items JSONB에서 content_id 배열 추출 및 position 순 정렬
  const rawItems = (briefing.items as BriefingItem[]) ?? [];
  const sortedItems = [...rawItems].sort((a, b) => a.position - b.position);
  const contentIds = sortedItems.map((item) => item.content_id);

  if (contentIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        briefing_id: briefing.id,
        briefing_date: briefing.briefing_date,
        items: [],
      },
    });
  }

  // 6. content_items 일괄 조회 (N+1 방지)
  const { data: contentItems, error: contentError } = await supabase
    .from('content_items')
    .select('id, title, summary_ai, source, source_url, tags')
    .in('id', contentIds);

  if (contentError) {
    return NextResponse.json(
      { success: false, error: '콘텐츠 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  // 7. user_interactions 일괄 조회 (N+1 방지)
  const { data: interactions, error: interactionError } = await supabase
    .from('user_interactions')
    .select('content_id, interaction')
    .in('content_id', contentIds);

  if (interactionError) {
    return NextResponse.json(
      { success: false, error: '반응 정보 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  // 8. content_items Map 구성
  const contentMap = new Map<string, ContentItem>(
    (contentItems ?? []).map((item: ContentItem) => [item.id, item])
  );

  // 9. user_interactions Map 구성 (content_id → 가장 최근 interaction)
  // SELECT에서 이미 최신순으로 오므로, 첫 번째 항목만 사용
  const interactionMap = new Map<string, string>();
  for (const interaction of interactions ?? []) {
    const typed = interaction as UserInteraction;
    if (!interactionMap.has(typed.content_id)) {
      interactionMap.set(typed.content_id, typed.interaction);
    }
  }

  // 10. 응답 조립
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

  return NextResponse.json({
    success: true,
    data: {
      briefing_id: briefing.id as string,
      briefing_date: briefing.briefing_date as string,
      items: responseItems,
    },
  });
}
