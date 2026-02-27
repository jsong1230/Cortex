// GET /api/briefings/today — 오늘 브리핑 데이터 조회
// 인증: Supabase Auth 세션 (쿠키 기반)
// 참조: docs/specs/F-08-web-briefing-viewer/design.md

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { getTodayKST } from '@/lib/utils/date';
import { getBriefingByDate } from '@/lib/queries/briefing-query';

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

  const result = await getBriefingByDate(supabase, today);

  if (result.error) {
    if (result.error.code === 'NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: `오늘(${today})의 브리핑이 아직 생성되지 않았습니다`,
          errorCode: 'BRIEFING_NOT_FOUND',
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: result.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: result.data,
  });
}
