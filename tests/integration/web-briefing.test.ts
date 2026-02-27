// F-08 웹 브리핑 뷰어 통합 테스트
// test-spec.md I-08-01

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = null;

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

let mockBriefing: Record<string, unknown> | null = null;
let mockContentItems: Record<string, unknown>[] = [];
let mockInteractions: Record<string, unknown>[] = [];

const mockMaybeSingle = vi.fn();

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

// ─── I-08-01: 브리핑 조회 전체 흐름 ─────────────────────────────────────────

describe('GET /api/briefings/today — 통합 흐름 (I-08-01)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = null;
    mockBriefing = null;
    mockContentItems = [];
    mockInteractions = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('I-08-01-1: 인증 없이 요청 시 401을 반환한다', async () => {
    mockUser = null;
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('I-08-01-2: 인증 후 오늘 브리핑 조회 성공 시 200과 데이터를 반환한다', async () => {
    mockUser = { id: 'user-uuid-001' };
    mockBriefing = SAMPLE_BRIEFING;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = [];
    mockMaybeSingle.mockResolvedValue({ data: SAMPLE_BRIEFING, error: null });

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.briefing_date).toBe('2026-02-28');
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items.length).toBeGreaterThan(0);
  });

  it('I-08-01-3: 브리핑 없는 경우 404와 BRIEFING_NOT_FOUND를 반환한다', async () => {
    mockUser = { id: 'user-uuid-001' };
    mockBriefing = null;
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('BRIEFING_NOT_FOUND');
  });

  it('I-08-01-4: items 배열이 position 순으로 정렬된다', async () => {
    mockUser = { id: 'user-uuid-001' };
    // position을 역순으로 준비
    const scrambledBriefing = {
      ...SAMPLE_BRIEFING,
      items: [
        { content_id: 'content-uuid-002', position: 2, channel: 'world', reason: null },
        { content_id: 'content-uuid-001', position: 1, channel: 'tech', reason: null },
      ],
    };
    mockBriefing = scrambledBriefing;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = [];
    mockMaybeSingle.mockResolvedValue({ data: scrambledBriefing, error: null });

    const { GET } = await import('@/app/api/briefings/today/route');
    const request = new NextRequest('http://localhost/api/briefings/today');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const items = body.data.items;
    if (items.length >= 2) {
      expect(items[0].position).toBeLessThan(items[1].position);
    }
  });
});
