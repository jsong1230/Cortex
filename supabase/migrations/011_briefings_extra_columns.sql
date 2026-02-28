-- briefings 테이블에 mode, telegram_message_id 컬럼 추가
-- mode: 평일(weekday)/주말(weekend) 브리핑 구분 (F-16)
-- telegram_message_id: 텔레그램 발송 메시지 ID (봇 명령어 응답 추적용)

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'weekday',
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
