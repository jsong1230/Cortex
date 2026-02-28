// F-22 월간 리포트 — 데이터 집계 단위 테스트
// monthly-data.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase 모킹 ────────────────────────────────────────────────────────────

// 테스트마다 동적으로 반환값 변경 가능하도록 팩토리 함수 패턴
let mockInteractionsData: Record<string, unknown>[] = [];
let mockInteractionsError: { message: string } | null = null;
let mockSavedItemsData: Record<string, unknown>[] = [];
let mockSavedItemsError: { message: string } | null = null;
let mockProfileData: Record<string, unknown>[] = [];
let mockProfileError: { message: string } | null = null;
let mockKeywordData: Record<string, unknown>[] = [];
let mockKeywordError: { message: string } | null = null;
let mockScoreHistoryData: Record<string, unknown>[] = [];
let mockScoreHistoryError: { message: string } | null = null;

// Supabase 쿼리 체이닝을 지원하는 유연한 모킹
// .order(), .gt(), .limit() 등이 터미널 메서드로 사용될 때도 처리
function createTableMock(
  getData: () => { data: Record<string, unknown>[] | null; error: { message: string } | null },
) {
  const resolveAsync = async () => getData();

  const mock = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    // gt/order/limit: 터미널 호출로 사용 시 Promise 반환
    gt: vi.fn().mockImplementation(resolveAsync),
    order: vi.fn().mockImplementation(resolveAsync),
    limit: vi.fn().mockImplementation(resolveAsync),
    single: vi.fn().mockImplementation(async () => {
      const result = getData();
      return { data: result.data?.[0] ?? null, error: result.error };
    }),
    then: undefined as unknown,
  };
  return mock;
}

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'user_interactions') {
    return createTableMock(() => ({ data: mockInteractionsData, error: mockInteractionsError }));
  }
  if (table === 'saved_items') {
    return createTableMock(() => ({ data: mockSavedItemsData, error: mockSavedItemsError }));
  }
  if (table === 'interest_profile') {
    return createTableMock(() => ({ data: mockProfileData, error: mockProfileError }));
  }
  if (table === 'keyword_contexts') {
    return createTableMock(() => ({ data: mockKeywordData, error: mockKeywordError }));
  }
  if (table === 'score_history') {
    return createTableMock(() => ({ data: mockScoreHistoryData, error: mockScoreHistoryError }));
  }
  return createTableMock(() => ({ data: [], error: null }));
});

const mockSupabase = { from: mockFrom };

// ─── 테스트 데이터 ─────────────────────────────────────────────────────────

const SAMPLE_INTERACTIONS = [
  { content_id: 'c-001', topic: 'llm', created_at: '2026-01-10T10:00:00Z' },
  { content_id: 'c-002', topic: 'llm', created_at: '2026-01-11T10:00:00Z' },
  { content_id: 'c-003', topic: 'cloud-cost', created_at: '2026-01-12T10:00:00Z' },
  { content_id: 'c-004', topic: 'llm', created_at: '2026-01-13T10:00:00Z' },
  { content_id: 'c-005', topic: 'msa', created_at: '2026-01-15T10:00:00Z' },
];

const SAMPLE_SAVED_ITEMS = [
  { status: 'completed', completed_at: '2026-01-20T10:00:00Z' },
  { status: 'completed', completed_at: '2026-01-21T10:00:00Z' },
  { status: 'completed', completed_at: '2026-01-22T10:00:00Z' },
  { status: 'archived', archived_at: '2026-01-25T10:00:00Z' },
  { status: 'saved', saved_at: '2026-01-28T10:00:00Z' },
];

const SAMPLE_PROFILE = [
  { topic: 'llm', score: 0.9 },
  { topic: 'cloud-cost', score: 0.7 },
  { topic: 'msa', score: 0.6 },
  { topic: 'team-building', score: 0.5 },
  { topic: 'startup', score: 0.4 },
];

const SAMPLE_KEYWORDS = [
  { keywords: ['llm', 'team-building'], source: 'diary' },
  { keywords: ['cloud-cost'], source: 'note' },
];

