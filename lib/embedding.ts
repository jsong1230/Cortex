// pgvector 임베딩 생성 및 유사도 검색
// OpenAI text-embedding-3-small (1536 dim) 사용
// OPENAI_API_KEY 미설정 시 graceful degradation (빈 벡터 반환)

import { createServerClient } from '@/lib/supabase/server';

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// RPC 함수명 매핑 (테이블별)
const SEARCH_RPC_NAMES: Record<string, string> = {
  content_items: 'search_content_by_embedding',
  interest_profile: 'search_interests_by_embedding',
  keyword_contexts: 'search_contexts_by_embedding',
};

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
}

// OpenAI embeddings API 응답 타입
interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { total_tokens: number };
}

// OpenAI 에러 응답 타입
interface OpenAiErrorResponse {
  error: { message: string };
}

/**
 * 텍스트 임베딩 생성 (AC4)
 * OpenAI text-embedding-3-small (1536 dim) 사용
 * OPENAI_API_KEY 미설정 또는 API 오류 시 graceful degradation (빈 벡터 반환)
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  // OPENAI_API_KEY 미설정: graceful degradation
  if (!apiKey) {
    return { embedding: [], tokensUsed: 0 };
  }

  try {
    const response = await fetch(OPENAI_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      // API 오류: graceful degradation
      const errorBody = (await response.json()) as OpenAiErrorResponse;
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          event: 'cortex_embedding_api_error',
          status: response.status,
          error: errorBody?.error?.message ?? 'unknown',
        })
      );
      return { embedding: [], tokensUsed: 0 };
    }

    const result = (await response.json()) as OpenAiEmbeddingResponse;
    return {
      embedding: result.data[0].embedding,
      tokensUsed: result.usage.total_tokens,
    };
  } catch (err) {
    // 네트워크 오류: graceful degradation
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        event: 'cortex_embedding_network_error',
        error: errMsg,
      })
    );
    return { embedding: [], tokensUsed: 0 };
  }
}

// RPC 결과 아이템 타입
interface RpcResultItem {
  id: string;
}

/**
 * 유사한 콘텐츠 검색 (HNSW 인덱스 활용) (AC4)
 * @param embedding 쿼리 임베딩
 * @param tableName 검색할 테이블
 * @param limit 반환할 결과 수
 *
 * 빈 임베딩 또는 DB 오류 시 graceful degradation (빈 배열 반환)
 */
export async function searchSimilar(
  embedding: number[],
  tableName: 'content_items' | 'interest_profile' | 'keyword_contexts',
  limit = 10
): Promise<string[]> {
  // 빈 임베딩: graceful degradation
  if (embedding.length === 0) return [];

  const rpcName = SEARCH_RPC_NAMES[tableName] ?? 'search_content_by_embedding';

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc(rpcName, {
      query_embedding: embedding,
      match_count: limit,
    });

    if (error) {
      // DB 오류: graceful degradation
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          event: 'cortex_embedding_search_error',
          rpc: rpcName,
          error: error.message,
        })
      );
      return [];
    }

    return (data as RpcResultItem[]).map((item) => item.id);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        event: 'cortex_embedding_search_exception',
        error: errMsg,
      })
    );
    return [];
  }
}
