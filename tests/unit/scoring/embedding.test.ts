// F-13 학습 엔진 — 임베딩 생성/검색 단위 테스트 (RED → GREEN)
// AC4: pgvector로 콘텐츠/토픽 임베딩이 생성되어 유사도 검색이 가능하다

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalEnv = { ...process.env };

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // 환경변수 복원
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
    vi.restoreAllMocks();
  });

  it('AC4: OPENAI_API_KEY가 설정되면 임베딩 벡터를 반환한다', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';

    // OpenAI embeddings API 응답 모킹
    const mockEmbedding = new Array(1536).fill(0).map((_, i) => i * 0.001);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 10 },
        }),
      })
    );

    const { generateEmbedding } = await import('@/lib/embedding');
    const result = await generateEmbedding('test text');

    expect(result.embedding).toHaveLength(1536);
    expect(result.tokensUsed).toBe(10);
  });

  it('AC4: OPENAI_API_KEY가 없으면 graceful degradation — 빈 벡터를 반환한다', async () => {
    delete process.env.OPENAI_API_KEY;

    const { generateEmbedding } = await import('@/lib/embedding');
    const result = await generateEmbedding('test text');

    // graceful degradation: 빈 배열 반환 (throw 금지)
    expect(result).toBeDefined();
    expect(result.embedding).toHaveLength(0);
    expect(result.tokensUsed).toBe(0);
  });

  it('AC4: OpenAI API 오류(non-ok) 시 graceful degradation — 빈 벡터를 반환한다', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'rate limit exceeded' } }),
      })
    );

    const { generateEmbedding } = await import('@/lib/embedding');
    const result = await generateEmbedding('test text');

    // graceful degradation: throw 금지
    expect(result.embedding).toHaveLength(0);
    expect(result.tokensUsed).toBe(0);
  });

  it('임베딩 벡터 차원은 1536이어야 한다 (text-embedding-3-small)', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';

    const mockEmbedding = new Array(1536).fill(0.1);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 5 },
        }),
      })
    );

    const { generateEmbedding } = await import('@/lib/embedding');
    const result = await generateEmbedding('hello world');

    expect(result.embedding).toHaveLength(1536);
  });

  it('네트워크 오류 시 graceful degradation — 빈 벡터를 반환한다', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network timeout'))
    );

    const { generateEmbedding } = await import('@/lib/embedding');
    const result = await generateEmbedding('test text');

    // throw 금지
    expect(result.embedding).toHaveLength(0);
    expect(result.tokensUsed).toBe(0);
  });
});

describe('searchSimilar', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC4: 유사한 항목의 ID 배열을 반환한다', async () => {
    const mockIds = ['uuid-1', 'uuid-2', 'uuid-3'];

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        rpc: vi.fn().mockResolvedValue({
          data: mockIds.map((id) => ({ id })),
          error: null,
        }),
      })),
    }));

    const { searchSimilar } = await import('@/lib/embedding');
    const queryEmbedding = new Array(1536).fill(0.1);
    const results = await searchSimilar(queryEmbedding, 'content_items', 3);

    expect(results).toHaveLength(3);
    expect(results).toContain('uuid-1');
  });

  it('AC4: limit 파라미터가 RPC에 전달된다', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ id: 'uuid-1' }, { id: 'uuid-2' }],
      error: null,
    });

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        rpc: mockRpc,
      })),
    }));

    const { searchSimilar } = await import('@/lib/embedding');
    const queryEmbedding = new Array(1536).fill(0.1);
    await searchSimilar(queryEmbedding, 'content_items', 2);

    expect(mockRpc).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ match_count: 2 })
    );
  });

  it('빈 임베딩이면 빈 배열을 반환한다 (graceful degradation)', async () => {
    const mockRpc = vi.fn();

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        rpc: mockRpc,
      })),
    }));

    const { searchSimilar } = await import('@/lib/embedding');
    const results = await searchSimilar([], 'content_items', 10);

    expect(results).toEqual([]);
    // 빈 임베딩이면 RPC를 호출하지 않는다
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('DB 오류 시 빈 배열을 반환한다 (graceful degradation)', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'rpc error' },
        }),
      })),
    }));

    const { searchSimilar } = await import('@/lib/embedding');
    const queryEmbedding = new Array(1536).fill(0.1);
    const results = await searchSimilar(queryEmbedding, 'content_items', 5);

    // graceful degradation: throw 금지
    expect(results).toEqual([]);
  });

  it('interest_profile 테이블 검색 시 올바른 RPC 함수명을 사용한다', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ id: 'topic-uuid-1' }],
      error: null,
    });

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        rpc: mockRpc,
      })),
    }));

    const { searchSimilar } = await import('@/lib/embedding');
    const queryEmbedding = new Array(1536).fill(0.1);
    await searchSimilar(queryEmbedding, 'interest_profile', 5);

    expect(mockRpc).toHaveBeenCalledWith(
      'search_interests_by_embedding',
      expect.any(Object)
    );
  });
});
