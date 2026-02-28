-- F-22 AI 월간 리포트 마이그레이션
-- monthly_reports 테이블 + score_history 테이블 생성
-- AC1: 매월 1일에 리포트 생성
-- AC3: 텔레그램 + 웹 /insights에서 조회 가능

-- ============================================================
-- score_history — 관심사 점수 변화 이력 테이블 (F-21/F-22 공용)
-- ============================================================
CREATE TABLE IF NOT EXISTS score_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT NOT NULL,
  score       NUMERIC(4, 3) NOT NULL,   -- 0.000 ~ 1.000
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- score_history 인덱스
CREATE INDEX IF NOT EXISTS idx_score_history_topic
  ON score_history(topic);

CREATE INDEX IF NOT EXISTS idx_score_history_recorded_at
  ON score_history(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_history_topic_recorded_at
  ON score_history(topic, recorded_at DESC);

-- ============================================================
-- monthly_reports — AI 월간 리포트 저장 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month     TEXT NOT NULL UNIQUE,          -- 'YYYY-MM' 형식
  content          TEXT NOT NULL,                  -- 전체 마크다운 리포트
  summary          TEXT NOT NULL,                  -- 1문단 텔레그램용 요약
  top_topics       JSONB NOT NULL DEFAULT '[]',   -- [{topic, readCount, score}]
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  telegram_sent_at TIMESTAMPTZ                     -- 텔레그램 발송 시각 (NULL = 미발송)
);

-- monthly_reports 인덱스
CREATE INDEX IF NOT EXISTS idx_monthly_reports_report_month
  ON monthly_reports(report_month DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_generated_at
  ON monthly_reports(generated_at DESC);

-- ============================================================
-- RLS 정책 (score_history)
-- ============================================================
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "score_history_select_policy"
  ON score_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "score_history_insert_policy"
  ON score_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- RLS 정책 (monthly_reports)
-- ============================================================
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_reports_select_policy"
  ON monthly_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "monthly_reports_insert_policy"
  ON monthly_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "monthly_reports_update_policy"
  ON monthly_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service Role Key는 RLS를 자동으로 우회 (cron 작업용)
