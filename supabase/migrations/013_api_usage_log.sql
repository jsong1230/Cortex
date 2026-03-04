-- Claude API 사용량 로그 테이블 (I-15: 일 비용 추적)
-- 매 Claude 호출 후 토큰 사용량을 기록하여 일별 집계 가능하도록 함

CREATE TABLE IF NOT EXISTS api_usage_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event        TEXT        NOT NULL,             -- 'summarize', 'world_selection' 등
  total_tokens INTEGER     NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(10, 6),             -- (total_tokens / 1_000_000) * 9
  item_count   INTEGER,                          -- 처리 아이템 수 (summarize 시)
  duration_ms  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 일별/이벤트별 집계 인덱스
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created_at
  ON api_usage_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_log_event
  ON api_usage_log(event, created_at DESC);

COMMENT ON TABLE api_usage_log IS 'Claude API 토큰 사용량 로그. 일별 비용 추적에 사용.';
