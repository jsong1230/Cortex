-- RLS (Row Level Security) 활성화 + 정책 설정
-- Cortex는 My Life OS와 Supabase 인스턴스를 공유하므로 RLS 필수

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_contexts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS 정책 설정
-- Service Role Key 사용 시 자동으로 RLS 우회 (서버 Cron)
-- Anon Key 사용 시 아래 정책 적용 (클라이언트)
-- ============================================================

-- content_items: 인증된 사용자만 읽기
CREATE POLICY IF NOT EXISTS "authenticated_read_content_items"
  ON content_items
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- briefings: 인증된 사용자만 읽기
CREATE POLICY IF NOT EXISTS "authenticated_read_briefings"
  ON briefings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- user_interactions: 인증된 사용자만 읽기/쓰기
CREATE POLICY IF NOT EXISTS "authenticated_read_interactions"
  ON user_interactions
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "authenticated_insert_interactions"
  ON user_interactions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- interest_profile: 인증된 사용자만 읽기
CREATE POLICY IF NOT EXISTS "authenticated_read_interest_profile"
  ON interest_profile
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- alert_settings: 인증된 사용자만 읽기/수정
CREATE POLICY IF NOT EXISTS "authenticated_read_alert_settings"
  ON alert_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "authenticated_update_alert_settings"
  ON alert_settings
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- keyword_contexts: 인증된 사용자만 읽기
CREATE POLICY IF NOT EXISTS "authenticated_read_keyword_contexts"
  ON keyword_contexts
  FOR SELECT
  USING (auth.role() = 'authenticated');
