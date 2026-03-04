// 텔레그램 봇 유틸리티 (발송, 포매팅, 인라인 키보드)
// 모든 텔레그램 API 호출은 이 모듈을 통해 수행
// F-06 설계서: docs/specs/F-06-telegram-briefing/design.md
// F-16 설계서: 평일/주말 브리핑 분리

const TELEGRAM_API_BASE = 'https://api.telegram.org';

// 요일 표기 (KST)
const DAY_NAMES_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// ─── F-16: 브리핑 모드 타입 ───────────────────────────────────────────────────

/** 브리핑 발송 모드 (평일 vs 주말) */
export type BriefingMode = 'weekday' | 'weekend';

// 채널별 선정 한도 (평일 모드 기본)
const CHANNEL_LIMITS_WEEKDAY: Record<string, { min: number; max: number }> = {
  tech:    { min: 2, max: 3 },
  world:   { min: 1, max: 2 },
  culture: { min: 1, max: 1 },
  canada:  { min: 1, max: 2 },
};

// 채널별 선정 한도 (주말 모드: 5개 엄선)
const CHANNEL_LIMITS_WEEKEND: Record<string, { min: number; max: number }> = {
  tech:    { min: 1, max: 2 },
  world:   { min: 1, max: 1 },
  culture: { min: 1, max: 1 },
  canada:  { min: 1, max: 1 },
};

// 하위 호환용 기본 한도 (평일 모드와 동일)
const CHANNEL_LIMITS: Record<string, { min: number; max: number }> = CHANNEL_LIMITS_WEEKDAY;

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
  channel: string;              // 'tech' | 'world' | 'culture' | 'canada' | 'serendipity'
  source: string;               // 'hackernews' | 'weather' | 'cbc' 등
  source_url: string;
  title: string;
  summary_ai: string | null;
  score_initial: number;
  tags?: string[];
  /** F-16: 주말 포맷용 3줄 확장 요약 (없으면 summary_ai 폴백) */
  extended_summary?: string;
  /** F-16: 주말 포맷용 "왜 중요한가" 설명 */
  why_important?: string;
  /** F-18: My Life OS 컨텍스트 매칭 이유 (있을 때만 표시) */
  reason?: string;
  /** 원문 발행 시각 (recencyScore 계산용) */
  published_at?: string | null;
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
  const kstNoon = new Date(`${kstDateStr}T12:00:00+09:00`);
  const yearMonth = kstDateStr.slice(0, 7).replace('-', '.'); // 'YYYY.MM'
  const day = kstDateStr.slice(8, 10); // 'DD'
  const dayName = DAY_NAMES_KO[kstNoon.getUTCDay()];

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
      // F-18 AC4: My Life OS 컨텍스트 매칭 이유 표시
      if (item.reason) {
        lines.push(`   💡 ${item.reason}`);
      }
      num++;
    }
  }

  return lines.join('\n');
}

// ─── KST 날짜 헤더 생성 공통 헬퍼 ───────────────────────────────────────────

/**
 * KST 기준 날짜 헤더 문자열 생성
 * 반환 형식: "🌅 YYYY.MM.DD 요일 {label}"
 */
function buildDateHeader(label: string): string {
  const now = new Date();
  const kstDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // 'YYYY-MM-DD'
  const kstNoon = new Date(`${kstDateStr}T12:00:00+09:00`);
  const yearMonth = kstDateStr.slice(0, 7).replace('-', '.'); // 'YYYY.MM'
  const day = kstDateStr.slice(8, 10); // 'DD'
  const dayName = DAY_NAMES_KO[kstNoon.getUTCDay()];
  return `🌅 ${yearMonth}.${day} ${dayName} ${label}`;
}

/**
 * 채널별 아이템 그룹핑 헬퍼
 */
function groupByChannel(items: BriefingItem[]): Map<string, BriefingItem[]> {
  const byChannel = new Map<string, BriefingItem[]>();
  for (const item of items) {
    const arr = byChannel.get(item.channel) ?? [];
    arr.push(item);
    byChannel.set(item.channel, arr);
  }
  return byChannel;
}

// ─── formatWeekdayBriefing ───────────────────────────────────────────────────

/**
 * 평일 브리핑 HTML 메시지 생성 (F-16 AC1)
 * 포맷: 제목 + 1줄 요약 + 스코어(★)
 * 채널 순서: TECH → WORLD → CULTURE → TORONTO → 세렌디피티
 * 빈 채널은 섹션 자체를 생략
 */
export function formatWeekdayBriefing(items: BriefingItem[]): string {
  const lines: string[] = [];
  lines.push(buildDateHeader('모닝 브리핑'));

  const byChannel = groupByChannel(items);

  for (const channelKey of CHANNEL_ORDER) {
    const channelItems = byChannel.get(channelKey);
    if (!channelItems || channelItems.length === 0) continue;

    const header = CHANNEL_HEADERS[channelKey];
    lines.push('');
    lines.push(header);

    if (channelKey === 'serendipity') {
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
      // F-18 AC4: My Life OS 컨텍스트 매칭 이유 표시
      if (item.reason) {
        lines.push(`   💡 ${item.reason}`);
      }
      num++;
    }
  }

  return lines.join('\n');
}

// ─── formatWeekendBriefing ───────────────────────────────────────────────────

/**
 * 주말 브리핑 HTML 메시지 생성 (F-16 AC2)
 * 포맷: 제목 + 3줄 요약 + "왜 중요한가" 섹션 (스코어 없음)
 * 채널 순서: TECH → WORLD → CULTURE → TORONTO → 세렌디피티
 * 빈 채널은 섹션 자체를 생략
 */
