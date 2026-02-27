// F-08 GET /api/briefings/today 단위 테스트
// test-spec.md U-08-06 ~ U-08-07

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

let mockBriefing: Record<string, unknown> | null = null;
let mockContentItems: Record<string, unknown>[] = [];
let mockInteractions: Record<string, unknown>[] = [];

const mockMaybeSingle = vi.fn().mockImplementation(async () => ({
  data: mockBriefing,
  error: null,
}));

const mockContentItemsSelect = vi.fn().mockImplementation(async () => ({
  data: mockContentItems,
  error: null,
}));

const mockInteractionsSelect = vi.fn().mockImplementation(async () => ({
  data: mockInteractions,
  error: null,
}));

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'briefings') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    };
  }
  if (table === 'content_items') {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation(async () => ({ data: mockContentItems, error: null })),
    };
  }
  if (table === 'user_interactions') {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation(async () => ({ data: mockInteractions, error: null })),
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── KST 날짜 유틸 모킹 ─────────────────────────────────────────────────────

vi.mock('@/lib/utils/date', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/utils/date')>();
  return {
    ...original,
    getTodayKST: vi.fn().mockReturnValue('2026-02-28'),
  };
});

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const SAMPLE_BRIEFING = {
  id: 'briefing-uuid-001',
  briefing_date: '2026-02-28',
  items: [
    { content_id: 'content-uuid-001', position: 1, channel: 'tech', reason: null },
    { content_id: 'content-uuid-002', position: 2, channel: 'world', reason: '지난주 메모 관련' },
  ],
  telegram_sent_at: '2026-02-28T07:00:00Z',
  created_at: '2026-02-28T07:00:00Z',
};

const SAMPLE_CONTENT_ITEMS = [
  {
    id: 'content-uuid-001',
    title: 'OpenAI GPT-5 출시',
    summary_ai: 'GPT-5 관련 요약',
    source: 'hackernews',
    source_url: 'https://hn.com/1',
    tags: ['AI', 'LLM'],
  },
  {
    id: 'content-uuid-002',
    title: '세계 경제 동향',
    summary_ai: '경제 동향 요약',
    source: 'naver_news',
    source_url: 'https://news.naver.com/2',
    tags: ['경제'],
  },
];

const SAMPLE_INTERACTIONS = [
  { content_id: 'content-uuid-001', interaction: '좋아요' },
];

// ─── U-08-06: 인증 ──────────────────────────────────────────────────────────

describe('GET /api/briefings/today — 인증 (U-08-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefing = SAMPLE_BRIEFING;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = SAMPLE_INTERACTIONS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('U-08-06-1: 세션 없으면 401을 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('U-08-06-2: 유효한 세션이면 401이 아닌 응답을 반환한다', async () => {
    mockUser = { id: 'user-uuid-001' };
    mockBriefing = SAMPLE_BRIEFING;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = [];

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);

    expect(response.status).not.toBe(401);
  });
});

// ─── U-08-07: 브리핑 조회 ───────────────────────────────────────────────────

describe('GET /api/briefings/today — 브리핑 조회 (U-08-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefing = SAMPLE_BRIEFING;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = SAMPLE_INTERACTIONS;
    vi.resetModules();
  });

  it('U-08-07-1: 오늘 브리핑이 있으면 200과 items를 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.briefing_date).toBe('2026-02-28');
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('U-08-07-2: 오늘 브리핑이 없으면 404와 BRIEFING_NOT_FOUND를 반환한다', async () => {
    mockBriefing = null;
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('BRIEFING_NOT_FOUND');
  });

  it('U-08-07-3: content_items 정보가 items에 포함된다', async () => {
    mockBriefing = SAMPLE_BRIEFING;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = [];

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const firstItem = body.data.items[0];
    expect(firstItem.title).toBeDefined();
    expect(firstItem.summary_ai).toBeDefined();
    expect(firstItem.source).toBeDefined();
    expect(firstItem.source_url).toBeDefined();
  });

  it('U-08-07-4: user_interaction 정보가 items에 포함된다', async () => {
    mockBriefing = SAMPLE_BRIEFING;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = SAMPLE_INTERACTIONS;

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const firstItem = body.data.items[0];
    // user_interaction 필드가 존재해야 한다 (null 또는 값)
    expect('user_interaction' in firstItem).toBe(true);
  });

  it('U-08-07-5: reason 필드가 items에 포함된다', async () => {
    mockBriefing = SAMPLE_BRIEFING;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = [];

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const secondItem = body.data.items[1];
    // reason 필드가 존재해야 한다
    expect('reason' in secondItem).toBe(true);
    expect(secondItem.reason).toBe('지난주 메모 관련');
  });
});
