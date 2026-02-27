// GET /api/briefings — 과거 브리핑 목록 조회 (날짜 역순, 페이지네이션)
// 인증: Supabase Auth 세션 (쿠키 기반)
// 참조: docs/specs/F-10-web-briefing-history/design.md §3.1

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// briefings.items JSONB 아이템 타입 (채널/아이템 수 계산용)
interface BriefingItem {
  content_id: string;
  position: number;
  channel: string;
  reason?: string | null;
}

// 응답 아이템 타입
interface BriefingListItem {
  id: string;
  briefing_date: string;
  item_count: number;
  channels: string[];
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

  // 파라미터 유효성 검사
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

  // 3. offset 계산 (1-based → 0-based)
  const offset = (page - 1) * limit;

  // 4. briefings 테이블 조회 (날짜 역순, 페이지네이션)
  const supabase = createServerClient();

  const { data, count, error } = await supabase
    .from('briefings')
    .select('id, briefing_date, items', { count: 'exact' })
    .order('briefing_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, error: '브리핑 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  const total = count ?? 0;

  // 5. 각 브리핑의 items JSONB에서 아이템 수와 채널 분포 계산
  const items: BriefingListItem[] = (data ?? []).map((briefing) => {
    const rawItems = (briefing.items as BriefingItem[]) ?? [];
    const item_count = rawItems.length;
    // 채널 목록 (중복 제거)
    const channelSet = new Set(rawItems.map((item) => item.channel));
    const channels = Array.from(channelSet);

    return {
      id: briefing.id as string,
      briefing_date: briefing.briefing_date as string,
      item_count,
      channels,
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
