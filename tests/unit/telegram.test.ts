// F-06 텔레그램 브리핑 발송 — 단위 테스트
// test-spec.md U-01 ~ U-05

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// fetch 전역 모킹
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  formatBriefingMessage,
  createInlineKeyboard,
  selectBriefingItems,
  sendBriefing,
  type BriefingItem,
} from '@/lib/telegram';

// ─── 테스트 픽스처 ──────────────────────────────────────────────────────────

function makeTechItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'tech-1',
    channel: 'tech',
    source: 'hackernews',
    source_url: 'https://news.ycombinator.com/item?id=1',
    title: 'LLM 인프라 최적화 가이드',
    summary_ai: 'LLM 서빙 비용을 50% 절감하는 실전 전략',
    score_initial: 0.85,
    ...overrides,
  };
}

function makeWorldItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'world-1',
    channel: 'world',
    source: 'naver_news',
    source_url: 'https://n.news.naver.com/1',
    title: '한국 경제 성장률 전망',
    summary_ai: '2026년 한국 경제 성장률 2.3% 예상, 수출 회복 기조 지속',
    score_initial: 0.72,
    ...overrides,
  };
}

function makeCultureItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'culture-1',
    channel: 'culture',
    source: 'melon',
    source_url: 'https://www.melon.com/song/detail.htm?songId=1',
    title: '아이유 - Love wins all',
    summary_ai: '아이유 신곡이 멜론 1위 달성, 24시간 스트리밍 신기록',
    score_initial: 0.78,
    ...overrides,
  };
}

function makeCanadaItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'canada-1',
    channel: 'canada',
    source: 'cbc',
    source_url: 'https://www.cbc.ca/news/canada/toronto/1',
    title: '토론토 교통 시스템 개편 발표',
    summary_ai: 'TTC가 2026년 하반기 요금 인상 및 노선 개편 계획 발표',
    score_initial: 0.81,
    ...overrides,
  };
}

function makeWeatherItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'weather-1',
    channel: 'canada',
    source: 'weather',
    source_url: 'https://openweathermap.org/toronto',
    title: '토론토 날씨',
    summary_ai: '맑음 -3°C',
    score_initial: 0.9,
    ...overrides,
  };
}

// ─── U-01: formatBriefingMessage ────────────────────────────────────────────

