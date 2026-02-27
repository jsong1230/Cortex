// F-15 HN 키워드 속보 알림 트리거 단위 테스트 (RED → GREEN)
// AC3: interest_profile 상위 3개 토픽 × HN 500+ 포인트 아이템

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase 모킹 ───────────────────────────────────────────────────────────

let mockTopTopics: Array<{ topic: string; score: number }> = [
  { topic: 'AI', score: 0.9 },
  { topic: 'TypeScript', score: 0.8 },
  { topic: 'Rust', score: 0.7 },
];
let mockTopTopicsError: { message: string } | null = null;

let mockHNItems: Array<{
  id: string;
  title: string;
  source_url: string;
  tags: string[];
  score_initial: number;
}> = [];
let mockHNItemsError: { message: string } | null = null;

const mockHNQuery = vi.fn().mockImplementation(async () => ({
  data: mockHNItems,
  error: mockHNItemsError,
}));

const mockHNContainsFilter = vi.fn().mockReturnValue({
  gt: mockHNQuery,
});

const mockTopicsLimit = vi.fn().mockImplementation(async () => ({
  data: mockTopTopics,
  error: mockTopTopicsError,
}));

const mockTopicsOrder = vi.fn().mockReturnValue({ limit: mockTopicsLimit });
const mockTopicsSelect = vi.fn().mockReturnValue({ order: mockTopicsOrder });

const mockHNEqFilter = vi.fn().mockReturnValue({ contains: mockHNContainsFilter });
const mockHNSelect = vi.fn().mockReturnValue({ eq: mockHNEqFilter });

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'interest_profile') {
    return { select: mockTopicsSelect };
  }
  if (table === 'content_items') {
    return { select: mockHNSelect };
  }
  return {};
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

import { checkKeywordBreaking } from '@/lib/alerts';

// ─── 테스트 데이터 ───────────────────────────────────────────────────────────

const HN_HIGH_SCORE_ITEM = {
  id: 'content-hn-001',
  title: 'New AI breakthrough changes everything',
  source_url: 'https://news.ycombinator.com/item?id=12345',
  tags: ['AI', 'machine learning'],
  score_initial: 0.95, // HN score 반영 (500+ points)
};

// ─── checkKeywordBreaking 테스트 ─────────────────────────────────────────────

describe('checkKeywordBreaking (AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTopTopics = [
      { topic: 'AI', score: 0.9 },
      { topic: 'TypeScript', score: 0.8 },
      { topic: 'Rust', score: 0.7 },
    ];
    mockTopTopicsError = null;
    mockHNItems = [];
    mockHNItemsError = null;
  });

  it('AC3: 관심 토픽과 매칭되는 HN 500+ 아이템 없을 시 null 반환', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'interest_profile') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockTopTopics, error: null }),
              }),
            }),
          };
        }
        // content_items — HN 아이템 없음
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              overlaps: vi.fn().mockReturnValue({
                gt: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }),
    };

    const result = await checkKeywordBreaking(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(result).toBeNull();
  });

  it('AC3: 관심 토픽과 매칭되는 HN 500+ 아이템 발견 시 알림 트리거 반환', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'interest_profile') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockTopTopics, error: null }),
              }),
            }),
          };
        }
        // content_items — HN 고득점 아이템 있음
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              overlaps: vi.fn().mockReturnValue({
                gt: vi.fn().mockResolvedValue({ data: [HN_HIGH_SCORE_ITEM], error: null }),
              }),
            }),
          }),
        };
      }),
    };

    const result = await checkKeywordBreaking(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('keyword_breaking');
    expect(result?.contentId).toBe('content-hn-001');
    expect(result?.title).toContain('AI');
    expect(result?.message).toBeTruthy();
  });

  it('AC3: interest_profile에 토픽이 없으면 null 반환', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'interest_profile') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    const result = await checkKeywordBreaking(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(result).toBeNull();
  });

  it('AC3: 알림 트리거에 sourceUrl이 포함된다', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'interest_profile') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockTopTopics, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              overlaps: vi.fn().mockReturnValue({
                gt: vi.fn().mockResolvedValue({ data: [HN_HIGH_SCORE_ITEM], error: null }),
              }),
            }),
          }),
        };
      }),
    };

    const result = await checkKeywordBreaking(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(result?.sourceUrl).toBe('https://news.ycombinator.com/item?id=12345');
  });

  it('DB 오류 시 null 반환 (알림 스킵)', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'interest_profile') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'DB error' },
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    const result = await checkKeywordBreaking(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(result).toBeNull();
  });

  it('AC3: 상위 3개 토픽만 조회한다 (limit 3)', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: mockTopTopics, error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'interest_profile') {
          return { select: mockSelect };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              overlaps: vi.fn().mockReturnValue({
                gt: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }),
    };

    await checkKeywordBreaking(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(mockLimit).toHaveBeenCalledWith(3);
  });
});
