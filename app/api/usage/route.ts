// Claude API 사용량 집계 API (I-15)
// GET /api/usage?days=7 → 일별 토큰 사용량 + 예상 비용 반환

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(30, Math.max(1, Number(searchParams.get('days') ?? '7')));

  const supabase = createServerClient();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('api_usage_log')
    .select('event, total_tokens, estimated_cost_usd, item_count, duration_ms, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: `DB 조회 실패: ${error.message}` },
      { status: 500 },
    );
  }

  // 일별 집계
  const dailyMap = new Map<
    string,
    { date: string; totalTokens: number; totalCostUsd: number; callCount: number }
  >();

  for (const row of data ?? []) {
    const date = row.created_at.slice(0, 10); // YYYY-MM-DD
    const existing = dailyMap.get(date) ?? { date, totalTokens: 0, totalCostUsd: 0, callCount: 0 };
    existing.totalTokens += row.total_tokens ?? 0;
    existing.totalCostUsd += Number(row.estimated_cost_usd ?? 0);
    existing.callCount += 1;
    dailyMap.set(date, existing);
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  const totalTokens = daily.reduce((sum, d) => sum + d.totalTokens, 0);
  const totalCostUsd = daily.reduce((sum, d) => sum + d.totalCostUsd, 0);

  return NextResponse.json({
    success: true,
    data: {
      period: { days, since },
      summary: { totalTokens, totalCostUsd: Number(totalCostUsd.toFixed(6)), callCount: data?.length ?? 0 },
      daily,
    },
  });
}
