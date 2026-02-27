// F-09 GET /api/content/[id] 단위 테스트
// test-spec.md D-01 ~ D-04

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const RELATED_UUID = '660e8400-e29b-41d4-a716-446655440001';
const BRIEFING_UUID = '770e8400-e29b-41d4-a716-446655440002';

// content_items 단건 조회 응답
let mockContentItem: Record<string, unknown> | null = null;

// user_interactions 조회 응답 (반응, 메모)
let mockInteractions: Record<string, unknown>[] = [];

// briefings 조회 응답
let mockBriefings: Record<string, unknown>[] = [];

// 관련 아이템 조회 응답
let mockRelatedItems: Record<string, unknown>[] = [];

// content_items 테이블용 체이닝 빌더 (단건 조회 + 관련 아이템 조회 모두 지원)
function makeContentItemsChain() {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    overlaps: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };

  // 모든 메서드가 chain을 반환하도록 설정 (마지막 메서드는 Promise 반환)
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.neq.mockReturnValue(chain);
  chain.overlaps.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);

  // limit()는 관련 아이템 조회의 마지막 메서드
  chain.limit.mockImplementation(async () => ({
    data: mockRelatedItems,
    error: null,
  }));

  // maybeSingle()은 단건 조회의 마지막 메서드
  chain.maybeSingle.mockImplementation(async () => ({
    data: mockContentItem,
    error: null,
  }));

  return chain;
}

// user_interactions 테이블용 체이닝 빌더
function makeInteractionsChain() {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.neq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);

  chain.limit.mockImplementation(async () => ({
    data: mockInteractions,
    error: null,
  }));

  return chain;
}

