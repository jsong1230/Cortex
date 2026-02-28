// POST /api/cron/archive-topics — 저점수 토픽 자동 보관 (F-13 AC5)
// 스코어 <= 0.2 이고 last_updated > 3개월 전인 토픽에 archived_at 설정
// 실행 주기: 주 1회 (vercel.json cron 설정)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// 보관 기준 점수
const ARCHIVE_THRESHOLD_SCORE = 0.2;
// 보관 기준 기간 (개월)
const ARCHIVE_THRESHOLD_MONTHS = 3;

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * 3개월 이전 날짜 ISO 문자열 반환
 */
function getThreeMonthsAgoIso(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - ARCHIVE_THRESHOLD_MONTHS);
  return date.toISOString();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── 1. 인증 ────────────────────────────────────────────────────────────
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const threeMonthsAgo = getThreeMonthsAgoIso();
  const now = new Date().toISOString();

  try {
    const supabase = createServerClient();

    // ─── 2. 보관 대상 조회 ──────────────────────────────────────────────
    // score <= 0.2 AND last_updated <= 3개월 전 AND archived_at IS NULL
    const { data: targetTopics, error: selectError } = await supabase
      .from('interest_profile')
      .select('id, topic, score, last_updated')
      .lte('score', ARCHIVE_THRESHOLD_SCORE)
      .lte('last_updated', threeMonthsAgo)
      .is('archived_at', null);

    if (selectError) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          event: 'cortex_archive_topics_select_error',
          error: selectError.message,
          timestamp: now,
        })
      );
      return NextResponse.json(
        { success: false, error: '보관 대상 조회 실패' },
        { status: 500 }
      );
    }

    const targets = targetTopics ?? [];

    // ─── 3. 보관 대상 없으면 스킵 ──────────────────────────────────────
    if (targets.length === 0) {
      // eslint-disable-next-line no-console
      console.info(
        JSON.stringify({
          event: 'cortex_archive_topics_skipped',
          reason: '보관 대상 토픽 없음',
          timestamp: now,
        })
      );
      return NextResponse.json({
        success: true,
        data: { archived_count: 0, archived_topics: [] },
      });
    }

    // ─── 4. archived_at 업데이트 ────────────────────────────────────────
    const targetIds = targets.map((t: { id: string }) => t.id);

    const { error: updateError } = await supabase
      .from('interest_profile')
      .update({ archived_at: now })
      .in('id', targetIds);

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          event: 'cortex_archive_topics_update_error',
          error: updateError.message,
          target_count: targets.length,
          timestamp: now,
        })
      );
      return NextResponse.json(
        { success: false, error: '토픽 보관 업데이트 실패' },
        { status: 500 }
      );
    }

    // ─── 5. 구조화 로깅 ──────────────────────────────────────────────────
    const archivedTopics = targets.map((t: { topic: string; score: number }) => ({
      topic: t.topic,
      score: t.score,
    }));

    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        event: 'cortex_archive_topics_complete',
        archived_count: targets.length,
        archived_topics: archivedTopics,
        timestamp: now,
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        archived_count: targets.length,
        archived_topics: archivedTopics,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_archive_topics_fatal_error',
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
