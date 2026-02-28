// GET /api/insights/trends — 30일 토픽별 추이 데이터 조회 (F-21)
// TrendChart 라인 차트용 데이터 반환
// 인증: Supabase Auth 세션

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface ScoreHistoryRow {
  topic: string;
  score: number;
  recorded_at: string;
}

interface TrendPoint {
  date: string;
  score: number;
}

interface TrendEntry {
  topic: string;
  points: TrendPoint[];
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const HISTORY_DAYS = 30;

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  // 1. 인증 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const supabase = createServerClient();

  // 2. 최근 30일 스코어 히스토리 조회 (날짜 오름차순)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - HISTORY_DAYS);

  const { data: historyData, error: historyError } = await supabase
    .from('score_history')
    .select('topic, score, recorded_at')
    .gte('recorded_at', thirtyDaysAgo.toISOString())
    .order('recorded_at', { ascending: true });

  if (historyError) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_trends_history_error',
        error: historyError.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '추이 데이터 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  const history = (historyData ?? []) as ScoreHistoryRow[];

  // 3. 토픽별 그룹핑
  const trendsMap = new Map<string, TrendPoint[]>();
  for (const h of history) {
    if (!trendsMap.has(h.topic)) {
      trendsMap.set(h.topic, []);
    }
    trendsMap.get(h.topic)!.push({
      date: h.recorded_at.slice(0, 10),
      score: h.score,
    });
  }

  const trends: TrendEntry[] = Array.from(trendsMap.entries()).map(([topic, points]) => ({
    topic,
    points,
  }));

  return NextResponse.json({
    success: true,
    data: {
      trends,
      total: trends.length,
      period_days: HISTORY_DAYS,
    },
  });
}
