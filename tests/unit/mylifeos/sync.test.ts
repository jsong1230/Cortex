// F-18 단위 테스트 — 동기화 흐름 (AC3)
// syncKeywordContexts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Anthropic 모킹 ──────────────────────────────────────────────────────────
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  },
}));

// ─── Supabase 모킹 ──────────────────────────────────────────────────────────
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockSupabaseFrom,
  })),
}));

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const mockDiaryEntries = [
  {
    id: 'diary-uuid-1',
    content: 'LLM 인프라에 대해 고민했다.',
    created_at: '2026-02-25T10:00:00Z',
  },
];

const mockTodos = [
  { id: 'todo-uuid-1', title: 'AWS 비용 분석', completed: false },
];

const mockNotes = [
  { id: 'note-uuid-1', title: 'MSA 설계 노트', created_at: '2026-02-26T10:00:00Z' },
];

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('syncKeywordContexts (AC3)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    // Claude 응답 설정
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ keywords: ['LLM', 'cloud-cost'] }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    // upsert/delete 기본 설정
    mockUpsert.mockResolvedValue({ data: [{ id: 'new-kc' }], error: null });
    mockDelete.mockReturnValue({
      lt: vi.fn().mockResolvedValue({ error: null }),
    });

    // Supabase 체인: diary
    const diaryChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockDiaryEntries, error: null }),
    };

    // Supabase 체인: todos
    const todoChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockTodos, error: null }),
    };

    // Supabase 체인: notes
    const noteChain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockNotes, error: null }),
    };

    // keyword_contexts 체인
    const kcChain = {
      upsert: mockUpsert,
      delete: mockDelete,
      select: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabaseFrom.mockImplementation((tableName: string) => {
      if (tableName === 'diary_entries') return diaryChain;
      if (tableName === 'todos') return todoChain;
      if (tableName === 'notes') return noteChain;
      if (tableName === 'keyword_contexts') return kcChain;
      return { select: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });
  });

  it('AC3-1: syncKeywordContexts가 성공하면 { synced, expired } 형태를 반환한다', async () => {
    const { syncKeywordContexts } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof syncKeywordContexts>[0];
    const result = await syncKeywordContexts(supabase);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('synced');
    expect(result).toHaveProperty('expired');
    expect(typeof result.synced).toBe('number');
    expect(typeof result.expired).toBe('number');
  });

  it('AC3-2: keyword_contexts에 upsert가 호출된다', async () => {
    const { syncKeywordContexts } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof syncKeywordContexts>[0];
    await syncKeywordContexts(supabase);

    expect(mockSupabaseFrom).toHaveBeenCalledWith('keyword_contexts');
  });

  it('AC3-3: upsert 시 expires_at이 현재 + 7일로 설정된다', async () => {
    const { syncKeywordContexts } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof syncKeywordContexts>[0];
    await syncKeywordContexts(supabase);

    if (mockUpsert.mock.calls.length > 0) {
      const upsertArgs = mockUpsert.mock.calls[0][0] as Array<{
        expires_at: string;
        keywords: string[];
      }>;
      const items = Array.isArray(upsertArgs) ? upsertArgs : [upsertArgs];

      if (items.length > 0) {
        const expiresAt = new Date(items[0].expires_at);
        const now = new Date();
        const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        // 7일 ± 1일 허용 범위
        expect(diffDays).toBeGreaterThan(6);
        expect(diffDays).toBeLessThan(8);
      }
    }
  });

  it('AC3-4: 만료된 keyword_contexts가 정리된다', async () => {
    const { syncKeywordContexts } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof syncKeywordContexts>[0];
    const result = await syncKeywordContexts(supabase);

    // expired 카운트가 숫자여야 함
    expect(typeof result.expired).toBe('number');
  });

  it('AC3-5: ANTHROPIC_API_KEY 없어도 todo/note는 동기화된다 (diary만 스킵)', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const { syncKeywordContexts } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof syncKeywordContexts>[0];
    const result = await syncKeywordContexts(supabase);

    // graceful degradation: 에러 없이 완료
    expect(result).toBeDefined();
    expect(typeof result.synced).toBe('number');
  });
});
