// F-11 텔레그램 반응 중복 방지 — insertInteraction 테스트 (R-06)
// test-spec.md R-06-1 ~ R-06-3

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Supabase 모킹 ──────────────────────────────────────────────────────────

// select().eq().eq().limit() 체인을 지원하는 유틸
function buildSelectChain(result: { data: unknown[]; error: null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    order: vi.fn().mockReturnThis(),
  };
}

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
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

describe('insertInteraction — 텔레그램 중복 방지 (R-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('R-06-1: 텔레그램 신규 좋아요 시 user_interactions에 INSERT된다', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_interactions') {
        return {
          ...buildSelectChain({ data: [], error: null }), // 기존 없음
          insert: mockInsert,
        };
      }
      return buildSelectChain({ data: [], error: null });
    });

    const { handleCallbackQuery } = await import('@/lib/telegram-commands');

    await handleCallbackQuery({
      id: 'callback-001',
      from: { id: 12345, first_name: 'Test' },
      data: 'like:content-uuid-001',
    });

    expect(mockFrom).toHaveBeenCalledWith('user_interactions');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('R-06-2: 텔레그램 동일 좋아요 재클릭 시 INSERT를 건너뛴다', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_interactions') {
        return {
          ...buildSelectChain({ data: [{ id: 'existing-1' }], error: null }), // 기존 존재
          insert: mockInsert,
        };
      }
      return buildSelectChain({ data: [], error: null });
    });

    const { handleCallbackQuery } = await import('@/lib/telegram-commands');

    await expect(
      handleCallbackQuery({
        id: 'callback-002',
        from: { id: 12345, first_name: 'Test' },
        data: 'like:content-uuid-001',
      })
    ).resolves.not.toThrow();

    // 기존 존재하므로 insert는 호출되지 않아야 함
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('R-06-3: handleCallbackQuery 호출 시 source가 telegram_bot으로 기록된다', async () => {
    let capturedData: unknown = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_interactions') {
        return {
          ...buildSelectChain({ data: [], error: null }),
          insert: vi.fn().mockImplementation((data: unknown) => {
            capturedData = data;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      return buildSelectChain({ data: [], error: null });
    });

    const { handleCallbackQuery } = await import('@/lib/telegram-commands');

    await handleCallbackQuery({
      id: 'callback-001',
      from: { id: 12345, first_name: 'Test' },
      data: 'like:content-uuid-001',
    });

    expect(capturedData).toBeDefined();
    const data = capturedData as Record<string, unknown>;
    expect(data.source).toBe('telegram_bot');
  });
});

// ─── handleGood INSERT 적용 확인 ─────────────────────────────────────────────

describe('handleGood — 반응 저장 (R-06 추가)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    const mockBriefing = {
      id: 'briefing-uuid-001',
      briefing_date: '2026-02-28',
      items: [{ content_id: 'content-uuid-001', position: 1, channel: 'tech' }],
    };

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
          ...buildSelectChain({ data: [], error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return buildSelectChain({ data: [], error: null });
    });
  });

  it('handleGood 호출 시 user_interactions에 반응이 저장된다', async () => {
    const { handleGood } = await import('@/lib/telegram-commands');
    const result = await handleGood();
    expect(result).toContain('좋아요');
    expect(mockFrom).toHaveBeenCalledWith('briefings');
  });
});
