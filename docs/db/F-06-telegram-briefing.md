# DB 스키마 확정본 — F-06 텔레그램 브리핑 발송

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**참조**: `docs/system/system-design.md` §4.1

---

## 신규/수정 테이블

F-06은 기존 `briefings` 테이블을 신규 생성하고,
기존 `content_items` 테이블을 읽기 전용으로 조회한다.

---

## briefings 테이블

매일 발송된 브리핑 기록. 날짜당 1건.

```sql
CREATE TABLE briefings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date     DATE NOT NULL UNIQUE,
  items             JSONB NOT NULL,         -- BriefingItem[] 직렬화
  telegram_sent_at  TIMESTAMPTZ,
  telegram_message_id INT,                  -- 발송된 메시지 ID (선택)
  telegram_opened   BOOLEAN DEFAULT FALSE,  -- F-07에서 사용
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_briefings_date ON briefings(briefing_date DESC);
```

### items JSONB 스키마

```json
[
  {
    "content_id": "uuid",
    "position": 1,
    "channel": "tech",
    "title": "LLM 인프라 최적화 가이드",
    "source": "hackernews",
    "source_url": "https://news.ycombinator.com/item?id=1",
    "summary_ai": "LLM 서빙 비용을 50% 절감하는 실전 전략",
    "score_initial": 0.85
  }
]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `content_id` | string (UUID) | `content_items.id` 참조 |
| `position` | number | 브리핑 내 순서 (1부터 시작) |
| `channel` | string | `tech`/`world`/`culture`/`canada`/`serendipity` |
| `title` | string | 콘텐츠 제목 |
| `source` | string | 소스 식별자 |
| `source_url` | string | 원문 URL |
| `summary_ai` | string | AI 생성 요약 (null 가능) |
| `score_initial` | number | 초기 관심도 점수 (0.0~1.0) |

---

## content_items 테이블 조회 조건 (F-06 기준)

F-06에서 조회하는 컬럼과 조건:

```sql
SELECT id, channel, source, source_url, title, summary_ai, score_initial, tags
FROM content_items
WHERE summary_ai IS NOT NULL                    -- 요약 완료된 아이템만
  AND collected_at >= {today_kst_start_utc}     -- KST 오늘 00:00 이후
ORDER BY score_initial DESC;
```

- KST 오늘 00:00 = `new Date('{YYYY-MM-DD}T00:00:00+09:00').toISOString()`
- JS 레벨에서 `summary_ai !== null` 추가 필터링 적용

### 인덱스 활용

| 인덱스 | 사용 목적 |
|--------|----------|
| `idx_content_items_collected_at` | `collected_at >= today_start` 범위 검색 |
| `idx_content_items_channel` | 채널별 그룹핑 (JS에서 처리) |

---

## 채널별 선정 한도

`lib/telegram.ts` > `CHANNEL_LIMITS` 상수에서 관리:

| 채널 (DB channel 값) | 최소 | 최대 |
|---------------------|------|------|
| `tech` | 2 | 3 |
| `world` | 1 | 2 |
| `culture` | 1 | 2 |
| `canada` | 2 | 3 |
| `serendipity` | 1 | 1 (stub) |

---

## 기존 테이블 변경사항

F-06은 기존 테이블 스키마를 변경하지 않는다.

| 테이블 | 변경 | 설명 |
|--------|------|------|
| `content_items` | 없음 | 읽기 전용 조회 |
| `briefings` | 신규 생성 | F-06 신규 테이블 |

---

## 마이그레이션

`supabase/migrations/001_cortex_tables.sql`에 이미 정의된 `briefings` 테이블을 확인한다.
F-06에서 추가된 `telegram_message_id` 컬럼이 없다면 아래 마이그레이션을 적용한다:

```sql
-- telegram_message_id 컬럼 추가 (없는 경우)
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS telegram_message_id INT;
```

---

*F-06 DB 스키마 확정본 v1.0 | 2026-02-28*
