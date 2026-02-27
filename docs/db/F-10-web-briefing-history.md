# F-10 웹 브리핑 히스토리 -- DB 쿼리 문서

**버전**: 1.1 | **날짜**: 2026-02-28 | **상태**: 구현 완료
**참조**: `docs/system/erd.md`, `docs/specs/F-10-web-briefing-history/design.md`

---

## 1. 개요

F-10은 새 테이블을 추가하지 않는다. 기존 `briefings`, `content_items`, `user_interactions` 테이블에 대한 읽기/삭제 쿼리만 사용한다.

---

## 2. 사용 테이블

| 테이블 | 동작 | 용도 |
|--------|------|------|
| `briefings` | SELECT | 날짜별 브리핑 목록 조회, 특정 날짜 브리핑 조회 |
| `content_items` | SELECT | 브리핑 아이템 상세 정보, 저장 아이템 상세 정보 |
| `user_interactions` | SELECT, DELETE | 사용자 반응 조회, 저장 아이템 조회, 저장 해제 |

---

## 3. 쿼리 목록

### 3.1 브리핑 목록 조회 (GET /api/briefings)

**목적**: 과거 브리핑 날짜 목록을 역순으로 페이지네이션 조회

```sql
-- 페이지네이션 조회 (page=1, limit=20 -> offset=0)
SELECT id, briefing_date, items
FROM briefings
ORDER BY briefing_date DESC
LIMIT 20 OFFSET 0;
```

```sql
-- 전체 건수 (Supabase count: 'exact' 옵션으로 자동 처리)
SELECT COUNT(*) FROM briefings;
```

**활용 인덱스**: `idx_briefings_date` (briefing_date DESC)
**참고**: items JSONB에서 item_count와 channels 분포는 애플리케이션 레벨에서 계산한다.

---

### 3.2 특정 날짜 브리핑 조회 (GET /api/briefings/[date])

**목적**: 특정 날짜의 브리핑 데이터를 content_items, user_interactions와 함께 조회

F-08의 today API와 동일한 3-쿼리 패턴을 사용한다.

```sql
-- 1) 브리핑 조회
SELECT id, briefing_date, items
FROM briefings
WHERE briefing_date = '2026-02-27'
LIMIT 1;
```

```sql
-- 2) 콘텐츠 아이템 일괄 조회 (items JSONB에서 추출한 content_id 배열)
SELECT id, title, summary_ai, source, source_url, tags
FROM content_items
WHERE id IN ('uuid-1', 'uuid-2', 'uuid-3', ...);
```

```sql
-- 3) 사용자 반응 일괄 조회
SELECT content_id, interaction
FROM user_interactions
WHERE content_id IN ('uuid-1', 'uuid-2', 'uuid-3', ...);
```

**활용 인덱스**:
- `briefings(briefing_date)` UNIQUE -- 단건 조회
- `content_items(id)` PK -- IN 조회
- `idx_interactions_content` (content_id) -- IN 조회

---

### 3.3 저장 아이템 조회 (GET /api/saved)

**목적**: `interaction='저장'`인 콘텐츠를 저장일 역순으로 페이지네이션 조회

```sql
-- 1) 저장 interaction 조회 (최신순, 페이지네이션)
SELECT content_id, created_at AS saved_at
FROM user_interactions
WHERE interaction = '저장'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

```sql
-- 전체 건수
SELECT COUNT(*)
FROM user_interactions
WHERE interaction = '저장';
```

```sql
-- 2) 해당 content_id의 상세 정보 조회
SELECT id, title, summary_ai, source, source_url, channel
FROM content_items
WHERE id IN ('uuid-1', 'uuid-2', ...);
```

**활용 인덱스**:
- `idx_interactions_type` (interaction) -- '저장' 필터
- `idx_interactions_created` (created_at DESC) -- 정렬
- `content_items(id)` PK -- IN 조회

**참고**: 동일 content_id에 여러 '저장' 레코드가 있을 수 있다 (저장 -> 해제 -> 재저장). Supabase 쿼리에서 최신 저장만 가져오면 된다. 1인 사용자이므로 데이터 규모가 작아 애플리케이션 레벨 중복 제거로도 충분하다.

---

### 3.4 저장 해제 (DELETE /api/saved/[contentId])

**목적**: 특정 콘텐츠의 '저장' interaction 레코드를 삭제

```sql
DELETE FROM user_interactions
WHERE content_id = '550e8400-e29b-41d4-a716-446655440000'
  AND interaction = '저장';
```

**활용 인덱스**: `idx_interactions_content` (content_id)
**반환**: 삭제된 행 수. 0이면 404 응답.

---

## 4. 인덱스 활용 현황

F-10은 새 인덱스를 추가하지 않는다. 기존 인덱스로 모든 쿼리가 효율적으로 처리된다.

| 쿼리 | 인덱스 | 방식 |
|------|--------|------|
| 브리핑 목록 (날짜 역순) | `idx_briefings_date` | Index Scan |
| 특정 날짜 브리핑 | `briefings(briefing_date)` UNIQUE | Unique Index Scan |
| 콘텐츠 IN 조회 | `content_items(id)` PK | Index Scan |
| 저장 아이템 필터 | `idx_interactions_type` | Index Scan |
| 저장 아이템 정렬 | `idx_interactions_created` | Index Scan |
| 사용자 반응 IN 조회 | `idx_interactions_content` | Index Scan |

---

## 5. 데이터 규모 예상

1인 사용자, 일 1회 브리핑 기준:

| 테이블 | 6개월 예상 건수 | 1년 예상 건수 |
|--------|---------------|-------------|
| `briefings` | ~180건 | ~365건 |
| `content_items` | ~5,000건 | ~10,000건 |
| `user_interactions` (저장) | ~50~200건 | ~100~400건 |

이 규모에서 offset 기반 페이지네이션의 성능 문제는 발생하지 않는다.

---

## 6. 마이그레이션

F-10은 새 테이블/컬럼/인덱스를 추가하지 않으므로 마이그레이션이 불필요하다.

---

## 7. 실제 구현 쿼리 확정본

### 7.1 Supabase 쿼리 패턴 (구현 코드 기준)

**GET /api/briefings (브리핑 목록)**
```typescript
const { data, count, error } = await supabase
  .from('briefings')
  .select('id, briefing_date, items', { count: 'exact' })
  .order('briefing_date', { ascending: false })
  .range(offset, offset + limit - 1);
```

**GET /api/saved (저장 목록)**
```typescript
// 1단계
const { data: savedInteractions, count } = await supabase
  .from('user_interactions')
  .select('content_id, created_at', { count: 'exact' })
  .eq('interaction', '저장')
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);

// 2단계 (content_id 중복 제거 후)
const { data: contentItems } = await supabase
  .from('content_items')
  .select('id, title, summary_ai, source, source_url, channel')
  .in('id', contentIds);
```

**DELETE /api/saved/[contentId]**
```typescript
const { data: deleted } = await supabase
  .from('user_interactions')
  .delete()
  .eq('content_id', contentId)
  .eq('interaction', '저장')
  .select('content_id');
```

**참고**: 설계서의 DISTINCT ON은 Supabase JS 클라이언트에서 직접 지원하지 않으므로, JavaScript 레벨에서 Map을 사용해 중복 content_id를 제거한다.

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-10 DB 쿼리 문서 작성 |
| 2026-02-28 | F-10 구현 완료, 실제 Supabase 쿼리 확정본 추가 |
