// F-07 텔레그램 웹훅 통합 테스트
// test-spec.md I-07-01 ~ I-07-07

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase 모킹 ──────────────────────────────────────────────────────────

let mockBriefingData: unknown = null;
let mockInteractionData: unknown = null;
let mockInterestData: unknown = null;
let mockAlertData: unknown = null;

const mockInsert = vi.fn().mockImplementation(() => ({
  select: vi.fn().mockResolvedValue({ data: [{ id: 'new-uuid' }], error: null }),
}));

const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });

function makeQueryChain(tableData: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: mockInsert,
    upsert: mockUpsert,
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: tableData, error: null }),
    single: vi.fn().mockResolvedValue({ data: tableData, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: tableData, error: null }),
  };
  return chain;
}

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'briefings') return makeQueryChain(mockBriefingData);
  if (table === 'user_interactions') return makeQueryChain(mockInteractionData);
  if (table === 'interest_profile') return makeQueryChain(mockInterestData);
  if (table === 'alert_settings') return makeQueryChain(mockAlertData);
  return makeQueryChain(null);
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── fetch (sendMessage) 모킹 ────────────────────────────────────────────────

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
  text: () => Promise.resolve('{"ok":true}'),
});

vi.stubGlobal('fetch', mockFetch);

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'test-webhook-secret';
const BOT_TOKEN = 'test-bot-token';
const CHAT_ID = '12345';

const mockBriefing = {
  id: 'briefing-uuid-001',
  briefing_date: '2026-02-28',
  items: [
    { content_id: 'content-uuid-001', position: 1, channel: 'tech' },
    { content_id: 'content-uuid-002', position: 2, channel: 'world' },
  ],
  telegram_sent_at: '2026-02-28T07:00:00Z',
  created_at: '2026-02-28T07:00:00Z',
};

// ─── 헬퍼 함수 ──────────────────────────────────────────────────────────────

function makeWebhookRequest(
  body: unknown,
  secret = WEBHOOK_SECRET,
): NextRequest {
  return new NextRequest('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify(body),
  });
}

function makeWebhookRequestNoAuth(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeCommandUpdate(text: string) {
  return {
    update_id: 123456789,
    message: {
      message_id: 1,
      from: { id: 12345, first_name: 'jsong' },
      chat: { id: 12345, type: 'private' },
      date: 1740700000,
      text,
    },
  };
}

function makeCallbackUpdate(data: string) {
  return {
    update_id: 123456790,
    callback_query: {
      id: 'cq-001',
      from: { id: 12345, first_name: 'jsong' },
      message: {
        message_id: 1,
        chat: { id: 12345, type: 'private' },
        date: 1740700000,
      },
      data,
    },
  };
}

// ─── I-07-01: 웹훅 인증 (AC8) ───────────────────────────────────────────────

describe('POST /api/telegram/webhook — 인증 (I-07-01)', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
    vi.resetModules();
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
    mockBriefingData = mockBriefing;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'briefings') return makeQueryChain(mockBriefingData);
      return makeQueryChain(null);
    });
  });

  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('I-07-01-1: X-Telegram-Bot-Api-Secret-Token 헤더가 없으면 401을 반환한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequestNoAuth(makeCommandUpdate('/good'));
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('I-07-01-2: 잘못된 시크릿 토큰이면 401을 반환한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/good'), 'wrong-secret');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('I-07-01-3: 올바른 시크릿 토큰이면 인증을 통과하고 200을 반환한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/good'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });
});

// ─── I-07-02: /good 명령어 흐름 (AC1) ──────────────────────────────────────

describe('POST /api/telegram/webhook — /good 명령어 (I-07-02)', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
    vi.resetModules();
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
    mockInsert.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'new-uuid' }], error: null }),
    }));
    mockBriefingData = mockBriefing;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'briefings') return makeQueryChain(mockBriefingData);
      if (table === 'user_interactions') return makeQueryChain(null);
      return makeQueryChain(null);
    });
  });

  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('I-07-02-1: /good 명령어 처리 후 sendMessage가 호출된다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/good'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    // fetch가 텔레그램 API 호출에 사용됨
    expect(mockFetch).toHaveBeenCalled();
    const fetchCallArgs = mockFetch.mock.calls[0];
    expect(fetchCallArgs[0]).toContain('sendMessage');
  });

  it('I-07-02-2: 브리핑이 없을 때 /good 명령어도 200을 반환한다', async () => {
    mockBriefingData = null;
    mockFrom.mockImplementation(() => makeQueryChain(null));

    const { POST } = await import('@/app/api/telegram/webhook/route');
    const request = makeWebhookRequest(makeCommandUpdate('/good'));
    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});

