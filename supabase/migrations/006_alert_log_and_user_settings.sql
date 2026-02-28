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
-- F-17 피로도 방지 장치 — cortex_settings 테이블 마이그레이션
-- 채널별 ON/OFF, 뮤트 설정, 아이템 수 자동 감소 관리
-- 1인 서비스 특성상 싱글톤 행(id='singleton')으로 운영

CREATE TABLE IF NOT EXISTS cortex_settings (
  id               TEXT PRIMARY KEY DEFAULT 'singleton',
  -- 채널별 ON/OFF 설정 (기본값: 모두 ON)
  channel_settings JSONB NOT NULL DEFAULT '{"tech":true,"world":true,"culture":true,"canada":true}'::jsonb,
  -- 뮤트 종료 시각 (null = 뮤트 해제)
  mute_until       TIMESTAMPTZ DEFAULT NULL,
  -- 7일 무반응 시 자동 감소량 (0, 2, 4 중 하나, 최대 4)
  item_reduction   INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블에 컬럼이 없으면 추가
ALTER TABLE cortex_settings ADD COLUMN IF NOT EXISTS channel_settings JSONB NOT NULL DEFAULT '{"tech":true,"world":true,"culture":true,"canada":true}'::jsonb;
ALTER TABLE cortex_settings ADD COLUMN IF NOT EXISTS mute_until TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE cortex_settings ADD COLUMN IF NOT EXISTS item_reduction INT NOT NULL DEFAULT 0;
ALTER TABLE cortex_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cortex_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- item_reduction 값 범위 제약 (이미 있으면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_item_reduction'
  ) THEN
    ALTER TABLE cortex_settings
      ADD CONSTRAINT chk_item_reduction CHECK (item_reduction >= 0 AND item_reduction <= 4);
  END IF;
END
$$;

-- 기본 싱글톤 행 삽입 (없으면)
INSERT INTO cortex_settings (id, channel_settings, mute_until, item_reduction)
VALUES (
  'singleton',
  '{"tech":true,"world":true,"culture":true,"canada":true}'::jsonb,
  NULL,
  0
)
ON CONFLICT (id) DO NOTHING;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_cortex_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cortex_settings_updated_at
  BEFORE UPDATE ON cortex_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_cortex_settings_updated_at();
