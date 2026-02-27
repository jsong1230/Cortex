-- F-13 학습 엔진 마이그레이션
-- 1. interest_profile에 archived_at 컬럼 추가
-- 2. 벡터 유사도 검색 RPC 함수 추가
-- 3. 토픽 batch upsert RPC 추가
-- 4. 자동 보관 함수 추가

-- ============================================================
-- 1. interest_profile — archived_at 컬럼 추가 (AC5)
-- ============================================================
ALTER TABLE interest_profile
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- 보관 여부 인덱스 (보관되지 않은 토픽 빠른 조회용)
CREATE INDEX IF NOT EXISTS idx_interest_archived_at
  ON interest_profile(archived_at)
  WHERE archived_at IS NULL;

-- 보관 대상 조회 복합 인덱스 (score + last_updated)
CREATE INDEX IF NOT EXISTS idx_interest_score_updated
  ON interest_profile(score, last_updated);

-- ============================================================
-- 2. 벡터 유사도 검색 RPC — content_items (AC4)
-- ============================================================
CREATE OR REPLACE FUNCTION search_content_by_embedding(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 10
)
RETURNS TABLE(id UUID, similarity FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM content_items c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 3. 벡터 유사도 검색 RPC — interest_profile (AC4)
-- ============================================================
CREATE OR REPLACE FUNCTION search_interests_by_embedding(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 10
)
RETURNS TABLE(id UUID, similarity FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ip.id,
    1 - (ip.embedding <=> query_embedding) AS similarity
  FROM interest_profile ip
  WHERE ip.embedding IS NOT NULL
    AND ip.archived_at IS NULL
  ORDER BY ip.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 4. 벡터 유사도 검색 RPC — keyword_contexts (AC4)
-- ============================================================
CREATE OR REPLACE FUNCTION search_contexts_by_embedding(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 10
)
RETURNS TABLE(id UUID, similarity FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM keyword_contexts kc
  WHERE kc.embedding IS NOT NULL
    AND (kc.expires_at IS NULL OR kc.expires_at > NOW())
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 5. 토픽 batch upsert RPC (AC1)
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_topics(
  topics TEXT[],
  default_score FLOAT DEFAULT 0.5
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count INT := 0;
  t TEXT;
BEGIN
  FOREACH t IN ARRAY topics
  LOOP
    INSERT INTO interest_profile (topic, score, interaction_count, last_updated)
    VALUES (t, default_score, 0, NOW())
    ON CONFLICT (topic) DO NOTHING;

    IF FOUND THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  RETURN inserted_count;
END;
$$;

-- ============================================================
-- 6. 자동 보관 함수 — 스코어 <= 0.2이고 3개월 이상 비활성 토픽 (AC5)
-- ============================================================
CREATE OR REPLACE FUNCTION archive_low_score_topics()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  archived_count INT;
  three_months_ago TIMESTAMPTZ := NOW() - INTERVAL '3 months';
BEGIN
  UPDATE interest_profile
  SET archived_at = NOW()
  WHERE score <= 0.2
    AND last_updated <= three_months_ago
    AND archived_at IS NULL;

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  RETURN json_build_object('archived_count', archived_count);
END;
$$;
