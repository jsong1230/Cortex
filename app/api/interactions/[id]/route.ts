// DELETE /api/interactions/[id] — 반응 취소 (물리 삭제)
// PUT    /api/interactions/[id] — 메모 텍스트 수정
// 인증: Supabase Auth 세션
// 참조: docs/specs/F-11-user-interactions/design.md, docs/system/api-conventions.md

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// ─── DELETE /api/interactions/[id] — 반응 취소 ────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 1. 인증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const { id } = params;
  const supabase = createServerClient();

  // 2. 존재 여부 확인 후 물리 삭제
  // delete().eq().select().single() 체인으로 삭제된 레코드를 반환
  const { data, error } = await supabase
    .from('user_interactions')
    .delete()
    .eq('id', id)
    .select('id, interaction, content_id')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: '반응을 찾을 수 없습니다', errorCode: 'INTERACTION_NOT_FOUND' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      interaction: data.interaction,
      content_id: data.content_id,
    },
  });
}

// ─── PUT /api/interactions/[id] — 메모 텍스트 수정 ────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 1. 인증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. 요청 본문 파싱
  let body: { memo_text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // 3. memo_text 필수 검증
  if (!body.memo_text) {
    return NextResponse.json(
      { success: false, error: 'memo_text는 필수입니다', errorCode: 'INTERACTION_MEMO_REQUIRED' },
      { status: 400 }
    );
  }

  const { id } = params;
  const supabase = createServerClient();

  // 4. 기존 반응 조회
  const { data: existing, error: selectError } = await supabase
    .from('user_interactions')
    .select('id, interaction, memo_text, content_id')
    .eq('id', id)
    .single();

  if (selectError || !existing) {
    return NextResponse.json(
      { success: false, error: '반응을 찾을 수 없습니다', errorCode: 'INTERACTION_NOT_FOUND' },
      { status: 404 }
    );
  }

  // 5. 메모 타입 검증
  if (existing.interaction !== '메모') {
    return NextResponse.json(
      {
        success: false,
        error: '메모 타입 반응만 수정할 수 있습니다',
        errorCode: 'INTERACTION_NOT_MEMO',
      },
      { status: 400 }
    );
  }

  // 6. 메모 텍스트 업데이트
  const { data: updated, error: updateError } = await supabase
    .from('user_interactions')
    .update({ memo_text: body.memo_text })
    .eq('id', id)
    .select('id, interaction, memo_text, content_id')
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { success: false, error: '메모 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      interaction: updated.interaction,
      memo_text: updated.memo_text,
      content_id: updated.content_id,
    },
  });
}
