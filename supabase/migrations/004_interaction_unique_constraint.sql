-- F-11: 사용자 반응 수집 — 중복 방지 인덱스 + RLS 정책 추가
-- 실행 순서: 001 -> 002 -> 003 -> 004

-- ============================================================
-- 1. 기존 중복 데이터 정리
-- 동일 (content_id, interaction)에 여러 레코드가 있으면
-- 최신(id가 큰) 것만 유지하고 나머지 삭제
-- 메모는 복수 허용이므로 제외
-- ============================================================
DELETE FROM user_interactions a
USING user_interactions b
WHERE a.id < b.id
  AND a.content_id = b.content_id
  AND a.interaction = b.interaction
  AND a.interaction != '메모';

-- ============================================================
-- 2. 부분 유니크 인덱스 생성
-- 메모를 제외한 반응 타입은 (content_id, interaction) 조합이 유일
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_content_type_unique
  ON user_interactions(content_id, interaction)
  WHERE interaction != '메모';

-- ============================================================
-- 3. RLS 정책 추가 (DELETE, UPDATE)
-- ============================================================
CREATE POLICY "authenticated_delete_interactions" ON user_interactions
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_interactions" ON user_interactions
  FOR UPDATE USING (auth.role() = 'authenticated');
