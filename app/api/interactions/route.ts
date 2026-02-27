// POST /api/interactions — 웹 대시보드 반응 저장
// 인증: Supabase Auth 세션
// 참조: docs/specs/F-08-web-briefing-viewer/design.md, docs/system/api-conventions.md

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

type InteractionType =
  | '좋아요'
  | '싫어요'
  | '저장'
  | '메모'
  | '웹열기'
  | '링크클릭'
  | '스킵';

const VALID_INTERACTIONS: InteractionType[] = [
  '좋아요',
  '싫어요',
  '저장',
  '메모',
  '웹열기',
  '링크클릭',
  '스킵',
];

interface InteractionBody {
  content_id: string;
  briefing_id: string;
  interaction: InteractionType;
  memo_text?: string;
  source: 'web';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Supabase Auth 세션 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. 요청 본문 파싱
  let body: InteractionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // 3. 필수 필드 검증
  if (!body.content_id || !body.briefing_id || !body.interaction) {
    return NextResponse.json(
      { success: false, error: 'content_id, briefing_id, interaction은 필수입니다' },
      { status: 400 }
    );
  }

  // 4. interaction 타입 검증
  if (!VALID_INTERACTIONS.includes(body.interaction)) {
    return NextResponse.json(
      {
        success: false,
        error: `interaction 필드는 '좋아요'|'싫어요'|'저장'|'메모'|'웹열기'|'링크클릭' 중 하나여야 합니다`,
        errorCode: 'INTERACTION_INVALID_TYPE',
      },
      { status: 400 }
    );
  }

  // 5. 반응 저장
  const supabase = createServerClient();

  const insertData: Record<string, unknown> = {
    content_id: body.content_id,
    briefing_id: body.briefing_id,
    interaction: body.interaction,
    source: 'web',
  };

  if (body.interaction === '메모' && body.memo_text) {
    insertData.memo_text = body.memo_text;
  }

  const { data, error } = await supabase
    .from('user_interactions')
    .insert(insertData)
    .select('id, interaction, content_id')
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: '반응 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        id: data.id,
        interaction: data.interaction,
        content_id: data.content_id,
      },
    },
    { status: 201 }
  );
}
