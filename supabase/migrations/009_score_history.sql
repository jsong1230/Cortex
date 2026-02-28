-- F-21 관심사 지형도 마이그레이션 — score_history 테이블 생성
-- 토픽별 일별 스코어 스냅샷 저장 (30일 추이 차트용)
-- AC3: 최근 30일 스코어 변화 추이 데이터 소스

-- ============================================================
-- score_history — 토픽 스코어 일별 스냅샷
-- ============================================================
CREATE TABLE IF NOT EXISTS score_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT NOT NULL,
  score       FLOAT NOT NULL CHECK (score >= 0 AND score <= 1),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 조회 최적화 인덱스 (topic별 최신순 조회)
CREATE INDEX IF NOT EXISTS idx_score_history_topic_recorded_at
  ON score_history(topic, recorded_at DESC);

-- 날짜 범위 조회 인덱스 (30일 이내 필터링)
CREATE INDEX IF NOT EXISTS idx_score_history_recorded_at
  ON score_history(recorded_at DESC);

-- ============================================================
-- RLS 정책 (인증된 사용자 읽기 + Service Role 쓰기)
-- ============================================================
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- 읽기 정책 (인증된 사용자)
CREATE POLICY "score_history_select_policy"
  ON score_history FOR SELECT
  TO authenticated
  USING (true);

-- 삽입 정책 (인증된 사용자 + cron 작업)
CREATE POLICY "score_history_insert_policy"
  ON score_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service Role Key 사용 시 RLS 우회 허용 (cron 작업용)
-- Supabase Service Role은 자동으로 RLS를 우회하므로 별도 정책 불필요
