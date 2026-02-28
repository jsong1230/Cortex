// F-18 통합 테스트 — 컨텍스트 인식 브리핑 + 컨텍스트 동기화 API
// AC3, AC4: keyword_contexts + send-briefing 연동
// AC5: /api/context/sync 라우트

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── fetch 전역 모킹 ────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Anthropic 모킹 ──────────────────────────────────────────────────────────
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  },
}));

// ─── Supabase 체인 팩토리 ───────────────────────────────────────────────────

// 각 테이블별 다른 데이터를 반환하기 위한 체인 맵
const tableDataMap: Record<string, unknown[]> = {};
const mockUpsertFn = vi.fn().mockResolvedValue({ data: [], error: null });
const mockDeleteChain = {
  lt: vi.fn().mockResolvedValue({ error: null }),
};
const mockInsertFn = vi.fn().mockResolvedValue({ data: [{ id: 'briefing-id' }], error: null });

const makeChain = (tableName: string) => ({
  select: vi.fn().mockReturnThis(),
  insert: tableName === 'briefings' ? mockInsertFn : vi.fn().mockReturnThis(),
  upsert: tableName === 'keyword_contexts' ? mockUpsertFn : vi.fn().mockReturnThis(),
  delete: tableName === 'keyword_contexts' ? vi.fn().mockReturnValue(mockDeleteChain) : vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  gt: vi.fn().mockImplementation(function () {
    return Promise.resolve({ data: tableDataMap[tableName] ?? [], error: null });
  }),
  order: vi.fn().mockImplementation(function () {
    return Promise.resolve({ data: tableDataMap[tableName] ?? [], error: null });
  }),
  limit: vi.fn().mockImplementation(function () {
    return Promise.resolve({ data: tableDataMap[tableName] ?? [], error: null });
  }),
  single: vi.fn().mockImplementation(async () => ({
    data: tableDataMap[tableName]?.[0] ?? null,
    error: null,
  })),
  filter: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
});

const mockFrom = vi.fn().mockImplementation((tableName: string) => makeChain(tableName));

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
    title: 'LLM 인프라 최적화',
    summary_ai: 'LLM 비용 절감 전략',
    score_initial: 0.85,
    tags: ['LLM', 'infrastructure'],
  },
  {
    id: 'world-uuid-1',
    channel: 'world',
    source: 'naver',
    source_url: 'https://n.news.naver.com/1',
    title: '경제 뉴스',
    summary_ai: '경제 성장률 전망',
    score_initial: 0.7,
    tags: ['economy'],
  },
];

const mockKeywordContexts = [
  {
    id: 'kc-uuid-1',
    source: 'diary',
    source_id: 'diary-uuid-1',
    keywords: ['LLM', 'cloud-cost'],
    expires_at: '2026-03-07T00:00:00Z',
  },
];

const mockDiaryEntries = [
  {
    id: 'diary-uuid-1',
    content: 'LLM 인프라에 대해 고민했다.',
    created_at: '2026-02-25T10:00:00Z',
  },
];

const mockUserSettings = [
  { id: 'singleton', mylifeos_enabled: true },
];

// ─── GET /api/context/sync 테스트 ──────────────────────────────────────────

