-- Cortex 핵심 테이블 마이그레이션
-- 실행 순서: 001 → 002 → 003
-- My Life OS와 동일한 Supabase 인스턴스 사용 (테이블 이름 충돌 주의)

-- pgvector 확장 활성화 (없으면 설치)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- content_items — 수집된 콘텐츠 저장 핵심 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS content_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       TEXT NOT NULL,          -- 'tech' | 'world' | 'culture' | 'canada'
  source        TEXT NOT NULL,          -- 'hackernews' | 'naver_news' | 'melon' 등
  source_url    TEXT NOT NULL UNIQUE,   -- 중복 수집 방지 키
  title         TEXT NOT NULL,
  summary_ai    TEXT,                   -- Claude가 생성한 1~2줄 요약
  full_text     TEXT,
  embedding     VECTOR(1536),           -- pgvector 임베딩
  published_at  TIMESTAMPTZ,
  collected_at  TIMESTAMPTZ DEFAULT NOW(),
  tags          TEXT[],                 -- AI가 추출한 토픽 태그
  score_initial FLOAT DEFAULT 0.5       -- AI 초기 관심도 점수 (0.0~1.0)
);

-- content_items 인덱스
CREATE INDEX IF NOT EXISTS idx_content_items_channel
  ON content_items(channel);
CREATE INDEX IF NOT EXISTS idx_content_items_collected_at
  ON content_items(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_source_url
  ON content_items(source_url);

-- content_items HNSW 벡터 인덱스 (소규모 데이터셋 최적)
CREATE INDEX IF NOT EXISTS idx_content_embedding
  ON content_items
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- briefings — 매일 발송된 브리핑 기록 (날짜당 1건)
-- ============================================================
CREATE TABLE IF NOT EXISTS briefings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date     DATE NOT NULL UNIQUE,
  items             JSONB NOT NULL,       -- [{content_id, position, channel, reason}]
  telegram_sent_at  TIMESTAMPTZ,
  telegram_opened   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- briefings 인덱스
CREATE INDEX IF NOT EXISTS idx_briefings_date
  ON briefings(briefing_date DESC);

-- ============================================================
-- user_interactions — 반응 로그 (학습 엔진 핵심 데이터)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   UUID REFERENCES content_items(id) ON DELETE CASCADE,
  briefing_id  UUID REFERENCES briefings(id) ON DELETE SET NULL,
  interaction  TEXT NOT NULL,   -- '좋아요' | '싫어요' | '저장' | '메모' | '웹열기' | '링크클릭' | '스킵'
  memo_text    TEXT,            -- 메모 반응 시 텍스트
  source       TEXT,            -- 'telegram_bot' | 'web'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- user_interactions 인덱스
CREATE INDEX IF NOT EXISTS idx_interactions_content
  ON user_interactions(content_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created
  ON user_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_type
  ON user_interactions(interaction);

-- ============================================================
-- interest_profile — 학습된 관심사 프로필 (EMA 점수)
-- ============================================================
CREATE TABLE IF NOT EXISTS interest_profile (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL UNIQUE,
  score             FLOAT DEFAULT 0.5,    -- 0.0 ~ 1.0 (EMA 업데이트)
  interaction_count INT DEFAULT 0,
  last_updated      TIMESTAMPTZ DEFAULT NOW(),
  embedding         VECTOR(1536)          -- 토픽 임베딩 (유사도 검색용)
);

-- interest_profile 인덱스
CREATE INDEX IF NOT EXISTS idx_interest_score
  ON interest_profile(score DESC);

-- interest_profile HNSW 벡터 인덱스
CREATE INDEX IF NOT EXISTS idx_interest_embedding
  ON interest_profile
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- keyword_contexts — My Life OS 일기/메모 키워드 (7일 TTL)
-- ============================================================
CREATE TABLE IF NOT EXISTS keyword_contexts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source     TEXT,             -- '일기' | '할일' | '메모'
  source_id  UUID,             -- My Life OS 원본 레코드 ID
  keywords   TEXT[],
  embedding  VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ       -- 7일 TTL (수집 시 설정)
);

-- keyword_contexts 인덱스
CREATE INDEX IF NOT EXISTS idx_keyword_contexts_expires
  ON keyword_contexts(expires_at);

-- keyword_contexts HNSW 벡터 인덱스
CREATE INDEX IF NOT EXISTS idx_keyword_embedding
  ON keyword_contexts
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
