// GET /api/insights/reports — 월간 리포트 목록 조회 (페이지네이션)
// F-22 AC3: 웹 /insights에서 조회 가능
// 인증: Supabase Auth 세션 (쿠키 기반)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// 응답 아이템 타입 (content는 목록에서 제외 — 용량 절약)
interface ReportListItem {
  id: string;
  report_month: string;
  summary: string;
  top_topics: Array<{ topic: string; readCount: number; score: number }>;
  generated_at: string;
  telegram_sent_at: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. 인증 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 },
    );
  }

  // 2. 쿼리 파라미터 파싱 및 검증
  const searchParams = request.nextUrl.searchParams;
  const pageRaw = searchParams.get('page') ?? '1';
  const limitRaw = searchParams.get('limit') ?? '12';

  const page = Number(pageRaw);
  const limit = Number(limitRaw);

  if (!Number.isInteger(page) || isNaN(page) || page < 1) {
    return NextResponse.json(
      {
        success: false,
        error: 'page는 1 이상의 정수여야 합니다',
        errorCode: 'INVALID_PARAMS',
      },
      { status: 400 },
    );
  }

  if (!Number.isInteger(limit) || isNaN(limit) || limit < 1 || limit > 50) {
    return NextResponse.json(
      {
        success: false,
        error: 'limit는 1~50 범위의 정수여야 합니다',
        errorCode: 'INVALID_PARAMS',
      },
      { status: 400 },
    );
  }

  // 3. DB 조회 (monthly_reports 테이블, 최신순)
  const supabase = createServerClient();
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabase
    .from('monthly_reports')
    .select('id, report_month, summary, top_topics, generated_at, telegram_sent_at', {
      count: 'exact',
    })
    .order('report_month', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, error: 'DB 조회 실패', errorCode: 'DB_ERROR' },
      { status: 500 },
    );
  }

  const total = count ?? 0;
  const items = (data ?? []) as ReportListItem[];

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    },
  });
}