describe('formatBriefingMessage', () => {
  beforeEach(() => {
    // 테스트 날짜를 고정 (2026-02-28 금요일)
    vi.setSystemTime(new Date('2026-02-28T07:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('U-01-1: 5채널 모두 아이템이 있는 경우 각 채널 헤더가 포함된다', () => {
    const items: BriefingItem[] = [
      makeTechItem(),
      makeWorldItem(),
      makeCultureItem(),
      makeCanadaItem(),
      // 세렌디피티는 channel='serendipity' 또는 별도 처리
      makeTechItem({ id: 'serendipity-1', channel: 'serendipity' }),
    ];

    const message = formatBriefingMessage(items);

    expect(message).toContain('🖥️ TECH');
    expect(message).toContain('🌍 WORLD');
    expect(message).toContain('🎬 CULTURE');
    expect(message).toContain('🍁 TORONTO');
    expect(message).toContain('🎲 세렌디피티');
  });

  it('U-01-2: TECH 채널 아이템에 번호, 링크, 요약, 스코어가 포함된다', () => {
    const techItem = makeTechItem({ score_initial: 0.85 });
    const message = formatBriefingMessage([techItem]);

    expect(message).toContain('1.');
    expect(message).toContain(`href="${techItem.source_url}"`);
    expect(message).toContain(techItem.title);
    expect(message).toContain(techItem.summary_ai);
    expect(message).toContain('★8.5');
  });

  it('U-01-3: 날씨 아이템(source=weather)은 📍 날씨 형식으로 표시된다', () => {
    const weatherItem = makeWeatherItem();
    const message = formatBriefingMessage([weatherItem]);

    expect(message).toContain('📍 날씨:');
    expect(message).toContain('맑음 -3°C');
    // 날씨 아이템에는 목록 번호가 없어야 함
    expect(message).not.toMatch(/\n1\. .*맑음/);
  });

  it('U-01-4: TORONTO 채널에 날씨와 뉴스가 혼합된 경우 날씨가 먼저 표시된다', () => {
    const weatherItem = makeWeatherItem();
    const newsItem = makeCanadaItem({ score_initial: 0.81 });
    const message = formatBriefingMessage([weatherItem, newsItem]);

    const weatherPos = message.indexOf('📍 날씨:');
    const newsPos = message.indexOf('1.');

    expect(weatherPos).toBeGreaterThanOrEqual(0);
    expect(newsPos).toBeGreaterThan(weatherPos);
  });

  it('U-01-5: HTML 형식의 <a href> 링크 태그가 포함된다', () => {
    const item = makeTechItem();
    const message = formatBriefingMessage([item]);

    expect(message).toMatch(/<a href="https:\/\/.+?">/);
    expect(message).toContain('</a>');
  });

  it('U-01-6: 날짜 헤더가 🌅 YYYY.MM.DD 요일 모닝 브리핑 형식이다', () => {
    const message = formatBriefingMessage([makeTechItem()]);

    expect(message).toMatch(/🌅 2026\.02\.28 .+ 모닝 브리핑/);
  });
});

// ─── U-02: createInlineKeyboard ─────────────────────────────────────────────

describe('createInlineKeyboard', () => {
  it('U-02-1: 웹 URL로 [📖 웹에서 보기] 버튼 배열을 반환한다', () => {
    const webUrl = 'https://cortex.example.com';
    const keyboard = createInlineKeyboard(webUrl);

    expect(keyboard).toHaveLength(1);
    expect(keyboard[0]).toHaveLength(1);
    expect(keyboard[0][0]).toEqual({
      text: '📖 웹에서 보기',
      url: webUrl,
    });
  });

  it('U-02-2: InlineButton[][] 형식으로 반환된다', () => {
    const keyboard = createInlineKeyboard('https://example.com');

    expect(Array.isArray(keyboard)).toBe(true);
    expect(Array.isArray(keyboard[0])).toBe(true);
    expect(typeof keyboard[0][0].text).toBe('string');
    expect(typeof keyboard[0][0].url).toBe('string');
  });
});

// ─── U-03: selectBriefingItems ──────────────────────────────────────────────

describe('selectBriefingItems', () => {
  it('U-03-1: TECH 5개 입력 시 score_initial 기준 상위 3개만 반환된다', () => {
    const items: BriefingItem[] = [
      makeTechItem({ id: 't1', score_initial: 0.5 }),
      makeTechItem({ id: 't2', score_initial: 0.9 }),
      makeTechItem({ id: 't3', score_initial: 0.7 }),
      makeTechItem({ id: 't4', score_initial: 0.6 }),
      makeTechItem({ id: 't5', score_initial: 0.8 }),
    ];

    const result = selectBriefingItems(items);
    const techItems = result.filter((i) => i.channel === 'tech');

    expect(techItems).toHaveLength(3);
    expect(techItems[0].id).toBe('t2'); // score 0.9
    expect(techItems[1].id).toBe('t5'); // score 0.8
    expect(techItems[2].id).toBe('t3'); // score 0.7
  });

  it('U-03-2: WORLD 3개 입력 시 score_initial 기준 상위 2개만 반환된다', () => {
    const items: BriefingItem[] = [
      makeWorldItem({ id: 'w1', score_initial: 0.6 }),
      makeWorldItem({ id: 'w2', score_initial: 0.9 }),
      makeWorldItem({ id: 'w3', score_initial: 0.7 }),
    ];

    const result = selectBriefingItems(items);
    const worldItems = result.filter((i) => i.channel === 'world');

    expect(worldItems).toHaveLength(2);
    expect(worldItems[0].id).toBe('w2'); // score 0.9
    expect(worldItems[1].id).toBe('w3'); // score 0.7
  });

  it('U-03-3: CULTURE 1개 입력 시 최소 1개가 반환된다', () => {
    const items: BriefingItem[] = [
      makeCultureItem({ id: 'c1', score_initial: 0.6 }),
    ];

    const result = selectBriefingItems(items);
    const cultureItems = result.filter((i) => i.channel === 'culture');

    expect(cultureItems).toHaveLength(1);
  });

  it('U-03-4: TORONTO 4개 입력 시 score_initial 기준 상위 2개만 반환된다 (F-16 평일 기본)', () => {
    // F-16: 평일 모드 기본값 — canada max:2
    const items: BriefingItem[] = [
      makeCanadaItem({ id: 'ca1', score_initial: 0.5 }),
      makeCanadaItem({ id: 'ca2', score_initial: 0.9 }),
      makeCanadaItem({ id: 'ca3', score_initial: 0.7 }),
      makeCanadaItem({ id: 'ca4', score_initial: 0.8 }),
    ];

    const result = selectBriefingItems(items);
    const canadaItems = result.filter((i) => i.channel === 'canada');

    expect(canadaItems).toHaveLength(2);
  });

  it('U-03-5: 빈 채널 아이템 입력 시 에러 없이 빈 배열을 반환한다', () => {
    const items: BriefingItem[] = [
      makeTechItem(), // tech만 있음
    ];

    expect(() => selectBriefingItems(items)).not.toThrow();
    const result = selectBriefingItems(items);
    const worldItems = result.filter((i) => i.channel === 'world');
    expect(worldItems).toHaveLength(0);
  });

  it('U-03-6: 세렌디피티 stub은 전 채널에서 랜덤 1개를 선택한다', () => {
    const items: BriefingItem[] = [
      makeTechItem({ id: 't1' }),
      makeWorldItem({ id: 'w1' }),
      makeCultureItem({ id: 'c1' }),
    ];

    const result = selectBriefingItems(items);
    const serendipityItems = result.filter((i) => i.channel === 'serendipity');

    expect(serendipityItems).toHaveLength(1);
  });

  it('U-03-7: 반환된 아이템들이 채널 내에서 score_initial 내림차순으로 정렬된다', () => {
    const items: BriefingItem[] = [
      makeTechItem({ id: 't1', score_initial: 0.5 }),
      makeTechItem({ id: 't2', score_initial: 0.9 }),
      makeTechItem({ id: 't3', score_initial: 0.7 }),
    ];

    const result = selectBriefingItems(items);
    const techItems = result.filter((i) => i.channel === 'tech');

    for (let i = 1; i < techItems.length; i++) {
      expect(techItems[i - 1].score_initial).toBeGreaterThanOrEqual(
        techItems[i].score_initial,
      );
    }
  });
});

// ─── U-04: sendBriefing ─────────────────────────────────────────────────────

describe('sendBriefing', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = '123456789';
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  const makeSuccessResponse = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });

  const makeFailResponse = () =>
    Promise.resolve({
      ok: false,
      text: () => Promise.resolve('Bad Request: message text is empty'),
    });

  it('U-04-1: 정상 발송 시 fetch가 1회 호출된다', async () => {
    mockFetch.mockReturnValueOnce(makeSuccessResponse());

    await sendBriefing('테스트 메시지', 'https://cortex.example.com');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.any(Object),
    );
  });

  it('U-04-2: 1차 실패 후 2차 성공 시 fetch가 2회 호출된다', async () => {
    mockFetch
      .mockReturnValueOnce(makeFailResponse())
      .mockReturnValueOnce(makeSuccessResponse());

    await sendBriefing('테스트 메시지', 'https://cortex.example.com');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('U-04-3: 1차, 2차 모두 실패 시 에러를 throw한다', async () => {
    mockFetch
      .mockReturnValueOnce(makeFailResponse())
      .mockReturnValueOnce(makeFailResponse());

    await expect(
      sendBriefing('테스트 메시지', 'https://cortex.example.com'),
    ).rejects.toThrow();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('U-04-4: 요청 body에 parse_mode: HTML이 포함된다', async () => {
    mockFetch.mockReturnValueOnce(makeSuccessResponse());

    await sendBriefing('테스트 메시지', 'https://cortex.example.com');

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.parse_mode).toBe('HTML');
  });

  it('U-04-5: 요청 body에 reply_markup.inline_keyboard가 포함된다', async () => {
    mockFetch.mockReturnValueOnce(makeSuccessResponse());

    await sendBriefing('테스트 메시지', 'https://cortex.example.com');

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.reply_markup).toBeDefined();
    expect(body.reply_markup.inline_keyboard).toBeDefined();
    expect(Array.isArray(body.reply_markup.inline_keyboard)).toBe(true);
  });

  it('U-04-6: TELEGRAM_BOT_TOKEN 환경변수가 없으면 에러를 throw한다', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    await expect(
      sendBriefing('테스트 메시지', 'https://cortex.example.com'),
    ).rejects.toThrow('TELEGRAM_BOT_TOKEN');
  });
});

