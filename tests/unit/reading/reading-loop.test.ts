// F-19 읽기 루프 — lib/reading-loop.ts 단위 테스트
// AC1: 상태 관리 (saved/reading/completed/archived)
// AC4: 30일 경과 자동 보관 로직

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase server 모킹 ─────────────────────────────────────────────────────

let mockUpsertData: Record<string, unknown> | null = null;
let mockUpsertError: { message: string } | null = null;
let mockUpdateData: Record<string, unknown>[] | null = [];
let mockUpdateError: { message: string } | null = null;
let mockSelectData: Record<string, unknown>[] | null = [];
let mockSelectError: { message: string } | null = null;

const buildMockChain = () => {
  const chain: Record<string, unknown> = {};
  const withResult = (result: () => Promise<unknown>) => ({
    ...chain,
    select: vi.fn().mockImplementation(() => withResult(result)),
    eq: vi.fn().mockImplementation(() => withResult(result)),
    neq: vi.fn().mockImplementation(() => withResult(result)),
    in: vi.fn().mockImplementation(() => withResult(result)),
    not: vi.fn().mockImplementation(() => withResult(result)),
    lt: vi.fn().mockImplementation(() => withResult(result)),
    gte: vi.fn().mockImplementation(() => withResult(result)),
    lte: vi.fn().mockImplementation(() => withResult(result)),
    order: vi.fn().mockImplementation(() => withResult(result)),
    limit: vi.fn().mockImplementation(() => withResult(result)),
    single: vi.fn().mockImplementation(result),
    then: (resolve: (v: unknown) => unknown) => result().then(resolve),
  });
  return withResult;
};

// 각 테이블별 mock from 구현
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeSavedItemRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'saved-item-uuid-001',
    content_id: 'content-uuid-001',
    status: 'saved',
    saved_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5일 전
    reading_started_at: null,
    completed_at: null,
    archived_at: null,
    ...overrides,
  };
}

// ─── saveItem 테스트 ──────────────────────────────────────────────────────────

describe('saveItem(contentId) — saved_items 레코드 생성', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockFrom.mockImplementation(() => ({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: makeSavedItemRow(),
            error: mockUpsertError,
          }),
        }),
      }),
    }));
  });

  it('RL-01: saveItem 호출 시 status=saved로 레코드를 생성한다', async () => {
    const { saveItem } = await import('@/lib/reading-loop');
    const result = await saveItem('content-uuid-001');

    expect(result.status).toBe('saved');
    expect(result.content_id).toBe('content-uuid-001');
  });

  it('RL-02: saveItem이 이미 저장된 경우 UPSERT로 멱등 처리된다', async () => {
    mockFrom.mockImplementation(() => ({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: makeSavedItemRow({ status: 'reading' }),
            error: null,
          }),
        }),
      }),
    }));

    const { saveItem } = await import('@/lib/reading-loop');
    const result = await saveItem('content-uuid-001');

    // 이미 reading 상태인 경우 그대로 반환
    expect(result.content_id).toBe('content-uuid-001');
  });
});

// ─── markAsReading 테스트 ─────────────────────────────────────────────────────

describe('markAsReading(contentId) — 읽는 중 상태 전환 (AC2)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: makeSavedItemRow({ status: 'reading', reading_started_at: new Date().toISOString() }),
              error: null,
            }),
          }),
        }),
      }),
    }));
  });

  it('RL-03: markAsReading 호출 시 status=reading, reading_started_at이 설정된다', async () => {
    const { markAsReading } = await import('@/lib/reading-loop');
    const result = await markAsReading('content-uuid-001');

    expect(result!.status).toBe('reading');
    expect(result!.reading_started_at).toBeDefined();
  });

  it('RL-04: 저장 기록이 없는 contentId에 대해 markAsReading은 null을 반환한다', async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Row not found' },
            }),
          }),
        }),
      }),
    }));

    const { markAsReading } = await import('@/lib/reading-loop');
    const result = await markAsReading('nonexistent-content-id');

    expect(result).toBeNull();
  });
});

// ─── markAsCompleted 테스트 ──────────────────────────────────────────────────

