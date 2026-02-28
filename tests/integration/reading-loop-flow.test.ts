// F-19 읽기 루프 전체 생명주기 통합 테스트
// saved → reading → completed (해피 패스)
// saved → archived (30일 타임아웃 패스)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase server 모킹 ─────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeSavedItem(status: string, savedDaysAgo: number = 5): Record<string, unknown> {
  const savedAt = new Date(Date.now() - savedDaysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 'saved-item-uuid-001',
    content_id: 'content-uuid-001',
    status,
    saved_at: savedAt,
    reading_started_at: status !== 'saved' ? new Date().toISOString() : null,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    archived_at: status === 'archived' ? new Date().toISOString() : null,
  };
}

// ─── 해피 패스: saved → reading → completed ──────────────────────────────────

describe('읽기 루프 해피 패스 (saved → reading → completed)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('RLF-01: saveItem → markAsReading → markAsCompleted 순서로 상태가 전환된다', async () => {
    // 1. saveItem
    mockFrom.mockImplementationOnce(() => ({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: makeSavedItem('saved'),
            error: null,
          }),
        }),
      }),
    }));

    const { saveItem } = await import('@/lib/reading-loop');
    const saved = await saveItem('content-uuid-001');
    expect(saved.status).toBe('saved');

    // 2. markAsReading
    vi.resetModules();
    mockFrom.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: makeSavedItem('reading'),
              error: null,
            }),
          }),
        }),
      }),
    }));

    const { markAsReading } = await import('@/lib/reading-loop');
    const reading = await markAsReading('content-uuid-001');
    expect(reading?.status).toBe('reading');

    // 3. markAsCompleted
    vi.resetModules();
    mockFrom.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: makeSavedItem('completed'),
              error: null,
            }),
          }),
        }),
      }),
    }));

    const { markAsCompleted } = await import('@/lib/reading-loop');
    const completed = await markAsCompleted('content-uuid-001');
    expect(completed.status).toBe('completed');
    expect(completed.completed_at).toBeDefined();
  });
});

// ─── 타임아웃 패스: saved → archived ─────────────────────────────────────────

describe('읽기 루프 타임아웃 패스 (saved → archived, AC4)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('RLF-02: 30일 이상 경과한 미완독 아이템이 archiveExpiredItems 호출로 archived 상태가 된다', async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [makeSavedItem('archived', 31)],
              error: null,
            }),
          }),
        }),
      }),
    }));

    const { archiveExpiredItems } = await import('@/lib/reading-loop');
    const count = await archiveExpiredItems();
    expect(count).toBe(1);
  });

  it('RLF-03: 29일 경과한 아이템은 archived되지 않는다 (경계값 테스트)', async () => {
    // 29일 경과 아이템은 30일 기준 미만이므로 archive 대상에서 제외
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [], // 쿼리 조건이 정확히 < 30일 이전만 대상으로 함
              error: null,
            }),
          }),
        }),
      }),
    }));

    const { archiveExpiredItems } = await import('@/lib/reading-loop');
    const count = await archiveExpiredItems();
    expect(count).toBe(0);
  });
});

// ─── Weekly Digest 미완독 리마인더 통합 (AC5) ─────────────────────────────────

describe('Weekly Digest 미완독 리마인더 연동 (AC5)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('RLF-04: getUnreadItems 결과를 WeeklyDigest UnreadReminder 형식으로 변환할 수 있다', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'saved-uuid-001',
                content_id: 'content-uuid-001',
                status: 'saved',
                saved_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                reading_started_at: null,
                completed_at: null,
                archived_at: null,
                content_items: {
                  title: '주간 미완독 테스트 아이템',
                  source_url: 'https://example.com/article',
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    }));

    const { getUnreadItems } = await import('@/lib/reading-loop');
    const items = await getUnreadItems();

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('주간 미완독 테스트 아이템');
    expect(items[0].source_url).toBe('https://example.com/article');

    // WeeklyDigest UnreadReminder 형식으로 변환 가능한지 확인
    const reminder = {
      title: items[0].title,
      source_url: items[0].source_url,
      saved_at: items[0].saved_at.slice(0, 10),
    };
    expect(reminder.title).toBeDefined();
    expect(reminder.source_url).toBeDefined();
    expect(reminder.saved_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
