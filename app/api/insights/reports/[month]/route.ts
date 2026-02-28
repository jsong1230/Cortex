// GET /api/insights/reports/[month] — 특정 월 리포트 전체 내용 조회
// F-22 AC3: 웹 /insights에서 조회 가능
// 인증: Supabase Auth 세션 (쿠키 기반)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// 'YYYY-MM' 형식 검증 정규식
const MONTH_REGEX = /^\d{4}-\d{2}$/;

interface RouteParams {
  params: Promise<{ month: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  // 1. 인증 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 },
    );
  }

  // 2. month 파라미터 검증 (YYYY-MM 형식)
  const { month } = await params;

  if (!month || !MONTH_REGEX.test(month)) {
    return NextResponse.json(
      {
        success: false,
        error: 'month는 YYYY-MM 형식이어야 합니다',
        errorCode: 'INVALID_PARAMS',
      },
      { status: 400 },
    );
  }

  // 3. DB 조회
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('monthly_reports')
    .select(
      'id, report_month, content, summary, top_topics, generated_at, telegram_sent_at',
    )
    .eq('report_month', month)
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        success: false,
        error: `${month} 리포트를 찾을 수 없습니다`,
        errorCode: 'REPORT_NOT_FOUND',
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}
