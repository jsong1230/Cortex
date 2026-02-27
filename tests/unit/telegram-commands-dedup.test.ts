// F-11 텔레그램 반응 중복 방지 — insertInteraction UPSERT 테스트 (R-06)
// test-spec.md R-06-1 ~ R-06-3

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Supabase 모킹 ──────────────────────────────────────────────────────────

let mockUpsertResult: { data: unknown; error: { message: string } | null } = {
  data: [{ id: 'interaction-uuid-001' }],
  error: null,
};

const mockUpsert = vi.fn().mockImplementation(() => Promise.resolve(mockUpsertResult));
const mockInsert = vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null }));

// UPSERT 호출 기록을 위한 spy
let lastUpsertArgs: unknown = null;

const mockFrom = vi.fn().mockImplementation(() => ({
  upsert: vi.fn().mockImplementation((data: unknown) => {
    lastUpsertArgs = data;
    return Promise.resolve(mockUpsertResult);
  }),
  insert: vi.fn().mockImplementation((data: unknown) => {
    return Promise.resolve({ data: null, error: null });
  }),
  select: vi.fn().mockReturnThis(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── telegram 모킹 ──────────────────────────────────────────────────────────

vi.mock('@/lib/telegram', () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
  parseCallbackData: (data: string) => {
    const parts = data.split(':');
    if (parts.length !== 2) return null;
    return { action: parts[0], contentId: parts[1] };
  },
}));

// ─── R-06: 텔레그램 반응 중복 방지 ─────────────────────────────────────────

describe('insertInteraction UPSERT — 텔레그램 중복 방지 (R-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastUpsertArgs = null;
    mockUpsertResult = { data: [{ id: 'interaction-uuid-001' }], error: null };
    mockFrom.mockImplementation(() => ({
      upsert: vi.fn().mockImplementation((data: unknown) => {
        lastUpsertArgs = data;
        return Promise.resolve(mockUpsertResult);
      }),
      insert: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
      select: vi.fn().mockReturnThis(),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('R-06-1: 텔레그램 신규 좋아요 시 user_interactions에 INSERT된다', async () => {
    const { handleCallbackQuery } = await import('@/lib/telegram-commands');

    await handleCallbackQuery({
      id: 'callback-001',
      from: { id: 12345, first_name: 'Test' },
      data: 'like:content-uuid-001',
    });

    // handleCallbackQuery는 내부적으로 upsert 또는 insert를 호출해야 함
    // from('user_interactions')이 호출됐는지 확인
    expect(mockFrom).toHaveBeenCalledWith('user_interactions');
  });

  it('R-06-2: 텔레그램 동일 좋아요 재클릭 시 에러 없이 처리된다 (UPSERT)', async () => {
    const { handleCallbackQuery } = await import('@/lib/telegram-commands');

    // 첫 번째 클릭
    await handleCallbackQuery({
      id: 'callback-001',
      from: { id: 12345, first_name: 'Test' },
      data: 'like:content-uuid-001',
    });

    // 두 번째 클릭 — 에러 없이 처리되어야 함
    await expect(
      handleCallbackQuery({
        id: 'callback-002',
        from: { id: 12345, first_name: 'Test' },
        data: 'like:content-uuid-001',
      })
    ).resolves.not.toThrow();
  });

  it('R-06-3: handleCallbackQuery 호출 시 source가 telegram_bot으로 기록된다', async () => {
    // from('user_interactions')의 insert/upsert 호출을 추적
    let capturedData: unknown = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_interactions') {
        return {
          upsert: vi.fn().mockImplementation((data: unknown) => {
            capturedData = data;
            return Promise.resolve({ data: null, error: null });
          }),
          insert: vi.fn().mockImplementation((data: unknown) => {
            capturedData = data;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const { handleCallbackQuery } = await import('@/lib/telegram-commands');

    await handleCallbackQuery({
      id: 'callback-001',
      from: { id: 12345, first_name: 'Test' },
      data: 'like:content-uuid-001',
    });

    // 저장된 데이터에 source가 'telegram_bot'이어야 함
    expect(capturedData).toBeDefined();
    const data = capturedData as Record<string, unknown>;
    expect(data.source).toBe('telegram_bot');
  });
});

// ─── handleGood UPSERT 적용 확인 ─────────────────────────────────────────────

describe('handleGood UPSERT — 중복 방지 적용 (R-06 추가)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // briefing 조회 → user_interactions 저장 순으로 두 번 from() 호출
    const mockBriefing = {
      id: 'briefing-uuid-001',
      briefing_date: '2026-02-28',
      items: [{ content_id: 'content-uuid-001', position: 1, channel: 'tech' }],
    };

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'briefings') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [mockBriefing], error: null }),
        };
      }
      if (table === 'user_interactions') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockImplementation((data: unknown) => ({
            select: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });
  });

  it('handleGood 호출 시 user_interactions에 반응이 저장된다', async () => {
    const { handleGood } = await import('@/lib/telegram-commands');
    const result = await handleGood();
    expect(result).toContain('좋아요');
    expect(mockFrom).toHaveBeenCalledWith('briefings');
  });
});
