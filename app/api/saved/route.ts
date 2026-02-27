// GET /api/saved — 저장(북마크)한 콘텐츠 아이템 목록 조회
// 인증: Supabase Auth 세션 (쿠키 기반)
// 참조: docs/specs/F-10-web-briefing-history/design.md §3.3

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// user_interactions 테이블 레코드 타입 (저장 interaction)
interface SavedInteraction {
  content_id: string;
  created_at: string;
}

// content_items 테이블 레코드 타입
interface ContentItem {
  id: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  channel: string;
}

// 응답 아이템 타입
interface SavedItem {
  content_id: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  channel: string;
  saved_at: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Supabase Auth 세션 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. 쿼리 파라미터 파싱 및 검증
  const searchParams = request.nextUrl.searchParams;
  const pageRaw = searchParams.get('page') ?? '1';
  const limitRaw = searchParams.get('limit') ?? '20';

  const page = Number(pageRaw);
  const limit = Number(limitRaw);

  if (!Number.isInteger(page) || isNaN(page) || page < 1) {
    return NextResponse.json(
      {
        success: false,
        error: 'page는 1 이상, limit는 1~50 범위의 정수여야 합니다',
        errorCode: 'INVALID_PARAMS',
      },
      { status: 400 }
    );
  }

  if (!Number.isInteger(limit) || isNaN(limit) || limit < 1 || limit > 50) {
    return NextResponse.json(
      {
        success: false,
        error: 'page는 1 이상, limit는 1~50 범위의 정수여야 합니다',
        errorCode: 'INVALID_PARAMS',
      },
      { status: 400 }
    );
  }

  const offset = (page - 1) * limit;

  // 3. user_interactions 테이블에서 저장 interaction 조회 (최신 저장순, 페이지네이션)
  const supabase = createServerClient();

  const { data: savedInteractions, count, error: savedError } = await supabase
    .from('user_interactions')
    .select('content_id, created_at', { count: 'exact' })
    .eq('interaction', '저장')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (savedError) {
    return NextResponse.json(
      { success: false, error: '저장 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  const total = count ?? 0;

  // 4. 저장 아이템이 없으면 빈 응답 반환
  if (!savedInteractions || savedInteractions.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        items: [],
        total,
        limit,
        offset,
        hasMore: false,
      },
    });
  }

  // 5. content_id 배열 추출 (중복 제거)
  const typed = savedInteractions as SavedInteraction[];
  const savedMap = new Map<string, string>();
  for (const si of typed) {
    if (!savedMap.has(si.content_id)) {
      savedMap.set(si.content_id, si.created_at);
    }
  }
  const contentIds = Array.from(savedMap.keys());

  // 6. content_items 일괄 조회 (N+1 방지)
  const { data: contentItems, error: contentError } = await supabase
    .from('content_items')
    .select('id, title, summary_ai, source, source_url, channel')
    .in('id', contentIds);

  if (contentError) {
    return NextResponse.json(
      { success: false, error: '콘텐츠 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  // 7. content_items Map 구성
  const contentMap = new Map<string, ContentItem>(
    (contentItems ?? []).map((item: ContentItem) => [item.id, item])
  );

  // 8. 응답 조립 (저장 순서 유지)
  const items: SavedItem[] = typed
    .filter((si, idx, arr) => arr.findIndex((a) => a.content_id === si.content_id) === idx)
    .map((si) => {
      const content = contentMap.get(si.content_id);
      return {
        content_id: si.content_id,
        title: content?.title ?? '',
        summary_ai: content?.summary_ai ?? null,
        source: content?.source ?? '',
        source_url: content?.source_url ?? '',
        channel: content?.channel ?? '',
        saved_at: si.created_at,
      };
    });

  const hasMore = offset + limit < total;

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      limit,
      offset,
      hasMore,
    },
  });
}
