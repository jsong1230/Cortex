// POST /api/interactions — 웹 대시보드 반응 저장 + 학습 트리거
// 인증: Supabase Auth 세션

import { NextRequest, NextResponse } from 'next/server';

type InteractionType =
  | '좋아요'
  | '싫어요'
  | '저장'
  | '메모'
  | '웹열기'
  | '링크클릭'
  | '스킵';

interface InteractionBody {
  content_id: string;
  briefing_id: string;
  interaction: InteractionType;
  memo_text?: string;
  source: 'web';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: InteractionBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body.content_id || !body.briefing_id || !body.interaction) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // TODO: Phase 1
  // 1. Supabase 세션 검증
  // 2. user_interactions 테이블에 저장
  // 3. lib/scoring.ts — EMA 업데이트 트리거

  void body; // 사용 예정

  return NextResponse.json(
    { success: false, error: 'Not implemented' },
    { status: 501 }
  );
}
