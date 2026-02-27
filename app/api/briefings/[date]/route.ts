// GET /api/briefings/[date] — 특정 날짜 브리핑 조회 (YYYY-MM-DD)
// 인증: Supabase Auth 세션 (쿠키 기반)
// 참조: docs/specs/F-10-web-briefing-history/design.md §3.2

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { getTodayKST } from '@/lib/utils/date';
import { getBriefingByDate } from '@/lib/queries/briefing-query';

interface RouteParams {
  params: { date: string };
}

/**
 * YYYY-MM-DD 형식 + 실제 유효한 날짜인지 검증한다.
 * 예: 2026-02-30은 형식은 맞지만 유효하지 않은 날짜 → false
 */
function isValidDate(dateStr: string): boolean {
  // 형식 검증: YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }

  // 날짜 유효성 검증 (2026-02-30 같은 날짜 걸러냄)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { date } = params;

  // 1. 날짜 형식 + 유효성 검증
  if (!isValidDate(date)) {
    return NextResponse.json(
      {
        success: false,
        error: '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 사용하세요',
        errorCode: 'INVALID_DATE_FORMAT',
      },
      { status: 400 }
    );
  }

  // 2. 미래 날짜 거부
  const today = getTodayKST();
  if (date > today) {
    return NextResponse.json(
      {
        success: false,
        error: '미래 날짜의 브리핑은 조회할 수 없습니다',
        errorCode: 'FUTURE_DATE_NOT_ALLOWED',
      },
      { status: 400 }
    );
  }

  // 3. Supabase Auth 세션 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 4. 서버 클라이언트로 브리핑 조회 (공통 함수 사용)
  const supabase = createServerClient();
  const result = await getBriefingByDate(supabase, date);

  if (result.error) {
    if (result.error.code === 'NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: result.error.message,
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
