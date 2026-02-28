// F-06 통합 테스트 — cron/send-briefing route
// test-spec.md I-01 ~ I-02

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── fetch 전역 모킹 ────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Supabase 모킹 ──────────────────────────────────────────────────────────
// 쿼리 최종 해결값을 제어할 수 있는 resolveWith 함수
let supabaseQueryResolve: () => Promise<{ data: unknown[]; error: null | { message: string } }> =
  () => Promise.resolve({ data: [], error: null });

let insertResolve: () => Promise<{ data: unknown; error: null | { message: string } }> =
  () => Promise.resolve({ data: [{ id: 'briefing-uuid' }], error: null });

// Supabase 체인 — 마지막 order/gte가 Promise를 반환
const makeChain = () => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockImplementation(() => insertResolve()),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  order: vi.fn().mockImplementation(function (this: unknown) {
    // 두 번째 order 호출이 실제 쿼리 마지막 → Promise 반환
    return supabaseQueryResolve();
  }),
});

let currentChain = makeChain();
const mockFrom = vi.fn().mockImplementation(() => currentChain);

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const mockContentItems = [
  {
    id: 'tech-uuid-1',
    channel: 'tech',
    source: 'hackernews',
    source_url: 'https://news.ycombinator.com/item?id=1',
    title: 'LLM 인프라 최적화 가이드',
    summary_ai: 'LLM 서빙 비용을 50% 절감하는 실전 전략',
    score_initial: 0.85,
    tags: ['LLM', 'infrastructure'],
  },
  {
    id: 'tech-uuid-2',
    channel: 'tech',
    source: 'github',
    source_url: 'https://github.com/example/repo',
    title: 'Rust로 구현된 초고속 HTTP 서버',
    summary_ai: 'Node.js 대비 3배 빠른 Rust 기반 HTTP 서버 벤치마크 공개',
    score_initial: 0.78,
    tags: ['Rust', 'performance'],
  },
  {
    id: 'world-uuid-1',
    channel: 'world',
    source: 'naver_news',
    source_url: 'https://n.news.naver.com/1',
    title: '한국 경제 성장률 전망 상향',
    summary_ai: '2026년 한국 경제 성장률 2.3% → 2.7%로 상향 조정',
    score_initial: 0.72,
    tags: ['economy', 'korea'],
  },
  {
    id: 'canada-uuid-1',
    channel: 'canada',
    source: 'weather',
    source_url: 'https://openweathermap.org/toronto',
    title: '토론토 날씨',
    summary_ai: '맑음 -3°C',
    score_initial: 0.9,
    tags: ['weather'],
  },
  {
    id: 'canada-uuid-2',
    channel: 'canada',
    source: 'cbc',
    source_url: 'https://www.cbc.ca/news/1',
    title: '토론토 TTC 파업 예고',
    summary_ai: '토론토 시내버스 운전기사 노조가 다음 주 파업을 예고했다',
    score_initial: 0.88,
    tags: ['toronto', 'transit'],
  },
];

// ─── 헬퍼 함수 ──────────────────────────────────────────────────────────────

const makeTelegramSuccess = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
    text: () => Promise.resolve('{"ok":true}'),
  });

const makeTelegramFail = () =>
  Promise.resolve({
    ok: false,
    text: () => Promise.resolve('Bad Request'),
  });

const makeRequest = (secret = 'test-cron-secret-123') =>
  new NextRequest('http://localhost/api/cron/send-briefing', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });

const makeRequestNoAuth = () =>
  new NextRequest('http://localhost/api/cron/send-briefing', {
    method: 'POST',
  });

// ─── I-01: CRON_SECRET 인증 ─────────────────────────────────────────────────

