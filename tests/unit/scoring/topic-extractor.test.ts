// F-13 학습 엔진 — 토픽 추출 단위 테스트 (RED → GREEN)
// AC1: AI가 아티클에서 토픽을 자동 추출하여 interest_profile에 등록

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── extractTopicsFromTags (순수 함수 — 모킹 불필요) ──────────────────────────

describe('extractTopicsFromTags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('AC1: tags 배열로부터 토픽 목록을 반환한다', async () => {
    const { extractTopicsFromTags } = await import('@/lib/topic-extractor');
    const tags = ['AI', 'Machine Learning', 'Python'];
    const topics = extractTopicsFromTags(tags);
    expect(topics).toEqual(['AI', 'Machine Learning', 'Python']);
  });

  it('빈 태그 배열이면 빈 배열을 반환한다', async () => {
    const { extractTopicsFromTags } = await import('@/lib/topic-extractor');
    expect(extractTopicsFromTags([])).toEqual([]);
  });

  it('중복 태그는 제거된다', async () => {
    const { extractTopicsFromTags } = await import('@/lib/topic-extractor');
    const tags = ['AI', 'AI', 'Python'];
    const topics = extractTopicsFromTags(tags);
    expect(topics).toHaveLength(2);
    expect(new Set(topics).size).toBe(topics.length);
  });

  it('빈 문자열 태그는 제외된다', async () => {
    const { extractTopicsFromTags } = await import('@/lib/topic-extractor');
    const tags = ['AI', '', '  ', 'Python'];
    const topics = extractTopicsFromTags(tags);
    expect(topics).not.toContain('');
    expect(topics.every((t) => t.trim().length > 0)).toBe(true);
  });

  it('앞뒤 공백이 있는 태그는 trim하여 포함한다', async () => {
    const { extractTopicsFromTags } = await import('@/lib/topic-extractor');
    const tags = ['  AI  ', 'Rust'];
    const topics = extractTopicsFromTags(tags);
    expect(topics).toContain('AI');
    expect(topics).toContain('Rust');
  });
});

// ─── registerTopicsToProfile (Supabase mock 필요) ────────────────────────────

describe('registerTopicsToProfile', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('AC1: 신규 토픽을 interest_profile에 upsert한다', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: mockUpsert,
        })),
      })),
    }));

    const { registerTopicsToProfile } = await import('@/lib/topic-extractor');
    await registerTopicsToProfile(['AI', 'Rust']);

    expect(mockUpsert).toHaveBeenCalled();
  });

  it('AC1: 신규 토픽은 score=0.5 기본값으로 등록한다', async () => {
    const capturedUpserts: unknown[] = [];

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
          upsert: vi.fn().mockImplementation((data: unknown) => {
            capturedUpserts.push(data);
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    }));

    const { registerTopicsToProfile } = await import('@/lib/topic-extractor');
    await registerTopicsToProfile(['NewTopic']);

    expect(capturedUpserts.length).toBeGreaterThan(0);
    const upserted = capturedUpserts[0] as Array<{ topic: string; score: number }>;
    const entries = Array.isArray(upserted) ? upserted : [upserted];
    const newEntry = entries.find((e) => e.topic === 'NewTopic');
    expect(newEntry?.score).toBe(0.5);
  });

  it('이미 존재하는 토픽은 upsert하지 않는다 (기존 score 유지)', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              // 'AI'는 이미 존재
              data: [{ topic: 'AI', score: 0.8, interaction_count: 5 }],
              error: null,
            }),
          }),
          upsert: mockUpsert,
        })),
      })),
    }));

    const { registerTopicsToProfile } = await import('@/lib/topic-extractor');
    // 'AI'만 전달 — 이미 존재하므로 upsert 호출 안 됨
    await registerTopicsToProfile(['AI']);

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('빈 토픽 배열이면 upsert를 호출하지 않는다', async () => {
    const mockUpsert = vi.fn();

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: mockUpsert,
        })),
      })),
    }));

    const { registerTopicsToProfile } = await import('@/lib/topic-extractor');
    await registerTopicsToProfile([]);

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('DB select 오류 시 에러를 throw한다', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'connection error' },
            }),
          }),
          upsert: vi.fn(),
        })),
      })),
    }));

    const { registerTopicsToProfile } = await import('@/lib/topic-extractor');
    await expect(registerTopicsToProfile(['AI'])).rejects.toThrow();
  });
});
