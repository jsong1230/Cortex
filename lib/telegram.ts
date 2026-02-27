// 텔레그램 봇 유틸리티 (발송, 포매팅, 인라인 키보드)
// 모든 텔레그램 API 호출은 이 모듈을 통해 수행
// F-06 설계서: docs/specs/F-06-telegram-briefing/design.md

const TELEGRAM_API_BASE = 'https://api.telegram.org';

// 요일 표기 (KST)
const DAY_NAMES_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// 채널별 선정 한도
const CHANNEL_LIMITS: Record<string, { min: number; max: number }> = {
  tech:    { min: 2, max: 3 },
  world:   { min: 1, max: 2 },
  culture: { min: 1, max: 2 },
  canada:  { min: 2, max: 3 },
};

// 채널 헤더 이모지 매핑
const CHANNEL_HEADERS: Record<string, string> = {
  tech:        '🖥️ TECH',
  world:       '🌍 WORLD',
  culture:     '🎬 CULTURE',
  canada:      '🍁 TORONTO',
  serendipity: '🎲 세렌디피티',
};

// 채널 표시 순서
const CHANNEL_ORDER = ['tech', 'world', 'culture', 'canada', 'serendipity'];

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

// ─── 인터페이스 ──────────────────────────────────────────────────────────────

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface SendMessageOptions {
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  inlineKeyboard?: InlineButton[][];
  chatId?: string;
}

/** 브리핑 아이템 (DB content_items에서 조회한 형태) */
export interface BriefingItem {
  id: string;
  channel: string;           // 'tech' | 'world' | 'culture' | 'canada' | 'serendipity'
  source: string;            // 'hackernews' | 'weather' | 'cbc' 등
  source_url: string;
  title: string;
  summary_ai: string | null;
  score_initial: number;
  tags?: string[];
}

/** sendBriefing 결과 */
export interface SendBriefingResult {
  messageId?: number;
}

// ─── sendMessage ─────────────────────────────────────────────────────────────

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
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`텔레그램 메시지 발송 실패: ${error}`);
  }
}

// ─── formatBriefingMessage ───────────────────────────────────────────────────

/**
 * 브리핑 HTML 메시지 생성
 * 채널 순서: TECH → WORLD → CULTURE → TORONTO → 세렌디피티
 * 빈 채널은 섹션 자체를 생략한다
 */
export function formatBriefingMessage(items: BriefingItem[]): string {
  // KST 날짜 + 요일 계산
  const now = new Date();
  const kstDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // 'YYYY-MM-DD'
  const kstDate = new Date(`${kstDateStr}T00:00:00+09:00`);
  const yearMonth = kstDateStr.slice(0, 7).replace('-', '.'); // 'YYYY.MM'
  const day = kstDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(8, 10); // 'DD'
  const dayName = DAY_NAMES_KO[kstDate.getDay()];

  const lines: string[] = [];
  lines.push(`🌅 ${yearMonth}.${day} ${dayName} 모닝 브리핑`);

  // 채널별 아이템 그룹핑
  const byChannel = new Map<string, BriefingItem[]>();
  for (const item of items) {
    const arr = byChannel.get(item.channel) ?? [];
    arr.push(item);
    byChannel.set(item.channel, arr);
  }

  for (const channelKey of CHANNEL_ORDER) {
    const channelItems = byChannel.get(channelKey);
    if (!channelItems || channelItems.length === 0) continue;

    const header = CHANNEL_HEADERS[channelKey];
    lines.push('');
    lines.push(header);

    if (channelKey === 'serendipity') {
      // 세렌디피티: 번호 없이 💡 표시
      const item = channelItems[0];
      const summary = item.summary_ai ?? item.title;
      lines.push(`💡 <a href="${item.source_url}">${item.title}</a> — ${summary}`);
      continue;
    }

    // TORONTO(canada): 날씨 아이템은 목록 상단에 별도 형식으로
    if (channelKey === 'canada') {
      const weatherItems = channelItems.filter((i) => i.source === 'weather');
      const newsItems = channelItems.filter((i) => i.source !== 'weather');

      for (const w of weatherItems) {
        const summary = w.summary_ai ?? '';
        lines.push(`📍 날씨: ${summary}`);
      }

      let num = 1;
      for (const item of newsItems) {
        const summary = item.summary_ai ?? item.title;
        const score = (item.score_initial * 10).toFixed(1);
        lines.push(
          `${num}. <a href="${item.source_url}">${item.title}</a> — ${summary} (★${score})`,
        );
        num++;
      }
      continue;
    }

    // 일반 채널
    let num = 1;
    for (const item of channelItems) {
      const summary = item.summary_ai ?? item.title;
      const score = (item.score_initial * 10).toFixed(1);
      lines.push(
        `${num}. <a href="${item.source_url}">${item.title}</a> — ${summary} (★${score})`,
      );
      num++;
    }
  }

  return lines.join('\n');
}

