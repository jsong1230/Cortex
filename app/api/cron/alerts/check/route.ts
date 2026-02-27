// [Cron 매시간 정각] 긴급 알림 트리거 체크
// AC1: 1시간마다 Vercel Cron이 호출
// AC2~AC7: processAlertTriggers에서 모든 조건 처리

import { NextRequest, NextResponse } from 'next/server';
import { processAlertTriggers } from '@/lib/alerts';

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

  try {
    const result = await processAlertTriggers();

    return NextResponse.json({
      success: true,
      data: {
        triggered: result.triggered,
        skipped: result.skipped,
        errors: result.errors,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: true,
      data: {
        triggered: 0,
        skipped: [],
        errors: [message],
      },
    });
  }
}
