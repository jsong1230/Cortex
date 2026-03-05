// GET /api/settings/telegram — 텔레그램 chat_id 연동 상태 조회
// F-20 AC6

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getTelegramUserId } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

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
  // 1. 인증 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const supabase = createServerClient();
  const telegramUserId = await getTelegramUserId();

  // 2. telegram_users에서 chat_id 조회
  let chatId: string | null = null;
  if (telegramUserId) {
    const { data, error } = await supabase
      .from('telegram_users')
      .select('chat_id')
      .eq('id', telegramUserId)
      .eq('is_active', true)
      .single();

    if (!error && data) {
      chatId = data.chat_id?.toString() ?? null;
    }
  }

  // 3. bot_username: 환경변수 TELEGRAM_BOT_USERNAME 또는 기본값
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'CortexBot';

  const linked = chatId !== null;

  return NextResponse.json({
    success: true,
    data: {
      linked,
      chat_id_masked: linked ? maskChatId(chatId) : null,
      bot_username: botUsername,
    },
  });
}
