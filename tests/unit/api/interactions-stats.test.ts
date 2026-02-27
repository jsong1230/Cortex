// F-11 GET /api/interactions/stats — 반응 통계 단위 테스트 (R-05)
// test-spec.md R-05-1 ~ R-05-7

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

// 타입별 통계 데이터
let mockByTypeData: Array<{ interaction: string; count: number }> = [
  { interaction: '좋아요', count: 85 },
  { interaction: '싫어요', count: 20 },
  { interaction: '저장', count: 45 },
  { interaction: '메모', count: 12 },
  { interaction: '웹열기', count: 30 },
  { interaction: '링크클릭', count: 18 },
  { interaction: '스킵', count: 35 },
];

// 소스별 통계 데이터
let mockBySourceData: Array<{ source: string; count: number }> = [
  { source: 'telegram_bot', count: 120 },
  { source: 'web', count: 90 },
  { source: 'system', count: 35 },
];

// 채널별 통계 데이터 (content_items JOIN)
let mockByChannelData: Array<{ content_items: { channel: string }; count: number }> = [
  { content_items: { channel: 'tech' }, count: 100 },
  { content_items: { channel: 'world' }, count: 50 },
  { content_items: { channel: 'culture' }, count: 40 },
  { content_items: { channel: 'canada' }, count: 35 },
];

let mockByTypeError: { message: string } | null = null;
let mockBySourceError: { message: string } | null = null;
let mockByChannelError: { message: string } | null = null;

// Supabase 체인 — select 결과를 쿼리 종류에 따라 다르게 반환
let callCount = 0;

function makeQueryChain(resolveData: () => unknown[], resolveError: () => { message: string } | null) {
  return {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(async () => ({
      data: resolveData(),
      error: resolveError(),
    })),
    // 마지막 체인이 실제 실행이므로 then도 지원
    then: undefined as unknown,
  };
}

// from() 호출 순서에 따라 다른 체인 반환
// 1번째: by_type, 2번째: by_source, 3번째: by_channel
const mockFrom = vi.fn().mockImplementation(() => {
  callCount++;
  const current = callCount;

  const chain = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(async () => {
      if (current === 1) {
        return { data: mockByTypeData, error: mockByTypeError };
      }
      if (current === 2) {
        return { data: mockBySourceData, error: mockBySourceError };
      }
      return { data: mockByChannelData, error: mockByChannelError };
    }),
  };
  return chain;
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

const makeRequest = (queryParams = '') =>
  new NextRequest(`http://localhost/api/interactions/stats${queryParams ? '?' + queryParams : ''}`);

// ─── R-05: GET /api/interactions/stats ──────────────────────────────────────

describe('GET /api/interactions/stats — 반응 통계 (R-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    callCount = 0;
    mockByTypeData = [
      { interaction: '좋아요', count: 85 },
      { interaction: '싫어요', count: 20 },
      { interaction: '저장', count: 45 },
      { interaction: '메모', count: 12 },
      { interaction: '웹열기', count: 30 },
      { interaction: '링크클릭', count: 18 },
      { interaction: '스킵', count: 35 },
    ];
    mockBySourceData = [
      { source: 'telegram_bot', count: 120 },
      { source: 'web', count: 90 },
      { source: 'system', count: 35 },
    ];
    mockByChannelData = [
      { content_items: { channel: 'tech' }, count: 100 },
      { content_items: { channel: 'world' }, count: 50 },
      { content_items: { channel: 'culture' }, count: 40 },
      { content_items: { channel: 'canada' }, count: 35 },
    ];
    mockByTypeError = null;
    mockBySourceError = null;
    mockByChannelError = null;
    mockFrom.mockImplementation(() => {
      callCount++;
      const current = callCount;
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(async () => {
          if (current === 1) return { data: mockByTypeData, error: mockByTypeError };
          if (current === 2) return { data: mockBySourceData, error: mockBySourceError };
          return { data: mockByChannelData, error: mockByChannelError };
        }),
      };
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('R-05-1: 기본 통계 조회 시 200과 by_type, by_source, by_channel, total을 반환한다', async () => {
    const { GET } = await import('@/app/api/interactions/stats/route');
    const request = makeRequest();

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data).toHaveProperty('by_type');
    expect(body.data).toHaveProperty('by_source');
    expect(body.data).toHaveProperty('by_channel');
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('period');
  });

  it('R-05-2: 날짜 범위 지정 시 period가 요청 날짜로 반환된다', async () => {
    const { GET } = await import('@/app/api/interactions/stats/route');
    const request = makeRequest('from=2026-02-01&to=2026-02-28');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.period.from).toBe('2026-02-01');
    expect(body.data.period.to).toBe('2026-02-28');
  });

  it('R-05-3: by_type에 7개 타입 키가 모두 존재한다 (값 0 포함)', async () => {
    const { GET } = await import('@/app/api/interactions/stats/route');
    const request = makeRequest();

    const response = await GET(request);
    const body = await response.json();

    const byType = body.data.by_type;
    expect(byType).toHaveProperty('좋아요');
    expect(byType).toHaveProperty('싫어요');
    expect(byType).toHaveProperty('저장');
    expect(byType).toHaveProperty('메모');
    expect(byType).toHaveProperty('웹열기');
    expect(byType).toHaveProperty('링크클릭');
    expect(byType).toHaveProperty('스킵');
  });

  it('R-05-4: by_source에 telegram_bot, web, system 키가 모두 존재한다', async () => {
    const { GET } = await import('@/app/api/interactions/stats/route');
    const request = makeRequest();

    const response = await GET(request);
    const body = await response.json();

    const bySource = body.data.by_source;
    expect(bySource).toHaveProperty('telegram_bot');
    expect(bySource).toHaveProperty('web');
    expect(bySource).toHaveProperty('system');
  });

  it('R-05-5: by_channel 객체가 존재한다', async () => {
    const { GET } = await import('@/app/api/interactions/stats/route');
    const request = makeRequest();

    const response = await GET(request);
    const body = await response.json();

    expect(body.data).toHaveProperty('by_channel');
    expect(typeof body.data.by_channel).toBe('object');
  });

  it('R-05-6: 반응 데이터가 없는 기간 조회 시 total이 0이고 모든 값이 0이다', async () => {
    mockByTypeData = [];
    mockBySourceData = [];
    mockByChannelData = [];

    callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(async () => ({ data: [], error: null })),
      };
    });

    const { GET } = await import('@/app/api/interactions/stats/route');
    const request = makeRequest('from=2030-01-01&to=2030-01-31');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.total).toBe(0);
    // 모든 by_type 값이 0
    const byType = body.data.by_type;
    Object.values(byType).forEach((val) => {
      expect(val).toBe(0);
    });
  });

  it('R-05-7: 인증 없으면 401을 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/interactions/stats/route');
    const request = makeRequest();

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });
});
