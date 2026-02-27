// DELETE /api/saved/[contentId] — 저장(북마크) 해제
// 인증: Supabase Auth 세션 (쿠키 기반)
// 참조: docs/specs/F-10-web-briefing-history/design.md §3.4

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

interface RouteParams {
  params: { contentId: string };
}

// UUID v4 형식 검증 정규식
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { contentId } = params;

  // 1. Supabase Auth 세션 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. contentId UUID 형식 검증
  if (!UUID_REGEX.test(contentId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'contentId는 유효한 UUID여야 합니다',
        errorCode: 'INVALID_CONTENT_ID',
      },
      { status: 400 }
    );
  }

  // 3. user_interactions 테이블에서 해당 content_id의 저장 레코드 삭제
  const supabase = createServerClient();

  const { data: deleted, error: deleteError } = await supabase
    .from('user_interactions')
    .delete()
    .eq('content_id', contentId)
    .eq('interaction', '저장')
    .select('content_id');

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: '저장 해제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  // 4. 삭제된 행이 없으면 404
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: '해당 콘텐츠의 저장 기록이 없습니다',
        errorCode: 'SAVED_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