describe('markAsCompleted(contentId) — 완독 처리 (AC3)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: makeSavedItemRow({ status: 'completed', completed_at: new Date().toISOString() }),
              error: null,
            }),
          }),
        }),
      }),
    }));
  });

  it('RL-05: markAsCompleted 호출 시 status=completed, completed_at이 설정된다', async () => {
    const { markAsCompleted } = await import('@/lib/reading-loop');
    const result = await markAsCompleted('content-uuid-001');

    expect(result.status).toBe('completed');
    expect(result.completed_at).toBeDefined();
  });
});

// ─── archiveExpiredItems 테스트 ──────────────────────────────────────────────

describe('archiveExpiredItems() — 30일 경과 자동 보관 (AC4)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // 만료된 아이템 2개를 archived 상태로 업데이트
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [
                makeSavedItemRow({ status: 'archived', saved_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString() }),
                makeSavedItemRow({ id: 'saved-item-uuid-002', content_id: 'content-uuid-002', status: 'archived' }),
              ],
              error: null,
            }),
          }),
        }),
      }),
    }));
  });

  it('RL-06: archiveExpiredItems 호출 시 30일 경과 미완독 아이템이 archived 상태로 변경된다', async () => {
    const { archiveExpiredItems } = await import('@/lib/reading-loop');
    const archivedCount = await archiveExpiredItems();

    expect(archivedCount).toBe(2);
  });

  it('RL-07: 만료된 아이템이 없으면 0을 반환한다', async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    }));

    const { archiveExpiredItems } = await import('@/lib/reading-loop');
    const archivedCount = await archiveExpiredItems();

    expect(archivedCount).toBe(0);
  });
});

// ─── getItemsNearingArchive 테스트 ───────────────────────────────────────────

describe('getItemsNearingArchive() — 25일~30일 사이 미완독 아이템 조회 (AC6)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    const nearingItems = [
      {
        ...makeSavedItemRow({ saved_at: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString() }),
        content_items: { title: '곧 보관 예정 아이템 1', source_url: 'https://example.com/1' },
      },
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: nearingItems,
                error: null,
              }),
            }),
          }),
        }),
      }),
    }));
  });

  it('RL-08: getItemsNearingArchive는 25~30일 사이 미완독 아이템을 반환한다', async () => {
    const { getItemsNearingArchive } = await import('@/lib/reading-loop');
    const items = await getItemsNearingArchive();

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toBeDefined();
    expect(items[0].source_url).toBeDefined();
  });
});

// ─── getUnreadItems 테스트 ───────────────────────────────────────────────────

describe('getUnreadItems() — 미완독 아이템 조회 (AC5)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    const unreadItems = [
      {
        ...makeSavedItemRow({ status: 'saved' }),
        content_items: { title: '미완독 아이템 1', source_url: 'https://example.com/1' },
      },
      {
        ...makeSavedItemRow({ id: 'saved-item-uuid-002', content_id: 'content-uuid-002', status: 'reading' }),
        content_items: { title: '읽는 중 아이템 2', source_url: 'https://example.com/2' },
      },
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: unreadItems,
            error: null,
          }),
        }),
      }),
    }));
  });

  it('RL-09: getUnreadItems는 status가 saved 또는 reading인 아이템을 반환한다', async () => {
    const { getUnreadItems } = await import('@/lib/reading-loop');
    const items = await getUnreadItems();

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(2);
    expect(items.every((item) => item.status === 'saved' || item.status === 'reading')).toBe(true);
  });
});

// ─── getMonthlyUnreadSummary 테스트 ──────────────────────────────────────────

describe('getMonthlyUnreadSummary() — 월간 미완독 요약 (AC7)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            makeSavedItemRow({ status: 'saved' }),
            makeSavedItemRow({ id: 'saved-uuid-2', content_id: 'content-uuid-002', status: 'saved' }),
            makeSavedItemRow({ id: 'saved-uuid-3', content_id: 'content-uuid-003', status: 'reading' }),
          ],
          error: null,
        }),
      }),
    }));
  });

  it('RL-10: getMonthlyUnreadSummary는 상태별 카운트를 반환한다', async () => {
    const { getMonthlyUnreadSummary } = await import('@/lib/reading-loop');
    const summary = await getMonthlyUnreadSummary();

    expect(typeof summary.total).toBe('number');
    expect(typeof summary.saved).toBe('number');
    expect(typeof summary.reading).toBe('number');
  });
});