export function formatWeekendBriefing(items: BriefingItem[]): string {
  const lines: string[] = [];
  lines.push(buildDateHeader('모닝 브리핑'));

  const byChannel = groupByChannel(items);

  for (const channelKey of CHANNEL_ORDER) {
    const channelItems = byChannel.get(channelKey);
    if (!channelItems || channelItems.length === 0) continue;

    const header = CHANNEL_HEADERS[channelKey];
    lines.push('');
    lines.push(header);

    if (channelKey === 'serendipity') {
      const item = channelItems[0];
      const summary = item.summary_ai ?? item.title;
      lines.push(`💡 <a href="${item.source_url}">${item.title}</a> — ${summary}`);
      continue;
    }

    let num = 1;
    for (const item of channelItems) {
      // 3줄 요약: extended_summary 우선, 없으면 summary_ai 폴백
      const summary = item.extended_summary ?? item.summary_ai ?? item.title;
      lines.push(`${num}. <a href="${item.source_url}">${item.title}</a>`);
      lines.push(summary);

      // "왜 중요한가" 섹션 (있을 때만)
      if (item.why_important) {
        lines.push(`❓ <b>왜 중요한가</b>: ${item.why_important}`);
      }

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

// ─── isWeekend ───────────────────────────────────────────────────────────────

/**
 * KST 기준 주말(토/일) 여부 판단 (F-16)
 * @param date 기준 날짜 (기본값: 현재 시각)
 */
export function isWeekend(date: Date = new Date()): boolean {
  // KST = UTC+9, en-CA locale은 YYYY-MM-DD 형식을 보장
  const kstDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const kstNoon = new Date(`${kstDateStr}T12:00:00+09:00`);
  const dayOfWeek = kstNoon.getUTCDay(); // 0: 일, 6: 토
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// ─── selectBriefingItems ─────────────────────────────────────────────────────

/**
 * score_initial 기준 채널별 상위 N개 선정
 * 세렌디피티(F-23): 역가중치 기반 확률적 선정 (관심사 인접 영역 우선)
 * F-16: mode 파라미터로 평일/주말 아이템 수 분기 (기본값: 'weekday')
 *
 * @param items 전체 브리핑 후보 아이템
 * @param mode 평일/주말 모드
 * @param interestProfile 관심 프로필 (없으면 빈 Map → 동등한 확률)
 */
export function selectBriefingItems(
  items: BriefingItem[],
  mode: BriefingMode = 'weekday',
  interestProfile: Map<string, number> = new Map(),
): BriefingItem[] {
  const result: BriefingItem[] = [];

  // 모드별 한도 선택
  const limits = mode === 'weekend' ? CHANNEL_LIMITS_WEEKEND : CHANNEL_LIMITS_WEEKDAY;

  // 채널별 그룹핑 + score 내림차순 정렬
  const byChannel = new Map<string, BriefingItem[]>();
  for (const item of items) {
    if (item.channel === 'serendipity') continue; // 직접 입력된 세렌디피티는 무시
    const arr = byChannel.get(item.channel) ?? [];
    arr.push(item);
    byChannel.set(item.channel, arr);
  }

  const selectedIds = new Set<string>();

  for (const [channel, channelItems] of Array.from(byChannel.entries())) {
    const limit = limits[channel];
    if (!limit) continue; // 알 수 없는 채널 무시

    // score_initial 내림차순 정렬
    const sorted = [...channelItems].sort((a, b) => b.score_initial - a.score_initial);
    const selected = sorted.slice(0, limit.max);
    result.push(...selected);
    selected.forEach((item) => selectedIds.add(item.id));
  }

  // F-23 세렌디피티: 역가중치 기반 확률적 선정
  // 이미 선정된 아이템을 excludeIds로 전달하여 중복 방지
  if (items.length > 0) {
    // 동적 import 대신 serendipity 로직을 인라인으로 실행
    // (함수형 모듈 분리: buildSerendipityPool + selectSerendipityItem은 lib/serendipity.ts에 있음)
    const nonSerendipityItems = items.filter((item) => item.channel !== 'serendipity');
    if (nonSerendipityItems.length > 0) {
      // 역가중치 계산 (인라인, 순환 참조 없이)
      const candidates = nonSerendipityItems.map((item) => {
        const tags = item.tags ?? [];
        const scores = tags.map((tag) => interestProfile.get(tag) ?? 0);
        const avgInterest =
          tags.length > 0
            ? scores.reduce((sum, s) => sum + s, 0) / scores.length
            : 0;
        const inverseWeight = 1.0 - avgInterest + 0.2;
        return { item, inverseWeight };
      });

      // excludeIds(이미 선정된 아이템) 제외
      const eligibleCandidates = candidates.filter((c) => !selectedIds.has(c.item.id));
      const pool = eligibleCandidates.length > 0 ? eligibleCandidates : candidates;

      // 룰렛 휠 선택
      const totalWeight = pool.reduce((sum, c) => sum + c.inverseWeight, 0);
      const threshold = Math.random() * totalWeight;
      let accumulated = 0;
      let picked = pool[pool.length - 1].item;

      for (const { item, inverseWeight } of pool) {
        accumulated += inverseWeight;
        if (accumulated > threshold) {
          picked = item;
          break;
        }
      }

      result.push({
        ...picked,
        channel: 'serendipity',
      });
    }
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
