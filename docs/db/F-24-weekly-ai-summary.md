# F-24 주간 AI 요약 — DB 스키마 확정본

## 개요

F-24는 신규 DB 테이블이나 컬럼을 추가하지 않습니다. 기존 테이블을 읽기 전용으로 활용합니다.

## 사용 테이블 (읽기 전용)

### content_items

기술 트렌드 요약(AC1)에 사용됩니다.

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `title` | text | 기술 트렌드 프롬프트 입력 |
| `tags` | text[] | 태그 빈도 집계 → 주요 테마 추출 |
| `channel` | text | `'tech'` 채널 필터링 |
| `score_initial` | float | 정렬 기준 (상위 20개 선택) |
| `collected_at` | timestamptz | 이번 주 아이템 필터링 (`>= 이번 주 월요일 00:00 KST`) |

**조회 조건**
```sql
SELECT title, tags, channel
FROM content_items
WHERE channel = 'tech'
  AND collected_at >= '{이번주_월요일_UTC}'
ORDER BY score_initial DESC
LIMIT 20
```

---

### briefings

세렌디피티 효과 측정(AC2)에 사용됩니다.

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `id` | uuid | 브리핑 식별 |
| `briefing_date` | date | 이번 주 필터링 |
| `items` | jsonb | `channel='serendipity'` 아이템 추출 |

**items JSONB 구조 (읽는 필드)**
```json
[
  {
    "content_id": "uuid",
    "channel": "serendipity",
    "title": "...",
    "tags": ["cooking", "food"]
  }
]
```

**조회 조건**
```sql
SELECT id, briefing_date, items
FROM briefings
WHERE briefing_date >= '{이번주_월요일_UTC}'
ORDER BY briefing_date DESC
```

---

### user_interactions

세렌디피티 효과(AC2)와 포커스 코멘트(AC3)에 사용됩니다.

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `content_id` | uuid | 세렌디피티 아이템 매핑 |
| `action` | text | 긍정 반응 필터 (`like`, `save`, `좋아요`, `저장`) |
| `created_at` | timestamptz | 이번 주 필터링 |

**AC2 조회 조건 (세렌디피티 긍정 반응)**
```sql
SELECT content_id, action
FROM user_interactions
WHERE content_id = ANY('{세렌디피티_아이템_ids}')
  AND created_at >= '{이번주_월요일_UTC}'
```

**AC3 조회 조건 (포커스 코멘트 — content_items 태그 포함)**
```sql
SELECT ui.content_id, ui.action, ci.tags AS "content_items(tags)"
FROM user_interactions ui
LEFT JOIN content_items ci ON ci.id = ui.content_id
WHERE ui.created_at >= '{이번주_월요일_UTC}'
```

---

## 마이그레이션

F-24는 DB 변경이 없으므로 마이그레이션 파일이 필요하지 않습니다.

---

## 성능 고려사항

### 현재 사용 인덱스 (기존 F-16/F-23에서 생성됨)

| 테이블 | 인덱스 | F-24 사용 여부 |
|--------|--------|---------------|
| `content_items` | `idx_content_items_channel_collected_at` | YES — tech 채널 + 날짜 필터 |
| `content_items` | `idx_content_items_score_initial` | YES — 정렬 최적화 |
| `briefings` | `idx_briefings_briefing_date` | YES — 날짜 필터 |
| `user_interactions` | `idx_user_interactions_content_id` | YES — 세렌디피티 매핑 |
| `user_interactions` | `idx_user_interactions_created_at` | YES — 날짜 필터 |

### N+1 방지

- `briefings.items`는 JSONB 배열로 저장되어 있어 한 번의 쿼리로 모든 세렌디피티 아이템 추출 가능
- `user_interactions` + `content_items` 조인은 단일 쿼리로 처리 (AC3)
- `content_items` 조회는 `LIMIT 20`으로 제한 (AC1)

### 실행 빈도

- 토요일 1회 실행 (KST 09:00)
- 쿼리 3회: `content_items`, `briefings`, `user_interactions`
- Claude API 호출 최대 2회 (데이터 없으면 0회)
