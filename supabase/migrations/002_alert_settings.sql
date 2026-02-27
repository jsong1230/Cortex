-- 긴급 알림 설정 테이블 (Phase 2)
-- 트리거 유형별 ON/OFF, 방해 금지 시간, 일일 발송 횟수 관리

CREATE TABLE IF NOT EXISTS alert_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type         TEXT NOT NULL UNIQUE,
  -- 'toronto_weather' | 'keyword_breaking' | 'world_emergency'
  -- | 'culture_trend' | 'mylifeos_match'
  is_enabled           BOOLEAN DEFAULT TRUE,
  quiet_hours_start    TIME DEFAULT '23:00',
  quiet_hours_end      TIME DEFAULT '07:00',
  last_triggered_at    TIMESTAMPTZ,
  daily_count          INT DEFAULT 0,
  daily_count_reset_at DATE DEFAULT CURRENT_DATE
);

-- 기본 알림 설정 초기 데이터 삽입
INSERT INTO alert_settings (trigger_type, is_enabled)
VALUES
  ('toronto_weather',  TRUE),
  ('keyword_breaking', TRUE),
  ('world_emergency',  TRUE),
  ('culture_trend',    FALSE),  -- 기본 비활성화 (노이즈 방지)
  ('mylifeos_match',   TRUE)
ON CONFLICT (trigger_type) DO NOTHING;