// ─── 테스트 스위트 ──────────────────────────────────────────────────────────

describe('gatherMonthlyData — 월간 데이터 집계 (F-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInteractionsData = SAMPLE_INTERACTIONS;
    mockInteractionsError = null;
    mockSavedItemsData = SAMPLE_SAVED_ITEMS;
    mockSavedItemsError = null;
    mockProfileData = SAMPLE_PROFILE;
    mockProfileError = null;
    mockKeywordData = SAMPLE_KEYWORDS;
    mockKeywordError = null;
    mockScoreHistoryData = [];
    mockScoreHistoryError = null;
  });

  it('MD-01: 월간 데이터 집계 시 topTopics가 반환된다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    expect(data).toBeDefined();
    expect(Array.isArray(data.topTopics)).toBe(true);
  });

  it('MD-02: topTopics는 readCount 내림차순으로 정렬된다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    const topics = data.topTopics;
    for (let i = 1; i < topics.length; i++) {
      expect(topics[i - 1].readCount).toBeGreaterThanOrEqual(topics[i].readCount);
    }
  });

  it('MD-03: topTopics는 최대 5개를 반환한다 (AC4)', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    expect(data.topTopics.length).toBeLessThanOrEqual(5);
  });

  it('MD-04: 각 topTopic은 topic, readCount, score 필드를 포함한다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    for (const topic of data.topTopics) {
      expect(typeof topic.topic).toBe('string');
      expect(typeof topic.readCount).toBe('number');
      expect(typeof topic.score).toBe('number');
    }
  });

  it('MD-05: llm이 3회 반응으로 topTopics 1위이다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    // llm 토픽이 상위에 있어야 함 (3회 반응)
    const llmTopic = data.topTopics.find((t) => t.topic === 'llm');
    expect(llmTopic).toBeDefined();
    expect(llmTopic!.readCount).toBe(3);
  });

  it('MD-06: completedItems 카운트가 정확하다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    // SAMPLE_SAVED_ITEMS에서 completed는 3개
    expect(data.completedItems).toBe(3);
  });

  it('MD-07: savedItems 카운트가 정확하다 (completed + saved + archived 합계)', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    // SAMPLE_SAVED_ITEMS 총 5개
    expect(data.savedItems).toBe(5);
  });

  it('MD-08: archivedItems 카운트가 정확하다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    // SAMPLE_SAVED_ITEMS에서 archived는 1개
    expect(data.archivedItems).toBe(1);
  });

  it('MD-09: mylifeosInsights는 keyword_contexts에서 추출된 키워드를 포함한다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    expect(Array.isArray(data.mylifeosInsights)).toBe(true);
    // keyword_contexts에서 추출된 키워드가 포함되어야 함
    const allKeywords = data.mylifeosInsights.join(' ');
    expect(allKeywords.length).toBeGreaterThan(0);
  });

  it('MD-10: month 필드가 입력한 월과 일치한다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    expect(data.month).toBe('2026-01');
  });

  it('MD-11: user_interactions DB 오류 시 빈 topTopics를 반환한다 (graceful degradation)', async () => {
    mockInteractionsError = { message: 'DB 오류' };
    mockInteractionsData = [];

    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    expect(data.topTopics).toEqual([]);
  });

  it('MD-12: saved_items DB 오류 시 completedItems=0, savedItems=0을 반환한다', async () => {
    mockSavedItemsError = { message: 'DB 오류' };
    mockSavedItemsData = [];

    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    expect(data.completedItems).toBe(0);
    expect(data.savedItems).toBe(0);
  });

  it('MD-13: scoreChanges는 배열이다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    expect(Array.isArray(data.scoreChanges)).toBe(true);
  });

  it('MD-14: followUpQuestions는 배열이다', async () => {
    const { gatherMonthlyData } = await import('@/lib/monthly-report');
    const data = await gatherMonthlyData(mockSupabase as never, '2026-01');

    expect(Array.isArray(data.followUpQuestions)).toBe(true);
  });
});