// ─── createInlineKeyboard ────────────────────────────────────────────────────

/**
 * 브리핑 메시지용 인라인 키보드 생성
 * F-06 범위: [📖 웹에서 보기] 버튼 1개
 * F-07 구현 시 아이템별 반응 버튼으로 확장 예정
 */
export function createInlineKeyboard(webUrl: string): InlineButton[][] {
  return [
    [{ text: '📖 웹에서 보기', url: webUrl }],
  ];
}

// ─── selectBriefingItems ─────────────────────────────────────────────────────

/**
 * score_initial 기준 채널별 상위 N개 선정
 * 세렌디피티(F-23): 전 채널에서 랜덤 1개 stub 처리
 */
export function selectBriefingItems(items: BriefingItem[]): BriefingItem[] {
  const result: BriefingItem[] = [];

  // 채널별 그룹핑 + score 내림차순 정렬
  const byChannel = new Map<string, BriefingItem[]>();
  for (const item of items) {
    if (item.channel === 'serendipity') continue; // 직접 입력된 세렌디피티는 무시
    const arr = byChannel.get(item.channel) ?? [];
    arr.push(item);
    byChannel.set(item.channel, arr);
  }

  for (const [channel, channelItems] of Array.from(byChannel.entries())) {
    const limit = CHANNEL_LIMITS[channel];
    if (!limit) continue; // 알 수 없는 채널 무시

    // score_initial 내림차순 정렬
    const sorted = [...channelItems].sort((a, b) => b.score_initial - a.score_initial);
    const selected = sorted.slice(0, limit.max);
    result.push(...selected);
  }

  // 세렌디피티 stub: 전 채널 아이템 중 랜덤 1개 선택
  if (items.length > 0) {
    const randomIndex = Math.floor(Math.random() * items.length);
    const picked = items[randomIndex];
    result.push({
      ...picked,
      channel: 'serendipity',
    });
  }

  return result;
}

// ─── sendBriefing ────────────────────────────────────────────────────────────

/**
 * 브리핑 메시지 발송 (재시도 1회 포함)
 * AC6: 발송 실패 시 1회 재시도 후 에러를 throw
 */
export async function sendBriefing(
  text: string,
  webUrl: string,
): Promise<SendBriefingResult> {
  // getBotToken으로 환경변수 사전 검증 (에러를 즉시 throw)
  getBotToken();

  const inlineKeyboard = createInlineKeyboard(webUrl);

  const doSend = async (): Promise<SendBriefingResult> => {
    const token = getBotToken();
    const chatId = getChatId();

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    };

    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`텔레그램 메시지 발송 실패: ${error}`);
    }

    const data = (await response.json()) as { ok: boolean; result?: { message_id?: number } };
    return { messageId: data.result?.message_id };
  };

  try {
    return await doSend();
  } catch {
    // AC6: 1회 재시도
    return await doSend();
  }
}

// ─── 기존 유틸리티 (하위 호환) ───────────────────────────────────────────────

/**
 * 브리핑 아이템용 인라인 키보드 생성 (F-07 확장 예정)
 */
export function createBriefingKeyboard(
  contentId: string,
  webUrl: string,
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
  callbackData: string,
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
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`웹훅 등록 실패: ${error}`);
  }
}