// briefings 테이블용 체이닝 빌더
function makeBriefingsChain() {
  const chain = {
    select: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);

  chain.limit.mockImplementation(async () => ({
    data: mockBriefings,
    error: null,
  }));

  return chain;
}

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'content_items') {
    return makeContentItemsChain();
  }
  if (table === 'user_interactions') {
    return makeInteractionsChain();
  }
  if (table === 'briefings') {
    return makeBriefingsChain();
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

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const SAMPLE_CONTENT_ITEM = {
  id: VALID_UUID,
  channel: 'tech',
  title: 'OpenAI GPT-5 출시',
  summary_ai: 'GPT-5 관련 요약 전문',
  source: 'hackernews',
  source_url: 'https://hn.com/1',
  tags: ['AI', 'LLM', 'GPT-5'],
  collected_at: '2026-02-28T06:30:00.000Z',
};

const SAMPLE_INTERACTIONS = [
  { interaction: '좋아요' },
];

const SAMPLE_MEMO_INTERACTIONS = [
  { memo_text: '나중에 다시 보기' },
];

const SAMPLE_BRIEFINGS = [
  {
    id: BRIEFING_UUID,
    items: [
      { content_id: VALID_UUID, position: 1, channel: 'tech', reason: '지난주 메모: LLM 관련' },
    ],
  },
];

const SAMPLE_RELATED_ITEMS = [
  {
    id: RELATED_UUID,
    channel: 'tech',
    title: 'Claude 3.5 Sonnet 벤치마크',
    summary_ai: '벤치마크 요약',
    source: 'hackernews',
    source_url: 'https://hn.com/2',
  },
];

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────────────

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/content/${id}`, {
    method: 'GET',
  });
}

// GET 핸들러에 params를 전달하는 래퍼
async function callGET(id: string) {
  const { GET } = await import('@/app/api/content/[id]/route');
  const request = makeRequest(id);
  return GET(request, { params: { id } });
}

// ─── D-01: 인증 검증 ─────────────────────────────────────────────────────────

describe('GET /api/content/[id] — 인증 검증 (D-01)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockContentItem = SAMPLE_CONTENT_ITEM;
    mockInteractions = SAMPLE_INTERACTIONS;
    mockBriefings = SAMPLE_BRIEFINGS;
    mockRelatedItems = SAMPLE_RELATED_ITEMS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('D-01-1: 세션 없으면 401을 반환한다', async () => {
    mockUser = null;
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('D-01-2: 유효한 세션이면 401이 아닌 응답을 반환한다', async () => {
    mockUser = { id: 'user-uuid-001' };
    const response = await callGET(VALID_UUID);

    expect(response.status).not.toBe(401);
  });
});

// ─── D-02: 콘텐츠 조회 ──────────────────────────────────────────────────────

describe('GET /api/content/[id] — 콘텐츠 조회 (D-02)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockContentItem = SAMPLE_CONTENT_ITEM;
    mockInteractions = SAMPLE_INTERACTIONS;
    mockBriefings = SAMPLE_BRIEFINGS;
    mockRelatedItems = SAMPLE_RELATED_ITEMS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('D-02-1: 존재하는 콘텐츠 ID로 200을 반환한다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.content_id).toBe(VALID_UUID);
  });

  it('D-02-2: 존재하지 않는 ID로 404를 반환한다', async () => {
    mockContentItem = null;
    const response = await callGET('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('CONTENT_NOT_FOUND');
  });

  it('D-02-3: 잘못된 형식의 ID로 400을 반환한다', async () => {
    const response = await callGET('invalid-not-uuid');
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });
});

// ─── D-03: 응답 데이터 구조 ─────────────────────────────────────────────────

describe('GET /api/content/[id] — 응답 데이터 구조 (D-03)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockContentItem = SAMPLE_CONTENT_ITEM;
    mockInteractions = SAMPLE_INTERACTIONS;
    mockBriefings = SAMPLE_BRIEFINGS;
    mockRelatedItems = SAMPLE_RELATED_ITEMS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('D-03-1: title, summary_ai, source, source_url이 포함된다 (AC2)', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect(body.data.title).toBeDefined();
    expect('summary_ai' in body.data).toBe(true);
    expect(body.data.source).toBeDefined();
    expect(body.data.source_url).toBeDefined();
  });

  it('D-03-2: channel 필드가 포함된다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect(body.data.channel).toBeDefined();
  });

  it('D-03-3: tags 배열이 포함된다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect('tags' in body.data).toBe(true);
  });

  it('D-03-4: collected_at이 ISO 8601 형식이다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect(body.data.collected_at).toBeDefined();
    // ISO 8601 형식 확인
    expect(() => new Date(body.data.collected_at).toISOString()).not.toThrow();
  });

  it('D-03-5: user_interaction 필드가 포함된다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect('user_interaction' in body.data).toBe(true);
  });

  it('D-03-6: memo_text 필드가 포함된다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect('memo_text' in body.data).toBe(true);
  });

  it('D-03-7: reason 필드가 포함된다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect('reason' in body.data).toBe(true);
  });

  it('D-03-8: briefing_id 필드가 포함된다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect('briefing_id' in body.data).toBe(true);
  });
});

// ─── D-04: 관련 아이템 (AC4) ────────────────────────────────────────────────

describe('GET /api/content/[id] — 관련 아이템 (D-04)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockContentItem = SAMPLE_CONTENT_ITEM;
    mockInteractions = SAMPLE_INTERACTIONS;
    mockBriefings = SAMPLE_BRIEFINGS;
    mockRelatedItems = SAMPLE_RELATED_ITEMS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('D-04-1: related_items 배열이 포함된다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect(Array.isArray(body.data.related_items)).toBe(true);
  });

  it('D-04-2: 관련 아이템은 최대 5건이다', async () => {
    // 6건 mock 설정
    mockRelatedItems = Array.from({ length: 6 }, (_, i) => ({
      id: `related-uuid-00${i}`,
      channel: 'tech',
      title: `관련 아이템 ${i}`,
      summary_ai: `요약 ${i}`,
      source: 'hackernews',
      source_url: `https://hn.com/${i}`,
    }));

    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect(body.data.related_items.length).toBeLessThanOrEqual(5);
  });

  it('D-04-3: 자기 자신은 related_items에 포함되지 않는다', async () => {
    mockRelatedItems = [
      {
        id: RELATED_UUID,
        channel: 'tech',
        title: '다른 아이템',
        summary_ai: '요약',
        source: 'hackernews',
        source_url: 'https://hn.com/2',
      },
    ];

    const response = await callGET(VALID_UUID);
    const body = await response.json();

    const hasSelf = body.data.related_items.some(
      (item: { content_id: string }) => item.content_id === VALID_UUID
    );
    expect(hasSelf).toBe(false);
  });

  it('D-04-4: tags가 null이면 related_items가 빈 배열이다', async () => {
    mockContentItem = { ...SAMPLE_CONTENT_ITEM, tags: null };
    mockRelatedItems = [];

    const response = await callGET(VALID_UUID);
    const body = await response.json();

    expect(body.data.related_items).toEqual([]);
  });

  it('D-04-5: 관련 아이템에 channel, title, summary_ai, source, source_url이 포함된다', async () => {
    const response = await callGET(VALID_UUID);
    const body = await response.json();

    if (body.data.related_items.length > 0) {
      const firstRelated = body.data.related_items[0];
      expect(firstRelated.channel).toBeDefined();
      expect(firstRelated.title).toBeDefined();
      expect('summary_ai' in firstRelated).toBe(true);
      expect(firstRelated.source).toBeDefined();
      expect(firstRelated.source_url).toBeDefined();
    }
  });
});
