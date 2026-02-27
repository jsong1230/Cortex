-- F-15 긴급 알림 발송 로그 테이블
-- AC4: 당일 중복 알림 방지 / AC5: 하루 최대 3회 카운트 집계용

CREATE TABLE IF NOT EXISTS alert_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,        -- 'toronto_weather' | 'keyword_breaking' | 'world_emergency' | 'culture_trend' | 'mylifeos_match'
  title        TEXT NOT NULL,        -- 알림 제목
  message      TEXT NOT NULL,        -- 알림 본문
  content_id   UUID,                 -- 연관 콘텐츠 ID (keyword_breaking 시 사용), NULL 허용
  source_url   TEXT,                 -- 원본 링크 (있는 경우)
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- alert_log 인덱스
-- AC4: 당일 동일 trigger_type + content_id 중복 체크용
CREATE INDEX IF NOT EXISTS idx_alert_log_trigger_type
  ON alert_log(trigger_type);

CREATE INDEX IF NOT EXISTS idx_alert_log_content_id
  ON alert_log(content_id);

-- AC5: 하루 최대 3회 카운트용 (sent_at 날짜 기준)
CREATE INDEX IF NOT EXISTS idx_alert_log_sent_at
  ON alert_log(sent_at DESC);

-- 복합 인덱스: 당일 중복 조회 최적화
CREATE INDEX IF NOT EXISTS idx_alert_log_trigger_content_sent
  ON alert_log(trigger_type, content_id, sent_at DESC);
