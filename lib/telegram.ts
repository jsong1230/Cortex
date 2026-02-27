// 텔레그램 봇 유틸리티 (발송, 인라인 키보드)
// 모든 텔레그램 API 호출은 이 모듈을 통해 수행

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN 환경변수가 설정되지 않았습니다.');
  return token;
}

function getChatId(): string {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다.');
  return chatId;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface SendMessageOptions {
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  inlineKeyboard?: InlineButton[][];
  chatId?: string;  // 기본값: TELEGRAM_CHAT_ID
}

/**
 * 텔레그램 메시지 발송
 */
export async function sendMessage(options: SendMessageOptions): Promise<void> {
  const token = getBotToken();
  const chatId = options.chatId ?? getChatId();

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: options.text,
    parse_mode: options.parseMode ?? 'HTML',
  };

  if (options.inlineKeyboard) {
    body.reply_markup = {
      inline_keyboard: options.inlineKeyboard,
    };
  }

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`텔레그램 메시지 발송 실패: ${error}`);
  }
}

/**
 * 브리핑 아이템용 인라인 키보드 생성
 */
export function createBriefingKeyboard(
  contentId: string,
  webUrl: string
): InlineButton[][] {
  return [
    [
      { text: '👍', callback_data: `like:${contentId}` },
      { text: '👎', callback_data: `dislike:${contentId}` },
      { text: '🔖', callback_data: `save:${contentId}` },
    ],
    [
      { text: '👉 자세히 보기', url: `${webUrl}/item/${contentId}` },
    ],
  ];
}

/**
 * 콜백 데이터 파싱 (action:content_id 형식)
 */
export function parseCallbackData(
  callbackData: string
): { action: string; contentId: string } | null {
  const parts = callbackData.split(':');
  if (parts.length !== 2) return null;
  return { action: parts[0], contentId: parts[1] };
}

/**
 * 텔레그램 웹훅 등록 (초기 설정 1회 실행)
 */
export async function setWebhook(webhookUrl: string): Promise<void> {
  const token = getBotToken();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query'],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`웹훅 등록 실패: ${error}`);
  }
}
