// F-10 GET /api/briefings/[date] 단위 테스트
// test-spec.md H-05 ~ H-08

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  briefing_date: '2026-02-27',
  items: [
    { content_id: 'content-uuid-001', position: 1, channel: 'tech', reason: null },
    { content_id: 'content-uuid-002', position: 2, channel: 'world', reason: '지난주 메모 관련' },
  ],
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

// ─── H-05: 유효한 날짜 브리핑 조회 ──────────────────────────────────────────

describe('GET /api/briefings/[date] — 유효한 날짜 조회 (H-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefing = SAMPLE_BRIEFING;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = [];
  });

  it('H-05: 유효한 날짜로 요청 시 200과 briefing_date, items 배열을 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest('http://localhost/api/briefings/2026-02-27');

    const response = await GET(request, { params: { date: '2026-02-27' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.briefing_date).toBe('2026-02-27');
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('H-05-2: today API와 동일한 응답 구조를 가진다 (briefing_id, briefing_date, items)', async () => {
    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest('http://localhost/api/briefings/2026-02-27');

    const response = await GET(request, { params: { date: '2026-02-27' } });
    const body = await response.json();

    expect(body.data.briefing_id).toBeDefined();
    expect(body.data.briefing_date).toBeDefined();
    expect(body.data.items).toBeDefined();
  });

  it('H-05-3: 아이템에 content_id, channel, title, summary_ai, source, source_url, reason, user_interaction이 포함된다', async () => {
    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest('http://localhost/api/briefings/2026-02-27');

    const response = await GET(request, { params: { date: '2026-02-27' } });
    const body = await response.json();

    const item = body.data.items[0];
    expect(item.content_id).toBeDefined();
    expect(item.channel).toBeDefined();
    expect(item.title).toBeDefined();
    expect('summary_ai' in item).toBe(true);
    expect(item.source).toBeDefined();
    expect(item.source_url).toBeDefined();
    expect('reason' in item).toBe(true);
    expect('user_interaction' in item).toBe(true);
  });
});

// ─── H-06: 존재하지 않는 날짜 ────────────────────────────────────────────────

describe('GET /api/briefings/[date] — 존재하지 않는 날짜 (H-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefing = null;
    mockContentItems = [];
    mockInteractions = [];
  });

  it('H-06: 브리핑이 없는 날짜 요청 시 404와 BRIEFING_NOT_FOUND를 반환한다', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest('http://localhost/api/briefings/2020-01-01');

    const response = await GET(request, { params: { date: '2020-01-01' } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('BRIEFING_NOT_FOUND');
  });
});

// ─── H-07: 미래 날짜 ─────────────────────────────────────────────────────────

describe('GET /api/briefings/[date] — 미래 날짜 거부 (H-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
  });

  it('H-07: 미래 날짜 요청 시 400과 FUTURE_DATE_NOT_ALLOWED를 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest('http://localhost/api/briefings/2099-12-31');

    const response = await GET(request, { params: { date: '2099-12-31' } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('FUTURE_DATE_NOT_ALLOWED');
  });
});

// ─── H-08: 잘못된 날짜 형식 ──────────────────────────────────────────────────

describe('GET /api/briefings/[date] — 날짜 형식 검증 (H-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
  });

  it('H-08-1: 슬래시 구분자 날짜(2026/02/27)는 400과 INVALID_DATE_FORMAT을 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest('http://localhost/api/briefings/2026%2F02%2F27');

    const response = await GET(request, { params: { date: '2026/02/27' } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INVALID_DATE_FORMAT');
  });

  it('H-08-2: 유효하지 않은 날짜(2026-02-30)는 400을 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest('http://localhost/api/briefings/2026-02-30');

    const response = await GET(request, { params: { date: '2026-02-30' } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_DATE_FORMAT');
  });

  it('H-08-3: 미인증 사용자 요청 시 401을 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest('http://localhost/api/briefings/2026-02-27');

    const response = await GET(request, { params: { date: '2026-02-27' } });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });
});
