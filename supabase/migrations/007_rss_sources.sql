-- F-20 웹 설정 페이지 — RSS 소스 관리 + My Life OS 연동 토글
-- custom_rss_urls, mylifeos_enabled 컬럼을 user_settings 싱글톤 행에 추가
-- 1인 서비스 특성상 별도 테이블 대신 user_settings JSONB 컬럼 사용

-- RSS URL 목록 컬럼 추가 (없으면)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS custom_rss_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- My Life OS 연동 ON/OFF 컬럼 추가 (없으면)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS mylifeos_enabled BOOLEAN NOT NULL DEFAULT false;

-- 기존 싱글톤 행에 새 컬럼 기본값 적용
UPDATE user_settings
SET
  custom_rss_urls = COALESCE(custom_rss_urls, '[]'::jsonb),
  mylifeos_enabled = COALESCE(mylifeos_enabled, false)
WHERE id = 'singleton';

-- custom_rss_urls 각 항목 구조: { url: string, name: string, channel: 'tech'|'world'|'culture'|'canada' }
-- 인덱스: 소규모 서비스(1인)이므로 별도 인덱스 불필요
