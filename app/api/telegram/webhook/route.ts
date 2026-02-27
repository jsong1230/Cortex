// 텔레그램 봇 메시지/버튼 수신 웹훅
// 인증: X-Telegram-Bot-Api-Secret-Token 헤더 검증

import { NextRequest, NextResponse } from 'next/server';

function verifyWebhookSecret(request: NextRequest): boolean {
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
  return secretToken === process.env.TELEGRAM_WEBHOOK_SECRET;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const update = await request.json();

  // TODO: Phase 0 — 텔레그램 Update 처리
  // callback_query (인라인 버튼): like/dislike/save → user_interactions 저장
  // message.text — 명령어 처리:
  //   /good, /bad, /save N, /more, /keyword XXX, /stats, /mute N

  void update; // 사용 예정

  return NextResponse.json({ success: true });
}
