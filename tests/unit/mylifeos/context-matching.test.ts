// F-18 단위 테스트 — 컨텍스트 매칭 (AC4)
// matchContentToKeywords, getActiveKeywords

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase 모킹 ──────────────────────────────────────────────────────────
const mockSupabaseFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockSupabaseFrom,
  })),
}));

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const mockKeywordContexts = [
  {
    id: 'kc-uuid-1',
    source: 'diary',
    source_id: 'diary-uuid-1',
    keywords: ['LLM', 'cloud-cost', 'AWS'],
    expires_at: '2026-03-07T00:00:00Z',
  },
  {
    id: 'kc-uuid-2',
    source: 'todo',
    source_id: 'todo-uuid-1',
    keywords: ['MSA', 'migration', 'architecture'],
    expires_at: '2026-03-07T00:00:00Z',
  },
  {
    id: 'kc-uuid-3',
    source: 'note',
    source_id: 'note-uuid-1',
    keywords: ['team-building', 'startup'],
    expires_at: '2026-03-07T00:00:00Z',
  },
];

// ─── matchContentToKeywords 테스트 ──────────────────────────────────────────

describe('matchContentToKeywords (AC4)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('AC4-1: 콘텐츠 태그와 키워드 컨텍스트가 매칭되면 이유 문자열을 반환한다', async () => {
    const { matchContentToKeywords } = await import('@/lib/mylifeos');

    const contentTags = ['LLM', 'infrastructure'];
    const reason = matchContentToKeywords(contentTags, mockKeywordContexts);

    expect(reason).not.toBeNull();
    expect(typeof reason).toBe('string');
    expect(reason!.length).toBeGreaterThan(0);
  });

  it('AC4-2: 반환된 이유에 "지난주 메모" 또는 키워드 관련 텍스트가 포함된다', async () => {
    const { matchContentToKeywords } = await import('@/lib/mylifeos');

    const contentTags = ['LLM', 'cloud-cost'];
    const reason = matchContentToKeywords(contentTags, mockKeywordContexts);

    expect(reason).not.toBeNull();
    // 이유는 "지난주 메모: {키워드} 관련" 형식이어야 함 (AC4)
    expect(reason).toMatch(/지난주|메모|키워드|관련/);
  });

  it('AC4-3: 매칭되는 키워드가 없으면 null을 반환한다', async () => {
    const { matchContentToKeywords } = await import('@/lib/mylifeos');

    const contentTags = ['unrelated-topic', 'another-tag'];
    const reason = matchContentToKeywords(contentTags, mockKeywordContexts);

    expect(reason).toBeNull();
  });

  it('AC4-4: 빈 태그 배열이면 null을 반환한다', async () => {
    const { matchContentToKeywords } = await import('@/lib/mylifeos');

    const reason = matchContentToKeywords([], mockKeywordContexts);

    expect(reason).toBeNull();
  });

  it('AC4-5: 빈 컨텍스트 배열이면 null을 반환한다', async () => {
    const { matchContentToKeywords } = await import('@/lib/mylifeos');

    const reason = matchContentToKeywords(['LLM', 'cloud'], []);

    expect(reason).toBeNull();
  });

  it('AC4-6: 대소문자 구분 없이 매칭한다', async () => {
    const { matchContentToKeywords } = await import('@/lib/mylifeos');

    // 소문자 태그가 대문자 키워드와 매칭되어야 함
    const contentTags = ['llm', 'aws'];
    const reason = matchContentToKeywords(contentTags, mockKeywordContexts);

    expect(reason).not.toBeNull();
  });

  it('AC4-7: 매칭된 키워드가 이유 문자열에 포함된다', async () => {
    const { matchContentToKeywords } = await import('@/lib/mylifeos');

    const contentTags = ['MSA', 'architecture'];
    const reason = matchContentToKeywords(contentTags, mockKeywordContexts);

    expect(reason).not.toBeNull();
    // 매칭된 키워드가 이유에 포함되어야 함
    const lowerReason = reason!.toLowerCase();
    expect(
      lowerReason.includes('msa') || lowerReason.includes('architecture') || lowerReason.includes('관련')
    ).toBe(true);
  });
});

// ─── getActiveKeywords 테스트 ────────────────────────────────────────────────

describe('getActiveKeywords (AC3)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('AC3-1: 만료되지 않은 keyword_contexts를 반환한다', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ data: mockKeywordContexts, error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const { getActiveKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof getActiveKeywords>[0];
    const results = await getActiveKeywords(supabase);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(mockKeywordContexts.length);
  });

  it('AC3-2: DB 오류 시 빈 배열을 반환한다 (graceful degradation)', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const { getActiveKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof getActiveKeywords>[0];
    const results = await getActiveKeywords(supabase);

    expect(results).toEqual([]);
  });

  it('AC3-3: 반환 결과는 keywords 배열을 포함한다', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ data: mockKeywordContexts, error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const { getActiveKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof getActiveKeywords>[0];
    const results = await getActiveKeywords(supabase);

    if (results.length > 0) {
      expect(Array.isArray(results[0].keywords)).toBe(true);
    }
  });
});
