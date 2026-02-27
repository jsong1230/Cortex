// POST /api/context/sync — My Life OS 컨텍스트 동기화
// 내부 전용 (Cron에서만 호출) — CRON_SECRET으로 인증

import { NextRequest, NextResponse } from 'next/server';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // TODO: Phase 3
  // 1. lib/mylifeos.ts — 최근 7일 diary_entries, todos, notes 키워드 추출
  // 2. keyword_contexts 테이블에 저장 (7일 TTL)
  // 3. 만료된 컨텍스트 정리

  return NextResponse.json(
    { success: false, error: 'Not implemented' },
    { status: 501 }
  );
}
