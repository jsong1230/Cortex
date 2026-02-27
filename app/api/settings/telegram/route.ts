// GET /api/settings/telegram — 텔레그램 chat_id 연동 상태 조회
// F-20 AC6

import { NextRequest, NextResponse } from 'next/server';

/** chat_id를 프라이버시 보호를 위해 마스킹한다 (앞 3자리 + ****) */
function maskChatId(chatId: string): string {
  if (chatId.length <= 3) {
    return chatId + '***';
  }
  const visiblePart = chatId.slice(0, 3);
  const maskedPart = '*'.repeat(chatId.length - 3);
  return visiblePart + maskedPart;
}

// ─── GET: 텔레그램 연동 상태 조회 ────────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';

  // bot_username: 봇 토큰에서 봇 이름 부분 추출 불가이므로 환경변수에서 설정 가능
  // TELEGRAM_BOT_USERNAME이 없으면 'CortexBot' 기본값 사용
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'CortexBot';

  const linked = chatId.length > 0 && botToken.length > 0;

  return NextResponse.json({
    success: true,
    data: {
      linked,
      chat_id_masked: linked ? maskChatId(chatId) : null,
      bot_username: botUsername,
    },
  });
}
