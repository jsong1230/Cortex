# F-08 웹 브리핑 뷰어 — DB 스키마 확정본

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 구현 완료
**참조**: `docs/system/erd.md`, `supabase/migrations/001_cortex_tables.sql`

---

## 1. 조회 대상 테이블

F-08은 신규 테이블을 생성하지 않으며, 기존 테이블을 읽기 전용으로 사용한다.

---

## 2. briefings 테이블

### 2.1 스키마

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | 브리핑 ID |
| `briefing_date` | `DATE` | UK | 날짜당 1건 |
| `items` | `JSONB` | NOT NULL | content_id, position, channel, reason 배열 |
| `telegram_sent_at` | `TIMESTAMPTZ` | | 텔레그램 발송 시각 |
| `telegram_opened` | `BOOLEAN` | DEFAULT FALSE | 텔레그램 열람 여부 |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | 생성 시각 |

### 2.2 items JSONB 구조

```typescript
interface BriefingItemJsonb {
  content_id: string;   // content_items.id 참조 (논리적 FK)
  position: number;     // 1부터 시작하는 표시 순서
  channel: string;      // 'tech' | 'world' | 'culture' | 'canada' | 'serendipity'
  reason?: string | null; // My Life OS 연동 이유 (선택적)
}
```

### 2.3 F-08에서 사용하는 쿼리

```sql
-- 오늘 브리핑 조회
SELECT id, briefing_date, items
FROM briefings
WHERE briefing_date = '{today_kst}'
LIMIT 1;
```

**사용 인덱스**: `idx_briefings_date` (`briefing_date DESC`)

---

## 3. content_items 테이블

### 3.1 스키마 (F-08에서 사용하는 컬럼)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | `UUID` | PK |
| `title` | `TEXT` | 기사 제목 |
| `summary_ai` | `TEXT` | Claude 생성 1~2줄 요약 |
| `source` | `TEXT` | 소스명 (hackernews, naver_news 등) |
| `source_url` | `TEXT` | 원본 기사 URL |
| `tags` | `TEXT[]` | AI 추출 토픽 태그 (현재 UI에 미표시) |

### 3.2 F-08에서 사용하는 쿼리

```sql
-- content_items 일괄 조회 (N+1 방지)
SELECT id, title, summary_ai, source, source_url, tags
FROM content_items
WHERE id IN ('{id1}', '{id2}', ...);
```

**사용 인덱스**: `content_items.id` (PK)

---

## 4. user_interactions 테이블

### 4.1 스키마

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | 반응 ID |
| `content_id` | `UUID` | FK → content_items(id) ON DELETE CASCADE | 콘텐츠 ID |
| `briefing_id` | `UUID` | FK → briefings(id) ON DELETE SET NULL | 브리핑 ID |
| `interaction` | `TEXT` | NOT NULL | 반응 타입 |
| `memo_text` | `TEXT` | | 메모 텍스트 |
| `source` | `TEXT` | | 반응 출처 ('telegram_bot' \| 'web') |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | 생성 시각 |

**유효한 interaction 값**: `좋아요`, `싫어요`, `저장`, `메모`, `웹열기`, `링크클릭`, `스킵`

### 4.2 F-08에서 사용하는 쿼리

```sql
-- 사용자 반응 일괄 조회 (N+1 방지)
SELECT content_id, interaction
FROM user_interactions
WHERE content_id IN ('{id1}', '{id2}', ...);
```

응답 조립 시 content_id 기준 첫 번째 레코드만 사용 (최신 반응).

**사용 인덱스**: `idx_interactions_content` (`content_id`)

```sql
-- 반응 저장 (POST /api/interactions)
INSERT INTO user_interactions (content_id, briefing_id, interaction, source, memo_text)
VALUES ('{content_id}', '{briefing_id}', '{interaction}', 'web', '{memo_text}')
RETURNING id, interaction, content_id;
```

---

## 5. RLS 정책

F-08에서 사용하는 테이블의 적용 RLS:

| 테이블 | 정책 | 동작 |
|--------|------|------|
| `briefings` | `authenticated_read_briefings` | SELECT |
| `content_items` | `authenticated_read_content_items` | SELECT |
| `user_interactions` | `authenticated_read_interactions` | SELECT |
| `user_interactions` | `authenticated_insert_interactions` | INSERT |

**구현 방식**: API Route에서 `SUPABASE_SERVICE_ROLE_KEY` (Service Role)로 접근 → RLS 우회.
사용자 인증은 `lib/supabase/auth.ts`의 `getAuthUser()`로 별도 검증.

---

## 6. 마이그레이션 없음

F-08은 신규 테이블이나 컬럼을 추가하지 않는다. 기존 마이그레이션(`001_cortex_tables.sql`, `002_alert_settings.sql`)에 이미 정의된 스키마를 사용한다.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-08 구현 완료 후 DB 스키마 확정본 작성 |
