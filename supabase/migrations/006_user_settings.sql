-- F-17 피로도 방지 장치 — user_settings 테이블 마이그레이션
-- 채널별 ON/OFF, 뮤트 설정, 아이템 수 자동 감소 관리
-- 1인 서비스 특성상 싱글톤 행(id='singleton')으로 운영

CREATE TABLE IF NOT EXISTS user_settings (
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

-- item_reduction 값 범위 제약
ALTER TABLE user_settings
  ADD CONSTRAINT chk_item_reduction CHECK (item_reduction >= 0 AND item_reduction <= 4);

-- 기본 싱글톤 행 삽입 (없으면)
INSERT INTO user_settings (id, channel_settings, mute_until, item_reduction)
VALUES (
  'singleton',
  '{"tech":true,"world":true,"culture":true,"canada":true}'::jsonb,
  NULL,
  0
)
ON CONFLICT (id) DO NOTHING;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();
