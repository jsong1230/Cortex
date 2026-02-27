// GET /api/briefings/[date] — 특정 날짜 브리핑 조회 (YYYY-MM-DD)
// 인증: Supabase Auth 세션

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: { date: string };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { date } = params;

  // YYYY-MM-DD 형식 검증
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return NextResponse.json(
      { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    );
  }

  // TODO: Phase 1
  // briefings 테이블에서 해당 날짜 브리핑 조회

  return NextResponse.json(
    { success: false, error: 'Not implemented' },
    { status: 501 }
  );
}
