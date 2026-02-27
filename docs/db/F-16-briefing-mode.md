# F-16 평일/주말 브리핑 분리 — DB 스키마 확정본

## 개요
F-16은 기존 테이블에 컬럼을 추가하지 않습니다.
`briefings` 테이블에 `mode` 필드를 JSONB items가 아닌 별도 컬럼으로 기록합니다.

---

## 기존 테이블 변경사항

### briefings 테이블 (기존 스키마에 mode 필드 추가)

```sql
-- F-16: briefings 테이블에 mode 컬럼 추가 (마이그레이션 불필요 — 앱 레벨 처리)
-- send-briefing route에서 insert 시 mode 필드를 포함하여 저장
-- 기존 rows는 mode=NULL → 평일로 간주
```

**briefings 레코드 예시 (F-16 이후)**
```json
{
  "briefing_date": "2026-03-07",
  "mode": "weekend",
  "items": [...],
  "telegram_sent_at": "2026-03-07T00:01:00.000Z",
  "telegram_message_id": 12345,
  "weekly_digest": true
}
```

---

## 신규 조회 패턴

### Weekly Digest — 이번 주 좋아요 Top 3

```sql
-- 이번 주 월요일부터 오늘까지의 좋아요 집계
SELECT
  ui.content_id,
  ci.title,
  ci.source_url,
  ci.channel,
  COUNT(*) as like_count
FROM user_interactions ui
JOIN content_items ci ON ui.content_id = ci.id
WHERE
  ui.action = 'like'
  AND ui.created_at >= '{this_monday_kst_start}'
GROUP BY ui.content_id, ci.title, ci.source_url, ci.channel
ORDER BY like_count DESC
LIMIT 3;
```

### Weekly Digest — 미완독 리마인더

```sql
-- 저장했으나 읽지 않은 아이템 (read_at IS NULL)
SELECT
  ui.content_id,
  ci.title,
  ci.source_url,
  ui.created_at as saved_at
FROM user_interactions ui
JOIN content_items ci ON ui.content_id = ci.id
WHERE
  ui.action = 'save'
  AND ui.read_at IS NULL
ORDER BY ui.created_at DESC
LIMIT 5;
```

---

## content_items 테이블 — 주말 포맷 필드 (비고)

주말 브리핑의 `extended_summary`와 `why_important`는 현재 DB가 아닌 앱 레벨에서
Claude API 호출 후 `BriefingItem` 객체에 직접 주입합니다.

향후 캐싱을 위해 content_items에 컬럼 추가를 고려할 수 있습니다:

```sql
-- 미래 확장 (F-16 Phase 2 고려사항)
ALTER TABLE content_items
  ADD COLUMN extended_summary TEXT,      -- 주말용 3줄 요약
  ADD COLUMN why_important TEXT;         -- 주말용 "왜 중요한가"
```

현재는 weekly-digest 및 send-briefing route에서 메모리 상에서만 처리합니다.

---

## 인덱스 영향 분석

Weekly Digest 조회를 위한 추가 인덱스:

```sql
-- 이미 존재하는 인덱스로 커버 가능
-- user_interactions: (action, created_at) 복합 인덱스 권장
CREATE INDEX IF NOT EXISTS idx_user_interactions_action_created
  ON user_interactions(action, created_at DESC);
```

---

## 데이터 흐름 (F-16)

```
Vercel Cron (KST 07:00 평일 / 09:00 주말)
  ↓
POST /api/cron/send-briefing
  ↓
isWeekend() → mode 결정
  ↓
content_items (SELECT)
  ↓
selectBriefingItems(items, mode)
  ↓
[주말] generateWeeklyDigest()
        └─ user_interactions (SELECT like)
        └─ user_interactions (SELECT save, read_at IS NULL)
  ↓
formatWeekdayBriefing() / formatWeekendBriefing()
  ↓
[토요일] formatWeeklyDigest(digestData)
  ↓
sendBriefing() → 텔레그램
  ↓
briefings (INSERT with mode field)
```
