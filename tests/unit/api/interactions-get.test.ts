// F-11 GET /api/interactions — 반응 이력 조회 단위 테스트 (R-02)
// test-spec.md R-02-1 ~ R-02-8

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

const SAMPLE_INTERACTIONS = [
  {
    id: 'interaction-uuid-001',
    content_id: 'content-uuid-001',
    briefing_id: 'briefing-uuid-001',
    interaction: '좋아요',
    memo_text: null,
    source: 'web',
    created_at: '2026-02-28T07:30:00+09:00',
    content_items: { title: 'OpenAI GPT-5 출시 임박', channel: 'tech' },
  },
  {
    id: 'interaction-uuid-002',
    content_id: 'content-uuid-002',
    briefing_id: 'briefing-uuid-001',
    interaction: '저장',
    memo_text: null,
    source: 'telegram_bot',
    created_at: '2026-02-27T08:00:00+09:00',
    content_items: { title: '세계 경제 동향', channel: 'world' },
  },
];

let mockQueryData: unknown[] = SAMPLE_INTERACTIONS;
let mockQueryError: { message: string } | null = null;
let mockCountData: { count: number } | null = { count: 2 };

// 체인 빌더 — 마지막에 Promise 반환
function makeQueryChain() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(async () => ({
      data: mockQueryData,
      error: mockQueryError,
      count: mockCountData?.count ?? null,
    })),
  };
  return chain;
}

const mockFrom = vi.fn().mockImplementation(() => makeQueryChain());

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

const makeRequest = (queryParams = '') =>
  new NextRequest(`http://localhost/api/interactions${queryParams ? '?' + queryParams : ''}`);

// ─── R-02: GET /api/interactions ────────────────────────────────────────────

describe('GET /api/interactions — 반응 이력 조회 (R-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockQueryData = SAMPLE_INTERACTIONS;
    mockQueryError = null;
    mockCountData = { count: 2 };
    mockFrom.mockImplementation(() => makeQueryChain());
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('R-02-1: 파라미터 없이 전체 이력 조회 시 200과 items 배열을 반환한다', async () => {
    const { GET } = await import('@/app/api/interactions/route');
    const request = makeRequest();

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('limit');
    expect(body.data).toHaveProperty('offset');
    expect(body.data.limit).toBe(50);
    expect(body.data.offset).toBe(0);
  });

  it('R-02-2: content_id 필터 시 해당 content_id의 반응만 포함한다', async () => {
    const filteredData = [SAMPLE_INTERACTIONS[0]];
    mockQueryData = filteredData;
    mockCountData = { count: 1 };
    mockFrom.mockImplementation(() => makeQueryChain());

    const { GET } = await import('@/app/api/interactions/route');
    const request = makeRequest('content_id=content-uuid-001');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].content_id).toBe('content-uuid-001');
  });

  it('R-02-3: interaction 타입 필터 시 해당 타입의 반응만 포함한다', async () => {
    const filteredData = [SAMPLE_INTERACTIONS[1]]; // 저장
    mockQueryData = filteredData;
    mockCountData = { count: 1 };
    mockFrom.mockImplementation(() => makeQueryChain());

    const { GET } = await import('@/app/api/interactions/route');
    const request = makeRequest('interaction=저장');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items[0].interaction).toBe('저장');
  });

  it('R-02-4: source 필터 시 해당 소스의 반응만 포함한다', async () => {
    const filteredData = [SAMPLE_INTERACTIONS[0]]; // web
    mockQueryData = filteredData;
    mockCountData = { count: 1 };
    mockFrom.mockImplementation(() => makeQueryChain());

    const { GET } = await import('@/app/api/interactions/route');
    const request = makeRequest('source=web');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items[0].source).toBe('web');
  });

  it('R-02-5: 날짜 범위 필터가 적용된다', async () => {
    const { GET } = await import('@/app/api/interactions/route');
    const request = makeRequest('from=2026-02-01&to=2026-02-28');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('R-02-6: 페이지네이션 파라미터가 적용된다', async () => {
    const { GET } = await import('@/app/api/interactions/route');
    const request = makeRequest('limit=10&offset=10');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.limit).toBe(10);
    expect(body.data.offset).toBe(10);
  });

  it('R-02-7: 응답 items에 content_title, content_channel 필드가 포함된다', async () => {
    const { GET } = await import('@/app/api/interactions/route');
    const request = makeRequest();

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const firstItem = body.data.items[0];
    expect(firstItem).toHaveProperty('content_title');
    expect(firstItem).toHaveProperty('content_channel');
  });

  it('R-02-8: 인증 없으면 401을 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/interactions/route');
    const request = makeRequest();

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });
});