describe('GET /api/cron/send-briefing — 인증', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret-123';
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = '123456789';
    vi.resetModules();
    mockFetch.mockReset();
    currentChain = makeChain();
    mockFrom.mockImplementation(() => currentChain);
    supabaseQueryResolve = () => Promise.resolve({ data: [], error: null });
    insertResolve = () => Promise.resolve({ data: [{ id: 'briefing-uuid' }], error: null });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('I-01-1: Authorization 헤더가 없으면 401을 반환한다', async () => {
    const { GET } = await import('@/app/api/cron/send-briefing/route');

    const request = makeRequestNoAuth();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Unauthorized');
  });

  it('I-01-2: 잘못된 CRON_SECRET이면 401을 반환한다', async () => {
    const { GET } = await import('@/app/api/cron/send-briefing/route');

    const request = makeRequest('wrong-secret');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('I-01-3: 올바른 CRON_SECRET이면 인증을 통과하여 처리가 진행된다', async () => {
    supabaseQueryResolve = () => Promise.resolve({ data: [], error: null });

    const { GET } = await import('@/app/api/cron/send-briefing/route');
    const request = makeRequest();
    const response = await GET(request);

    expect(response.status).not.toBe(401);
  });
});

// ─── I-02: 전체 발송 흐름 ───────────────────────────────────────────────────

describe('GET /api/cron/send-briefing — 발송 흐름', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret-123';
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = '123456789';
    vi.resetModules();
    mockFetch.mockReset();
    currentChain = makeChain();
    mockFrom.mockImplementation(() => currentChain);
    supabaseQueryResolve = () => Promise.resolve({ data: mockContentItems, error: null });
    insertResolve = () => Promise.resolve({ data: [{ id: 'briefing-uuid' }], error: null });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.useRealTimers();
  });

  it('I-02-1: 정상 흐름 — Supabase 조회 → 발송 → briefings INSERT → 200 성공', async () => {
    mockFetch.mockReturnValue(makeTelegramSuccess());

    const { GET } = await import('@/app/api/cron/send-briefing/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.telegram_sent).toBe(true);
  });

  it('I-02-2: 응답 구조가 { success, data: { briefing_date, items_count, telegram_sent, channels } }이다', async () => {
    mockFetch.mockReturnValue(makeTelegramSuccess());

    const { GET } = await import('@/app/api/cron/send-briefing/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('briefing_date');
    expect(data.data).toHaveProperty('items_count');
    expect(data.data).toHaveProperty('telegram_sent');
    expect(data.data).toHaveProperty('channels');
    expect(typeof data.data.items_count).toBe('number');
    expect(typeof data.data.telegram_sent).toBe('boolean');
    expect(typeof data.data.channels).toBe('object');
  });

  it('I-02-3: briefings 테이블에 INSERT가 호출된다', async () => {
    mockFetch.mockReturnValue(makeTelegramSuccess());
    const insertSpy = vi.fn().mockResolvedValue({ data: [{ id: 'briefing-uuid' }], error: null });
    currentChain.insert = insertSpy;

    const { GET } = await import('@/app/api/cron/send-briefing/route');
    await GET(makeRequest());

    // from('briefings')에서 insert가 호출됐는지 확인
    expect(mockFrom).toHaveBeenCalledWith('briefings');
    expect(insertSpy).toHaveBeenCalled();
    const insertArg = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg).toHaveProperty('briefing_date');
    expect(insertArg).toHaveProperty('items');
    expect(insertArg).toHaveProperty('telegram_sent_at');
  });

  it('I-02-4: Telegram 발송이 2회 모두 실패하면 에러를 로깅하고 500을 반환한다', async () => {
    mockFetch.mockReturnValue(makeTelegramFail());

    const { GET } = await import('@/app/api/cron/send-briefing/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it('I-02-5: 오늘 아이템이 없으면 items_count: 0, telegram_sent: false를 반환한다', async () => {
    supabaseQueryResolve = () => Promise.resolve({ data: [], error: null });

    const { GET } = await import('@/app/api/cron/send-briefing/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.items_count).toBe(0);
    expect(data.data.telegram_sent).toBe(false);
  });
});
