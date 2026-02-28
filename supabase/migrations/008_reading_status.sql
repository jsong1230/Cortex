-- F-19 읽기 루프 마이그레이션 — saved_items 테이블 생성
-- 저장 아이템에 읽기 상태(saved/reading/completed/archived)를 관리
-- AC1: 상태 관리, AC2: 자동 전환, AC3: 수동 완독, AC4: 30일 자동 보관

-- ============================================================
-- saved_items — 저장 아이템 상태 관리 핵심 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id          UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'saved'
                        CHECK (status IN ('saved', 'reading', 'completed', 'archived')),
  saved_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reading_started_at  TIMESTAMPTZ,             -- 원문 링크 클릭 시 자동 설정 (AC2)
  completed_at        TIMESTAMPTZ,             -- 사용자가 완독 체크 시 설정 (AC3)
  archived_at         TIMESTAMPTZ,             -- 30일 경과 자동 보관 시 설정 (AC4)
  CONSTRAINT saved_items_content_id_unique UNIQUE (content_id)  -- 1인 서비스: content당 1개
);

-- saved_items 인덱스 (조회 성능, design.md 인덱스 계획 반영)
CREATE INDEX IF NOT EXISTS idx_saved_items_status
  ON saved_items(status);

CREATE INDEX IF NOT EXISTS idx_saved_items_saved_at
  ON saved_items(saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_items_status_saved_at
  ON saved_items(status, saved_at);  -- AC4 만료 아이템 조회 복합 인덱스

-- ============================================================
-- RLS 정책 (인증된 사용자만 읽기/쓰기 가능)
-- ============================================================
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

-- 읽기 정책
CREATE POLICY "saved_items_select_policy"
  ON saved_items FOR SELECT
  TO authenticated
  USING (true);

-- 삽입 정책
CREATE POLICY "saved_items_insert_policy"
  ON saved_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 수정 정책
CREATE POLICY "saved_items_update_policy"
  ON saved_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 삭제 정책
CREATE POLICY "saved_items_delete_policy"
  ON saved_items FOR DELETE
  TO authenticated
  USING (true);

-- Service Role Key 사용 시 RLS 우회 허용 (cron 작업용)
-- Supabase Service Role은 자동으로 RLS를 우회하므로 별도 정책 불필요
