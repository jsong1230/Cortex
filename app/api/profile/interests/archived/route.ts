// GET  /api/profile/interests/archived — 보관된 토픽 조회 (F-14 AC4)
// POST /api/profile/interests/archived — 보관 토픽 복원 (F-14 AC4)
// interest_profile.archived_at IS NOT NULL 레코드
// 인증: Supabase Auth 세션

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// ─── 공통 타입 ────────────────────────────────────────────────────────────────

interface InterestProfileRow {
  id: string;
  topic: string;
  score: number;
  interaction_count: number;
  last_updated: string;
  archived_at: string | null;
}

// ─── GET — 보관된 토픽 목록 조회 ─────────────────────────────────────────────

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

  // 2. archived_at IS NOT NULL 레코드 조회 (archived_at DESC 정렬)
  const { data, error } = await supabase
    .from('interest_profile')
    .select('id, topic, score, interaction_count, last_updated, archived_at')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_interests_archived_get_error',
        error: error.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '보관된 토픽 조회 중 오류가 발생했습니다' },
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

// ─── POST — 보관 토픽 복원 (F-14 AC4) ────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. 인증 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. 요청 파싱 + 검증
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '잘못된 요청 형식입니다' },
      { status: 400 }
    );
  }

  const { id } = body;

  if (typeof id !== 'string' || id.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'id 필드가 필요합니다', errorCode: 'ID_REQUIRED' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 3. archived_at = null 로 복원
  const { data, error } = await supabase
    .from('interest_profile')
    .update({ archived_at: null })
    .eq('id', id)
    .select('id, topic, score, interaction_count, last_updated, archived_at')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_interests_restore_error',
        error: error.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '토픽 복원 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
