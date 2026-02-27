// GET /api/briefings/today — 오늘 브리핑 데이터 조회
// 인증: Supabase Auth 세션

import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  // TODO: Phase 0
  // 1. Supabase 세션 검증
  // 2. briefings 테이블에서 오늘 날짜(KST) 기준 브리핑 조회
  // 3. content_items JOIN으로 상세 정보 포함
  // 4. user_interactions JOIN으로 반응 정보 포함

  return NextResponse.json(
    { success: false, error: 'Not implemented' },
    { status: 501 }
  );
}