describe('GET /api/context/sync — F-18 동기화', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret-123';
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    // 테이블별 데이터 초기화
    tableDataMap['content_items'] = mockContentItems;
    tableDataMap['keyword_contexts'] = mockKeywordContexts;
    tableDataMap['diary_entries'] = mockDiaryEntries;
    tableDataMap['todos'] = [];
    tableDataMap['notes'] = [];
    tableDataMap['cortex_settings'] = mockUserSettings;
    tableDataMap['interest_profile'] = [];
    tableDataMap['briefings'] = [];

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ keywords: ['LLM', 'cloud-cost'] }) }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('F18-I-1: 인증 없이 요청하면 401을 반환한다', async () => {
    const { GET } = await import('@/app/api/context/sync/route');
    const request = new NextRequest('http://localhost/api/context/sync', {
      method: 'POST',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('F18-I-2: 올바른 CRON_SECRET으로 동기화가 실행된다', async () => {
    const { GET } = await import('@/app/api/context/sync/route');
    const request = new NextRequest('http://localhost/api/context/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret-123' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('F18-I-3: 응답에 { success, data: { synced, expired } } 형태가 포함된다', async () => {
    const { GET } = await import('@/app/api/context/sync/route');
    const request = new NextRequest('http://localhost/api/context/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret-123' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('synced');
    expect(body.data).toHaveProperty('expired');
  });

  it('F18-I-4: mylifeos_enabled=false이면 동기화를 건너뛴다', async () => {
    tableDataMap['cortex_settings'] = [{ id: 'singleton', mylifeos_enabled: false }];

    const { GET } = await import('@/app/api/context/sync/route');
    const request = new NextRequest('http://localhost/api/context/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret-123' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // 스킵됐을 때 synced=0
    expect(body.data.synced).toBe(0);
  });
});

// ─── 컨텍스트 인식 브리핑 통합 테스트 ──────────────────────────────────────

describe('컨텍스트 인식 브리핑 (AC4)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    tableDataMap['content_items'] = mockContentItems;
    tableDataMap['keyword_contexts'] = mockKeywordContexts;
    tableDataMap['cortex_settings'] = [
      {
        id: 'singleton',
        mylifeos_enabled: true,
        mute_until: null,
        item_reduction: 0,
        tech_enabled: true,
        world_enabled: true,
        culture_enabled: true,
        canada_enabled: true,
      },
    ];
    tableDataMap['interest_profile'] = [];
    tableDataMap['briefings'] = [];
    tableDataMap['user_interactions'] = [];
  });

  it('AC4-8: matchContentToKeywords가 매칭 시 "지난주 메모: {키워드} 관련 아티클 포함" 형식의 이유를 반환한다', async () => {
    const { matchContentToKeywords } = await import('@/lib/mylifeos');

    const contentTags = ['LLM', 'infrastructure'];
    const reason = matchContentToKeywords(contentTags, mockKeywordContexts);

    expect(reason).not.toBeNull();
    // AC4 요구사항: "지난주 메모: {키워드} 관련 아티클 포함" 형식
    expect(reason).toContain('지난주');
    expect(reason).toContain('관련');
  });
});

// ─── calculateContextScore 테스트 ───────────────────────────────────────────

describe('calculateContextScore (F-18)', () => {
  it('F18-CS-1: 태그가 키워드와 매칭되면 0.0보다 큰 점수를 반환한다', async () => {
    const { calculateContextScore } = await import('@/lib/mylifeos');

    const tags = ['LLM', 'cloud-cost'];
    const score = calculateContextScore(tags, mockKeywordContexts);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('F18-CS-2: 매칭되지 않으면 0.0을 반환한다', async () => {
    const { calculateContextScore } = await import('@/lib/mylifeos');

    const tags = ['unrelated-topic'];
    const score = calculateContextScore(tags, mockKeywordContexts);

    expect(score).toBe(0);
  });

  it('F18-CS-3: 빈 태그 배열이면 0.0을 반환한다', async () => {
    const { calculateContextScore } = await import('@/lib/mylifeos');

    const score = calculateContextScore([], mockKeywordContexts);

    expect(score).toBe(0);
  });

  it('F18-CS-4: 빈 컨텍스트 배열이면 0.0을 반환한다', async () => {
    const { calculateContextScore } = await import('@/lib/mylifeos');

    const score = calculateContextScore(['LLM'], []);

    expect(score).toBe(0);
  });

  it('F18-CS-5: 점수는 0.0~1.0 범위다', async () => {
    const { calculateContextScore } = await import('@/lib/mylifeos');

    const tags = ['LLM', 'MSA', 'team-building', 'startup', 'cloud-cost'];
    const score = calculateContextScore(tags, mockKeywordContexts);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1.0);
  });
});
