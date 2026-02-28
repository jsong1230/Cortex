// GET /api/insights/landscape — 관심사 지형도 데이터 조회 (F-21)
// 활성 토픽 목록 + 최근 30일 스코어 히스토리 반환
// AC1: 버블 차트 데이터, AC3: 추이 데이터 소스
// 인증: Supabase Auth 세션

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface InterestProfileRow {
  id: string;
  topic: string;
  score: number;
  interaction_count: number;
  last_updated: string;
}

interface ScoreHistoryRow {
  topic: string;
  score: number;
  recorded_at: string;
}

interface HistoryPoint {
  date: string;
  score: number;
}

interface LandscapeTopic {
  topic: string;
  score: number;
  interactionCount: number;
  history: HistoryPoint[];
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

// 30일 이내 히스토리만 조회
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

  // 2. 활성 토픽 조회 (score DESC)
  const { data: profileData, error: profileError } = await supabase
    .from('interest_profile')
    .select('id, topic, score, interaction_count, last_updated')
    .is('archived_at', null)
    .order('score', { ascending: false });

  if (profileError) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_landscape_profile_error',
        error: profileError.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '관심사 프로필 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  const profiles = (profileData ?? []) as InterestProfileRow[];

  // 3. 최근 30일 스코어 히스토리 조회
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
        event: 'cortex_landscape_history_error',
        error: historyError.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '스코어 히스토리 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  const history = (historyData ?? []) as ScoreHistoryRow[];

  // 4. 토픽별 히스토리 그룹핑 (Map으로 O(n) 처리)
  const historyMap = new Map<string, HistoryPoint[]>();
  for (const h of history) {
    if (!historyMap.has(h.topic)) {
      historyMap.set(h.topic, []);
    }
    historyMap.get(h.topic)!.push({
      date: h.recorded_at.slice(0, 10), // YYYY-MM-DD
      score: h.score,
    });
  }

  // 5. 응답 데이터 조립
  const topics: LandscapeTopic[] = profiles.map((p) => ({
    topic: p.topic,
    score: p.score,
    interactionCount: p.interaction_count,
    history: historyMap.get(p.topic) ?? [],
  }));

  return NextResponse.json({
    success: true,
    data: {
      topics,
      total: topics.length,
    },
  });
}
