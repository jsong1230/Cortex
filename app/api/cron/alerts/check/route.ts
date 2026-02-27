// [Cron 매시간 정각] 긴급 알림 트리거 체크
// alert_settings 확인 → 트리거 조건 체크 → 조건 충족 시 텔레그램 즉시 발송

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

  // TODO: Phase 2
  // 1. alert_settings 활성화된 트리거 조회
  // 2. 방해 금지 시간 체크 (기본 23:00~07:00)
  // 3. 하루 발송 횟수 체크 (최대 3회)
  // 4. 트리거 조건 확인 (날씨 경보, 키워드 속보, My Life OS 매칭)
  // 5. 조건 충족 시 텔레그램 발송

  return NextResponse.json({ success: true, data: { triggered: 0 } });
}
