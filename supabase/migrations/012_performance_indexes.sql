-- I-11: 성능 최적화 인덱스 추가
-- user_interactions 조회 패턴 기반

-- ============================================================
-- 1. briefing_id + content_id 복합 인덱스
-- 브리핑별 아이템 반응 조회 시 사용 (stats, learning engine)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_interactions_briefing_content
  ON user_interactions(briefing_id, content_id);

-- ============================================================
-- 2. created_at 내림차순 인덱스
-- 이번 달 반응 수 집계 등 시간 범위 조회 시 사용
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_interactions_created_at
  ON user_interactions(created_at DESC);

-- ============================================================
-- 3. content_items.collected_at 인덱스
-- cron/send-briefing에서 오늘 수집 아이템 조회 시 사용
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_content_items_collected_at
  ON content_items(collected_at DESC);

-- ============================================================
-- 4. content_items.channel + score_initial 복합 인덱스
-- 채널별 상위 아이템 선정 시 사용
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_content_items_channel_score
  ON content_items(channel, score_initial DESC);
