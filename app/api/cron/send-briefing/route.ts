// [Cron 22:00 UTC / 07:00 KST] 텔레그램 브리핑 발송
// 채널별 상위 아이템 선정 → briefings 테이블 저장 → 텔레그램 sendMessage 발송

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

  // TODO: Phase 0
  // 1. My Life OS 컨텍스트 동기화
  // 2. 채널별 상위 아이템 선정 (TECH 2~3, WORLD 1~2, CULTURE 1~2, TORONTO 2~3, 세렌디피티 1)
  // 3. 평일/주말 포맷으로 브리핑 텍스트 생성
  // 4. briefings 테이블에 저장
  // 5. 텔레그램 sendMessage 발송 (인라인 키보드 포함)

  return NextResponse.json({ success: true, data: { sent: false } });
}
