// GET /api/profile/interests — 관심사 프로필 조회 (F-13 AC5, AC6)
// interest_profile 테이블의 전체 토픽 목록 반환 (보관되지 않은 항목)
// 인증: Supabase Auth 세션

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// interest_profile 레코드 타입
interface InterestProfileRow {
  id: string;
  topic: string;
  score: number;
  interaction_count: number;
  last_updated: string;
  archived_at: string | null;
}

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

  // 2. 보관되지 않은 토픽 조회 (score DESC 정렬)
  const { data, error } = await supabase
    .from('interest_profile')
    .select('id, topic, score, interaction_count, last_updated, archived_at')
    .is('archived_at', null)
    .order('score', { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_interests_db_error',
        error: error.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '관심사 프로필 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  const topics = (data ?? []) as InterestProfileRow[];

  return NextResponse.json({
    success: true,
    data: {
      topics: topics.map((row) => ({
        id: row.id,
        topic: row.topic,
        score: row.score,
        interaction_count: row.interaction_count,
        last_updated: row.last_updated,
        archived_at: row.archived_at,
      })),
      total: topics.length,
    },
  });
}
