// GET /api/profile/interests — 관심사 프로필 조회
// 인증: Supabase Auth 세션

import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  // TODO: Phase 2
  // interest_profile 테이블에서 score DESC 정렬로 전체 토픽 반환

  return NextResponse.json(
    { success: false, error: 'Not implemented' },
    { status: 501 }
  );
}