// ─── U-05: 빈 아이템 시 채널 섹션 생략 ─────────────────────────────────────

describe('formatBriefingMessage — 빈 채널 섹션 생략', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-02-28T07:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('U-05-1: CULTURE 아이템이 없으면 🎬 CULTURE 섹션이 메시지에 없다', () => {
    const items: BriefingItem[] = [
      makeTechItem(),
      makeWorldItem(),
      // culture 없음
      makeCanadaItem(),
    ];

    const message = formatBriefingMessage(items);

    expect(message).not.toContain('🎬 CULTURE');
  });

  it('U-05-2: WORLD 아이템이 없으면 🌍 WORLD 섹션이 메시지에 없다', () => {
    const items: BriefingItem[] = [
      makeTechItem(),
      // world 없음
      makeCultureItem(),
      makeCanadaItem(),
    ];

    const message = formatBriefingMessage(items);

    expect(message).not.toContain('🌍 WORLD');
  });

  it('U-05-3: 아이템이 전혀 없으면 날짜 헤더만 포함된 최소 메시지를 반환한다', () => {
    const message = formatBriefingMessage([]);

    expect(message).toContain('모닝 브리핑');
    expect(message).not.toContain('🖥️ TECH');
    expect(message).not.toContain('🌍 WORLD');
    expect(message).not.toContain('🎬 CULTURE');
    expect(message).not.toContain('🍁 TORONTO');
  });
});
