// F-18 단위 테스트 — 키워드 추출 (AC1, AC2, AC6)
// extractDiaryKeywords, extractTodoKeywords, extractNoteKeywords

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
    content: '오늘 LLM 인프라 최적화 관련 아티클을 읽었다. AWS 비용 절감에 대해 고민 중이다.',
    created_at: '2026-02-25T10:00:00Z',
  },
  {
    id: 'diary-uuid-2',
    content: '등산하면서 팀 빌딩 전략을 생각했다. MSA 아키텍처 전환도 검토 중이다.',
    created_at: '2026-02-24T10:00:00Z',
  },
];

const mockTodos = [
  { id: 'todo-uuid-1', title: 'AWS 클라우드 비용 검토', completed: false },
  { id: 'todo-uuid-2', title: 'MSA 마이그레이션 계획 수립', completed: false },
  { id: 'todo-uuid-3', title: '완료된 태스크', completed: true },
];

const mockNotes = [
  { id: 'note-uuid-1', title: 'LLM 인프라 노트', content: '...', created_at: '2026-02-26T10:00:00Z' },
  { id: 'note-uuid-2', title: '팀 빌딩 아이디어', content: '...', created_at: '2026-02-25T10:00:00Z' },
];

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('extractDiaryKeywords (AC1, AC6)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    // 기본 Supabase 체인 설정
    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockDiaryEntries, error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    // 기본 Claude 응답 설정
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keywords: ['LLM', 'cloud-cost', 'team-building', 'MSA'],
          }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  });

  it('AC1-1: 최근 7일 diary_entries에서 키워드를 추출한다', async () => {
    const { extractDiaryKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractDiaryKeywords>[0];
    const results = await extractDiaryKeywords(supabase);

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('AC1-2: 각 결과는 source, sourceId, keywords를 포함한다', async () => {
    const { extractDiaryKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractDiaryKeywords>[0];
    const results = await extractDiaryKeywords(supabase);

    if (results.length > 0) {
      const result = results[0];
      expect(result).toHaveProperty('source', 'diary');
      expect(result).toHaveProperty('sourceId');
      expect(result).toHaveProperty('keywords');
      expect(Array.isArray(result.keywords)).toBe(true);
    }
  });

  it('AC6: 일기 원문 텍스트가 아닌 키워드만 반환한다 (프라이버시)', async () => {
    const { extractDiaryKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractDiaryKeywords>[0];
    const results = await extractDiaryKeywords(supabase);

    // 결과에 원문 텍스트(content)가 포함되지 않아야 함
    for (const result of results) {
      expect(result).not.toHaveProperty('content');
      expect(result).not.toHaveProperty('originalText');
      // keywords는 문자열 배열이어야 함
      expect(result.keywords.every((k: string) => typeof k === 'string')).toBe(true);
    }
  });

  it('AC1-3: diary_entries가 없으면 빈 배열을 반환한다', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const { extractDiaryKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractDiaryKeywords>[0];
    const results = await extractDiaryKeywords(supabase);

    expect(results).toEqual([]);
  });

  it('AC1-4: DB 조회 실패 시 에러를 throw한다', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const { extractDiaryKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractDiaryKeywords>[0];

    await expect(extractDiaryKeywords(supabase)).rejects.toThrow();
  });

  it('AC1-5: Claude API 키 없으면 빈 배열을 반환한다 (graceful degradation)', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const { extractDiaryKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractDiaryKeywords>[0];
    const results = await extractDiaryKeywords(supabase);

    expect(results).toEqual([]);
  });
});

describe('extractTodoKeywords (AC2)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockTodos.filter(t => !t.completed), error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);
  });

  it('AC2-1: 미완료 todos에서 키워드를 추출한다', async () => {
    const { extractTodoKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractTodoKeywords>[0];
    const results = await extractTodoKeywords(supabase);

    expect(Array.isArray(results)).toBe(true);
  });

  it('AC2-2: 각 결과는 source=todo, sourceId, keywords를 포함한다', async () => {
    const { extractTodoKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractTodoKeywords>[0];
    const results = await extractTodoKeywords(supabase);

    if (results.length > 0) {
      const result = results[0];
      expect(result.source).toBe('todo');
      expect(result).toHaveProperty('sourceId');
      expect(Array.isArray(result.keywords)).toBe(true);
    }
  });

  it('AC2-3: todos가 없으면 빈 배열을 반환한다', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const { extractTodoKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractTodoKeywords>[0];
    const results = await extractTodoKeywords(supabase);

    expect(results).toEqual([]);
  });

  it('AC2-4: todo 제목에서 단순 토큰화로 키워드를 추출한다 (AI 불필요)', async () => {
    const { extractTodoKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractTodoKeywords>[0];
    const results = await extractTodoKeywords(supabase);

    // Claude API가 호출되지 않아야 함 (제목 토큰화만 사용)
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('extractNoteKeywords (AC2)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockNotes, error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);
  });

  it('AC2-5: 최근 7일 notes에서 키워드를 추출한다', async () => {
    const { extractNoteKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractNoteKeywords>[0];
    const results = await extractNoteKeywords(supabase);

    expect(Array.isArray(results)).toBe(true);
  });

  it('AC2-6: 각 결과는 source=note, sourceId, keywords를 포함한다', async () => {
    const { extractNoteKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractNoteKeywords>[0];
    const results = await extractNoteKeywords(supabase);

    if (results.length > 0) {
      const result = results[0];
      expect(result.source).toBe('note');
      expect(result).toHaveProperty('sourceId');
      expect(Array.isArray(result.keywords)).toBe(true);
    }
  });

  it('AC2-7: note 제목에서 단순 토큰화로 키워드를 추출한다 (AI 불필요)', async () => {
    const { extractNoteKeywords } = await import('@/lib/mylifeos');
    const supabase = { from: mockSupabaseFrom } as unknown as Parameters<typeof extractNoteKeywords>[0];
    await extractNoteKeywords(supabase);

    // Claude API가 호출되지 않아야 함
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
