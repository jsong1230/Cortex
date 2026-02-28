// 텔레그램 봇 메시지/버튼 수신 웹훅
// 인증: X-Telegram-Bot-Api-Secret-Token 헤더 검증
// F-07 설계서: docs/specs/F-07-telegram-commands/design.md

import { NextRequest, NextResponse } from 'next/server';
import {
  parseCommand,
  dispatchCommand,
  handleCallbackQuery,
  type TelegramUpdate,
} from '@/lib/telegram-commands';

/**
 * X-Telegram-Bot-Api-Secret-Token 헤더 검증
 */
function verifyWebhookSecret(request: NextRequest): boolean {
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
  return secretToken === process.env.TELEGRAM_WEBHOOK_SECRET;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // AC8: 웹훅 시크릿 토큰 검증
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    // JSON 파싱 실패 — 200 반환 (텔레그램 재전송 방지)
    return NextResponse.json({ success: true });
  }

  try {
    // callback_query 처리 (인라인 버튼 클릭)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return NextResponse.json({
        success: true,
        data: {
          type: 'callback_query',
          action: update.callback_query.data ?? null,
        },
      });
    }

    // 텍스트 명령어 처리
    if (update.message?.text) {
      const parsed = parseCommand(update.message.text);
      if (parsed) {
        await dispatchCommand(parsed);
      }
      // 명령어가 아닌 일반 메시지는 무시
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // 비즈니스 로직 오류도 200으로 반환 — 텔레그램 재전송 방지
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      event: 'cortex_webhook_error',
      error: errMsg,
      update_id: update.update_id,
      command: update.message?.text,
    }));
    return NextResponse.json({ success: true });
  }
}