// ─── I-07-03: /save N 명령어 흐름 (AC3) ────────────────────────────────────

describe('POST /api/telegram/webhook — /save N 명령어 (I-07-03)', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
    vi.resetModules();
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
    mockInsert.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'new-uuid' }], error: null }),
    }));
    mockBriefingData = mockBriefing;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'briefings') return makeQueryChain(mockBriefingData);
      if (table === 'user_interactions') return makeQueryChain(null);
      return makeQueryChain(null);
    });
    vi.setSystemTime(new Date('2026-02-28T07:00:00+09:00'));
  });

  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.useRealTimers();
  });

  it('I-07-03-1: /save 1 명령어 처리 후 200을 반환하고 sendMessage가 호출된다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/save 1'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('I-07-03-2: /save (N 인자 없음) 명령어는 200을 반환하고 사용법 안내 메시지를 발송한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/save'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalled();
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.text).toContain('유효하지 않은');
  });
});

// ─── I-07-04: callback_query 처리 ──────────────────────────────────────────

describe('POST /api/telegram/webhook — callback_query 처리 (I-07-04)', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
    vi.resetModules();
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
    mockInsert.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'new-uuid' }], error: null }),
    }));
    mockFrom.mockImplementation(() => makeQueryChain(null));
  });

  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('I-07-04-1: like:uuid 콜백 처리 후 200을 반환하고 좋아요 반응을 INSERT한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCallbackUpdate('like:content-uuid-001'));
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_interactions');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: '좋아요',
        source: 'telegram_bot',
      }),
    );
  });

  it('I-07-04-2: dislike:uuid 콜백 처리 후 싫어요 반응을 INSERT한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCallbackUpdate('dislike:content-uuid-001'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: '싫어요',
        source: 'telegram_bot',
      }),
    );
  });

  it('I-07-04-3: save:uuid 콜백 처리 후 저장 반응을 INSERT한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCallbackUpdate('save:content-uuid-001'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: '저장',
        source: 'telegram_bot',
      }),
    );
  });

  it('I-07-04-4: 잘못된 형식의 콜백 데이터는 200을 반환하고 처리를 무시한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCallbackUpdate('invalid-format'));
    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});

// ─── I-07-05: /keyword 명령어 흐름 (AC5) ───────────────────────────────────

describe('POST /api/telegram/webhook — /keyword 명령어 (I-07-05)', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
    vi.resetModules();
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
    mockUpsert.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation(() => {
      const chain = makeQueryChain(null);
      chain.upsert = mockUpsert;
      return chain;
    });
  });

  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('I-07-05-1: /keyword LLM 명령어 처리 후 interest_profile에 UPSERT하고 200을 반환한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/keyword LLM'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('interest_profile');
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('I-07-05-2: /keyword (인자 없음) 명령어는 200을 반환하고 안내 메시지를 발송한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/keyword'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.text).toContain('키워드');
  });
});

// ─── I-07-06: /stats 명령어 흐름 (AC6) ─────────────────────────────────────

describe('POST /api/telegram/webhook — /stats 명령어 (I-07-06)', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
    vi.resetModules();
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
    vi.setSystemTime(new Date('2026-02-28T07:00:00+09:00'));

    const mockTopics = [{ topic: 'LLM', score: 0.85 }];
    const mockInteractions = [{ id: '1' }, { id: '2' }];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'interest_profile') return makeQueryChain(mockTopics);
      if (table === 'user_interactions') return makeQueryChain(mockInteractions);
      return makeQueryChain(null);
    });
  });

  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.useRealTimers();
  });

  it('I-07-06-1: /stats 명령어 처리 후 통계 메시지를 포함한 sendMessage가 호출된다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/stats'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalled();
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.text).toContain('통계');
  });
});

// ─── I-07-07: /mute 명령어 흐름 (AC7) ──────────────────────────────────────

describe('POST /api/telegram/webhook — /mute 명령어 (I-07-07)', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
    vi.resetModules();
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
    mockUpsert.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation(() => {
      const chain = makeQueryChain(null);
      chain.upsert = mockUpsert;
      return chain;
    });
  });

  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('I-07-07-1: /mute 3 명령어 처리 후 alert_settings에 UPSERT하고 200을 반환한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/mute 3'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('alert_settings');
    expect(mockUpsert).toHaveBeenCalled();
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.text).toContain('3');
  });

  it('I-07-07-2: /mute (인자 없음) 명령어는 200을 반환하고 사용법 안내를 발송한다', async () => {
    const { POST } = await import('@/app/api/telegram/webhook/route');

    const request = makeWebhookRequest(makeCommandUpdate('/mute'));
    const response = await POST(request);

    expect(response.status).toBe(200);
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.text).toBeTruthy();
  });
});
