-- F-22 AI 월간 리포트 마이그레이션
-- monthly_reports 테이블 + score_history 테이블 생성
-- AC1: 매월 1일에 리포트 생성
-- AC3: 텔레그램 + 웹 /insights에서 조회 가능

-- score_history 테이블은 009_score_history.sql에서 이미 생성됨

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

-- score_history RLS 정책은 009_score_history.sql에서 이미 설정됨

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
