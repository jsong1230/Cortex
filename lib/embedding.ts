// pgvector 임베딩 생성 및 유사도 검색
// Claude API 임베딩 엔드포인트 사용

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
}

/**
 * 텍스트 임베딩 생성
 * content_items, interest_profile, keyword_contexts에서 사용
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  // TODO: Phase 2
  // Claude API 또는 Anthropic Embeddings API 사용
  void text;
  throw new Error('Not implemented');
}

/**
 * 유사한 콘텐츠 검색 (HNSW 인덱스 활용)
 * @param embedding 쿼리 임베딩
 * @param tableName 검색할 테이블
 * @param limit 반환할 결과 수
 */
export async function searchSimilar(
  embedding: number[],
  tableName: 'content_items' | 'interest_profile' | 'keyword_contexts',
  limit = 10
): Promise<string[]> {
  // TODO: Phase 2
  // Supabase RPC로 vector_cosine_similarity 검색
  void embedding;
  void tableName;
  void limit;
  throw new Error('Not implemented');
}
