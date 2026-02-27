# F-09 웹 아이템 상세 -- DB 쿼리 확정본

**버전**: 1.1 | **날짜**: 2026-02-28 | **상태**: 구현 완료
**참조**: `docs/system/erd.md`, `supabase/migrations/001_cortex_tables.sql`

---

## 1. 신규 테이블 없음

F-09는 신규 테이블이나 컬럼을 추가하지 않는다. 기존 마이그레이션(`001_cortex_tables.sql`)에 이미 정의된 스키마를 사용한다.

---

## 2. 조회 대상 테이블

### 2.1 content_items (읽기)

F-09에서 사용하는 컬럼:

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | `UUID` | PK |
| `channel` | `TEXT` | 채널 (tech, world, culture, canada, serendipity) |
| `title` | `TEXT` | 기사 제목 |
| `summary_ai` | `TEXT` | Claude 생성 AI 요약 전문 |
| `source` | `TEXT` | 소스명 |
| `source_url` | `TEXT` | 원본 기사 URL |
| `tags` | `TEXT[]` | AI 추출 토픽 태그 |
| `collected_at` | `TIMESTAMPTZ` | 수집 시각 |

### 2.2 user_interactions (읽기 + 쓰기)

F-09에서 사용하는 컬럼:

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | `UUID` | PK |
| `content_id` | `UUID` | FK -> content_items(id) |
| `briefing_id` | `UUID` | FK -> briefings(id) |
| `interaction` | `TEXT` | 반응 타입 |
| `memo_text` | `TEXT` | 메모 텍스트 |
| `source` | `TEXT` | 반응 출처 |
| `created_at` | `TIMESTAMPTZ` | 생성 시각 |

### 2.3 briefings (읽기)

F-09에서 사용하는 컬럼:

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | `UUID` | PK |
| `briefing_date` | `DATE` | 브리핑 날짜 |
| `items` | `JSONB` | content_id, position, channel, reason 배열 |

---

## 3. F-09에서 사용하는 쿼리

### 3.1 콘텐츠 단건 조회

```sql
SELECT id, channel, title, summary_ai, source, source_url, tags, collected_at
FROM content_items
WHERE id = '{content_id}'
LIMIT 1;
```

**사용 인덱스**: `content_items.id` (PK)

### 3.2 사용자 최신 반응 조회 (메모 제외)

```sql
SELECT interaction
FROM user_interactions
WHERE content_id = '{content_id}'
  AND interaction != '메모'
ORDER BY created_at DESC
LIMIT 1;
```

**사용 인덱스**: `idx_interactions_content` (`content_id`)

### 3.3 사용자 최신 메모 조회

```sql
SELECT memo_text
FROM user_interactions
WHERE content_id = '{content_id}'
  AND interaction = '메모'
  AND memo_text IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

**사용 인덱스**: `idx_interactions_content` (`content_id`)

### 3.4 브리핑 reason 조회

Supabase JS SDK에서 JSONB 내부 배열 검색이 제한적이므로, 최근 7일 briefings를 조회한 뒤 JS에서 필터링한다.

```sql
-- 최근 7일 briefings 조회
SELECT id, items
FROM briefings
WHERE briefing_date >= '{seven_days_ago}'
ORDER BY briefing_date DESC
LIMIT 7;
```

```typescript
// JS에서 content_id 포함 여부 확인
const matchingBriefing = recentBriefings?.find((b) =>
  (b.items as BriefingItem[]).some((item) => item.content_id === contentId)
);

const reason = matchingBriefing
  ? (matchingBriefing.items as BriefingItem[]).find(
      (item) => item.content_id === contentId
    )?.reason ?? null
  : null;

const briefingId = matchingBriefing?.id ?? null;
```

**사용 인덱스**: `idx_briefings_date` (`briefing_date DESC`)

### 3.5 관련 아이템 조회 (tags overlap)

```sql
SELECT id, channel, title, summary_ai, source, source_url
FROM content_items
WHERE tags && '{tag1, tag2, tag3}'::text[]
  AND id != '{current_content_id}'
ORDER BY collected_at DESC
LIMIT 5;
```

**Supabase JS 구현**:
```typescript
const { data: relatedItems } = await supabase
  .from('content_items')
  .select('id, channel, title, summary_ai, source, source_url')
  .overlaps('tags', currentTags)
  .neq('id', contentId)
  .order('collected_at', { ascending: false })
  .limit(5);
```

**사용 인덱스**: 현재 tags에 인덱스 없음 (순차 스캔). 데이터량 증가 시 GIN 인덱스 추가 예정:

```sql
-- 추후 성능 저하 시 추가
CREATE INDEX idx_content_items_tags ON content_items USING gin (tags);
```

### 3.6 메모 저장 (기존 INSERT 재사용)

```sql
INSERT INTO user_interactions (content_id, briefing_id, interaction, source, memo_text)
VALUES ('{content_id}', '{briefing_id}', '메모', 'web', '{memo_text}')
RETURNING id, interaction, content_id;
```

기존 `POST /api/interactions` 엔드포인트 그대로 사용한다.

---

## 4. RLS 정책

F-09에서 사용하는 테이블의 적용 RLS:

| 테이블 | 정책 | 동작 |
|--------|------|------|
| `content_items` | `authenticated_read_content_items` | SELECT |
| `user_interactions` | `authenticated_read_interactions` | SELECT |
| `user_interactions` | `authenticated_insert_interactions` | INSERT |
| `briefings` | `authenticated_read_briefings` | SELECT |

**구현 방식**: API Route에서 `SUPABASE_SERVICE_ROLE_KEY` (Service Role)로 접근하여 RLS를 우회한다. 사용자 인증은 `lib/supabase/auth.ts`의 `getAuthUser()`로 별도 검증한다.

---

## 5. 마이그레이션 없음

F-09는 신규 테이블이나 컬럼을 추가하지 않는다. 향후 성능 최적화를 위한 GIN 인덱스(`idx_content_items_tags`)는 별도 마이그레이션으로 추가할 수 있다.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-09 DB 쿼리 설계 확정본 작성 |
| 2026-02-28 | 구현 완료 — 실제 구현과 100% 일치 확인 |
