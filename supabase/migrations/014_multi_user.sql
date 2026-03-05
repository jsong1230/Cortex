-- 멀티유저 지원 마이그레이션 (가족 4명 개인화 브리핑)
-- telegram_users 테이블 신규 + 기존 테이블에 user_id 컬럼 추가
-- 기존 싱글유저 데이터: user_id = NULL (레거시 호환)

-- ============================================================
-- 1. telegram_users — 등록된 텔레그램 사용자 목록
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL UNIQUE,
  chat_id     BIGINT NOT NULL,
  first_name  TEXT,
  username    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id
  ON telegram_users(telegram_id);

-- RLS
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_telegram_users"
  ON telegram_users FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 2. briefings — user_id 추가
-- 기존: UNIQUE(briefing_date) → 변경: UNIQUE(briefing_date, user_id)
-- ============================================================
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES telegram_users(id) ON DELETE CASCADE;

-- 기존 UNIQUE 제약 제거
ALTER TABLE briefings DROP CONSTRAINT IF EXISTS briefings_briefing_date_key;

-- 신규 UNIQUE 인덱스: NULLS NOT DISTINCT → NULL user_id끼리도 날짜당 1건
CREATE UNIQUE INDEX IF NOT EXISTS idx_briefings_date_user
  ON briefings(briefing_date, user_id) NULLS NOT DISTINCT;

-- ============================================================
-- 3. user_interactions — user_id 추가
-- ============================================================
ALTER TABLE user_interactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES telegram_users(id) ON DELETE CASCADE;

-- 신규: user_id 있는 경우 (user_id, content_id, interaction) 유니크
-- 기존 partial unique index(idx_interactions_content_type_unique) 는 NULL user_id 레거시용으로 유지
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_user_content_type_unique
  ON user_interactions(user_id, content_id, interaction)
  WHERE interaction != '메모' AND user_id IS NOT NULL;

-- ============================================================
-- 4. interest_profile — user_id 추가
-- 기존: UNIQUE(topic) → 변경: UNIQUE(user_id, topic) NULLS NOT DISTINCT
-- ============================================================
ALTER TABLE interest_profile
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES telegram_users(id) ON DELETE CASCADE;

-- 기존 UNIQUE 제약 제거
ALTER TABLE interest_profile DROP CONSTRAINT IF EXISTS interest_profile_topic_key;

-- 신규 UNIQUE 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_profile_user_topic
  ON interest_profile(user_id, topic) NULLS NOT DISTINCT;

-- ============================================================
-- 5. cortex_settings — user_id 추가
-- 기존 singleton 행(id='singleton') 유지, user_id = NULL
-- 신규 사용자: id = telegram_users.id::text, user_id = telegram_users.id
-- ============================================================
ALTER TABLE cortex_settings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES telegram_users(id) ON DELETE CASCADE;

-- user_id 기준 UNIQUE (NULLS NOT DISTINCT: NULL끼리도 1개만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cortex_settings_user_id
  ON cortex_settings(user_id) NULLS NOT DISTINCT;

-- ============================================================
-- 6. alert_log — user_id 추가 (선택적)
-- ============================================================
ALTER TABLE alert_log
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES telegram_users(id) ON DELETE CASCADE;
