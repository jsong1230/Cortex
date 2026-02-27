// GET  /api/profile/interests — 관심사 프로필 조회 (F-13 AC5, AC6)
// POST /api/profile/interests — 토픽 수동 추가 (F-14 AC2)
// PUT  /api/profile/interests — 토픽 스코어 수동 조정 (F-14 AC2)
// DELETE /api/profile/interests — 토픽 아카이브 (F-14 AC2)
// interest_profile 테이블
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

// ─── GET — 활성 토픽 목록 조회 ────────────────────────────────────────────────

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

// ─── POST — 토픽 수동 추가 (F-14 AC2) ────────────────────────────────────────

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

  const topicRaw = body.topic;
  if (typeof topicRaw !== 'string' || topicRaw.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'topic 필드는 비어 있을 수 없습니다', errorCode: 'TOPIC_REQUIRED' },
      { status: 400 }
    );
  }
  const topic = topicRaw.trim();

  const supabase = createServerClient();

  // 3. 신규 토픽 INSERT (기본 score=0.5)
  const { data, error } = await supabase
    .from('interest_profile')
    .insert({
      topic,
      score: 0.5,
      interaction_count: 0,
      last_updated: new Date().toISOString(),
    })
    .select('id, topic, score, interaction_count, last_updated, archived_at')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_interests_post_error',
        error: error.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '토픽 추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}

// ─── PUT — 토픽 스코어 수동 조정 (F-14 AC2) ──────────────────────────────────

export async function PUT(request: NextRequest): Promise<NextResponse> {
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

  const { id, score } = body;

  if (typeof id !== 'string' || id.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'id 필드가 필요합니다', errorCode: 'ID_REQUIRED' },
      { status: 400 }
    );
  }

  if (typeof score !== 'number' || score < 0 || score > 1) {
    return NextResponse.json(
      { success: false, error: 'score는 0~1 사이의 숫자여야 합니다', errorCode: 'SCORE_INVALID' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 3. score 업데이트
  const { data, error } = await supabase
    .from('interest_profile')
    .update({ score, last_updated: new Date().toISOString() })
    .eq('id', id)
    .select('id, topic, score, interaction_count, last_updated, archived_at')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_interests_put_error',
        error: error.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '스코어 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}

// ─── DELETE — 토픽 아카이브 (F-14 AC2) ──────────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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

  // 3. archived_at 설정 (소프트 삭제)
  const { data, error } = await supabase
    .from('interest_profile')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, topic, score, interaction_count, last_updated, archived_at')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_interests_delete_error',
        error: error.message,
      })
    );
    return NextResponse.json(
      { success: false, error: '토픽 아카이브 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
