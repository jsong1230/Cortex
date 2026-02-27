# F-23 세렌디피티 채널 — DB 스키마 확정본

구현 날짜: 2026-02-28

## 개요

F-23은 신규 테이블을 추가하지 않습니다.
기존 `briefings.items` JSONB 필드에 `is_serendipity` 속성을 추가하고,
기존 `interest_profile` 테이블을 역가중치 계산에 활용합니다.

---

## 영향받는 테이블

### briefings.items (JSONB 배열 구조 확장)

기존 `items` JSONB 배열의 각 요소에 `is_serendipity` 필드가 추가됩니다.

#### 기존 items 요소 스키마

```json
{
  "content_id": "uuid",
  "position": 1,
  "channel": "tech",
  "title": "...",
  "source": "hackernews",
  "source_url": "https://...",
  "summary_ai": "...",
  "score_initial": 0.85,
  "tags": ["llm", "cloud"]
}
```

#### F-23 추가 후 items 요소 스키마

```json
{
  "content_id": "uuid",
  "position": 1,
  "channel": "serendipity",
  "title": "...",
  "source": "youtube",
  "source_url": "https://...",
  "summary_ai": "...",
  "score_initial": 0.6,
  "tags": ["music", "culture"],
  "is_serendipity": true
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `is_serendipity` | `boolean` | 세렌디피티 채널로 선정된 아이템 여부 (AC4 추적용) |

- 일반 아이템: `is_serendipity: false` 또는 필드 없음
- 세렌디피티 아이템: `is_serendipity: true`, `channel: 'serendipity'`

#### 마이그레이션 필요 여부

불필요. JSONB 필드는 스키마 마이그레이션 없이 새 필드를 추가할 수 있습니다.
기존 briefings 레코드의 `is_serendipity`가 없으면 `undefined`로 처리되며, `isSerendipityItem()` 함수가 안전하게 `false`를 반환합니다.

---

### interest_profile (읽기 전용 활용)

세렌디피티 선정 시 `interest_profile` 테이블을 읽어 역가중치를 계산합니다.
이 테이블의 스키마는 F-13/F-14에서 정의된 기존 구조를 그대로 사용합니다.

```sql
CREATE TABLE interest_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL UNIQUE,
  score NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### F-23에서의 활용

- `SELECT topic, score FROM interest_profile` — 전체 토픽 점수 로드
- 역가중치 공식: `inverseWeight = 1.0 - avg(interestProfile[tag]) + 0.2`
- 프로필에 없는 태그: `score = 0` 처리 (역가중치 최대 → 세렌디피티 선정 가능성 높음)

---

### user_interactions (AC4 추적)

세렌디피티 반응은 별도 테이블을 추가하지 않고,
기존 `user_interactions` 테이블의 데이터를 브리핑의 `items.is_serendipity` 필드와
조인하여 구별합니다.

```sql
-- 세렌디피티 반응 조회 예시 (Analytics용)
SELECT ui.*
FROM user_interactions ui
JOIN briefings b ON ui.briefing_id = b.id
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(b.items) AS item
  WHERE item->>'content_id' = ui.content_id
    AND item->>'channel' = 'serendipity'
);
```

---

## 데이터 흐름

```
content_items (오늘 수집 아이템)
    +
interest_profile (사용자 관심 프로필)
    |
    v
selectBriefingItems() — 역가중치 기반 세렌디피티 선정
    |
    v
briefings.items [
  { content_id, channel: 'tech', is_serendipity: false, ... },
  { content_id, channel: 'serendipity', is_serendipity: true, ... }
]
    |
    v (반응 발생 시)
user_interactions (briefing_id 포함)
    |
    v (AC4 추적)
isSerendipityItem() → cortex_serendipity_reaction 로그
```

---

## 인덱스

추가 인덱스 불필요.

- `interest_profile.topic`: 기존 UNIQUE 제약으로 조회 최적화됨
- `briefings.items`: JSONB GIN 인덱스는 기존 스키마 검토 필요 (현재 미구현 — analytics 쿼리 빈도 낮음)
