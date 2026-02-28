// POST /api/cron/snapshot-scores — 일별 스코어 스냅샷 저장 (F-21)
// 매일 23:00 UTC: 현재 interest_profile 스코어를 score_history에 기록
// AC3: 30일 추이 데이터 축적 목적
// 인증: CRON_SECRET Bearer 토큰

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface InterestProfileRow {
  topic: string;
  score: number;
}

// ─── 인증 헬퍼 ───────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ─── POST /api/cron/snapshot-scores ─────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Cron 시크릿 검증
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const now = new Date().toISOString();

  try {
    const supabase = createServerClient();

    // 2. 활성 토픽 현재 스코어 조회
    const { data: profileData, error: profileError } = await supabase
      .from('interest_profile')
      .select('topic, score')
      .is('archived_at', null);

    if (profileError) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          event: 'cortex_snapshot_scores_profile_error',
          error: profileError.message,
          timestamp: now,
        })
      );
      return NextResponse.json(
        { success: false, error: '토픽 조회 실패' },
        { status: 500 }
      );
    }

    const profiles = (profileData ?? []) as InterestProfileRow[];

    // 3. 스냅샷 대상이 없으면 스킵
    if (profiles.length === 0) {
      // eslint-disable-next-line no-console
      console.info(
        JSON.stringify({
          event: 'cortex_snapshot_scores_skipped',
          reason: '활성 토픽 없음',
          timestamp: now,
        })
      );
      return NextResponse.json({
        success: true,
        data: { snapshot_count: 0 },
      });
    }

    // 4. score_history에 현재 스냅샷 일괄 삽입
    const snapshots = profiles.map((p) => ({
      topic: p.topic,
      score: p.score,
      recorded_at: now,
    }));

    const { error: insertError } = await supabase
      .from('score_history')
      .insert(snapshots);

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          event: 'cortex_snapshot_scores_insert_error',
          error: insertError.message,
          count: snapshots.length,
          timestamp: now,
        })
      );
      return NextResponse.json(
        { success: false, error: '스냅샷 저장 실패' },
        { status: 500 }
      );
    }

    // 5. 구조화 로깅
    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        event: 'cortex_snapshot_scores_complete',
        snapshot_count: snapshots.length,
        timestamp: now,
      })
    );

    return NextResponse.json({
      success: true,
      data: { snapshot_count: snapshots.length },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_snapshot_scores_fatal_error',
        error: errMsg,
        timestamp: now,
      })
    );
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
