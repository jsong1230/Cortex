# F-11 사용자 반응 수집 -- DB 스키마 문서 (확정본)

**버전**: 1.1 | **날짜**: 2026-02-28 | **상태**: 구현 완료
**참조**: `docs/system/erd.md`, `supabase/migrations/001_cortex_tables.sql`
**마이그레이션**: `supabase/migrations/004_interaction_unique_constraint.sql`

---

## 1. 변경 대상 테이블: user_interactions

### 1.1 기존 스키마 (변경 없음)

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | 반응 ID |
| `content_id` | `UUID` | FK -> content_items(id) ON DELETE CASCADE | 콘텐츠 ID |
| `briefing_id` | `UUID` | FK -> briefings(id) ON DELETE SET NULL, NULL 허용 | 브리핑 ID |
| `interaction` | `TEXT` | NOT NULL | 반응 타입 |
| `memo_text` | `TEXT` | NULL 허용 | 메모 텍스트 |
| `source` | `TEXT` | NULL 허용 | 반응 출처 |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | 생성 시각 |

**컬럼 변경 없음**. `source` 컬럼에 `'system'` 값이 추가됨 (스킵 자동 기록용).

### 1.2 유효값

**interaction 컬럼**: `좋아요` | `싫어요` | `저장` | `메모` | `웹열기` | `링크클릭` | `스킵`

**source 컬럼**:
- `telegram_bot`: 텔레그램 봇에서 기록
- `web`: 웹 대시보드에서 기록
- `system`: Cron 스킵 자동 기록 (F-11 추가)

### 1.3 briefing_id 변경 (F-11)

- **변경 전**: 웹 API에서 briefing_id 필수
- **변경 후**: briefing_id가 선택 필드 (NULL 허용). 텔레그램 인라인 버튼 콜백 시 NULL로 저장 가능

---

## 2. 인덱스 변경

### 2.1 기존 인덱스 (유지)

| 인덱스명 | 대상 컬럼 | 용도 |
|----------|-----------|------|
| `idx_interactions_content` | `content_id` | 콘텐츠별 반응 조회 |
| `idx_interactions_created` | `created_at DESC` | 최신순 정렬 |
| `idx_interactions_type` | `interaction` | 반응 타입별 필터/집계 |

### 2.2 추가 인덱스 (F-11 신규)

| 인덱스명 | 대상 컬럼 | 타입 | 조건 | 용도 |
|----------|-----------|------|------|------|
| `idx_interactions_content_type_unique` | `(content_id, interaction)` | UNIQUE (부분 인덱스) | `WHERE interaction != '메모'` | 동일 콘텐츠에 동일 반응 중복 방지. 메모는 복수 허용. |

**부분 유니크 인덱스 사용 이유**:
- 좋아요/싫어요/저장 등은 1건만 존재해야 한다 (토글 의미)
- 메모는 내용이 다를 수 있으므로 복수 허용
- PostgreSQL의 `CREATE UNIQUE INDEX ... WHERE` 구문으로 구현

---

## 3. RLS 정책 변경

### 3.1 기존 정책 (유지)

| 정책명 | 동작 | 조건 |
|--------|------|------|
| `authenticated_read_interactions` | SELECT | `auth.role() = 'authenticated'` |
| `authenticated_insert_interactions` | INSERT | `auth.role() = 'authenticated'` |

### 3.2 추가 정책 (F-11 신규)

| 정책명 | 동작 | 조건 |
|--------|------|------|
| `authenticated_delete_interactions` | DELETE | `auth.role() = 'authenticated'` |
| `authenticated_update_interactions` | UPDATE | `auth.role() = 'authenticated'` |

---

## 4. 마이그레이션 SQL

파일: `supabase/migrations/004_interaction_unique_constraint.sql`

```sql
-- F-11: 사용자 반응 수집 — 중복 방지 인덱스 + RLS 정책 추가
-- 실행 순서: 001 -> 002 -> 003 -> 004

-- 1. 기존 중복 데이터 정리
DELETE FROM user_interactions a
USING user_interactions b
WHERE a.id < b.id
  AND a.content_id = b.content_id
  AND a.interaction = b.interaction
  AND a.interaction != '메모';

-- 2. 부분 유니크 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_content_type_unique
  ON user_interactions(content_id, interaction)
  WHERE interaction != '메모';

-- 3. RLS 정책 추가 (DELETE, UPDATE)
CREATE POLICY "authenticated_delete_interactions" ON user_interactions
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_interactions" ON user_interactions
  FOR UPDATE USING (auth.role() = 'authenticated');
```

---

## 5. 쿼리 패턴

### 5.1 반응 저장 (UPSERT — 메모 외)

```typescript
// Supabase JS
const { data } = await supabase
  .from('user_interactions')
  .upsert(
    { content_id, briefing_id, interaction, source },
    { onConflict: 'content_id,interaction', ignoreDuplicates: true }
  )
  .select('id, interaction, content_id')
  .single();
// data가 null이면 중복 (기존 레코드 별도 조회)
// data가 있으면 신규 삽입
```

### 5.2 메모 저장 (항상 INSERT)

```typescript
const { data } = await supabase
  .from('user_interactions')
  .insert({ content_id, briefing_id, interaction: '메모', memo_text, source })
  .select('id, interaction, content_id')
  .single();
```

### 5.3 반응 이력 조회 (content_items JOIN)

```typescript
const { data, count } = await supabase
  .from('user_interactions')
  .select(
    'id, content_id, briefing_id, interaction, memo_text, source, created_at, content_items!inner(title, channel)',
    { count: 'exact' }
  )
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

### 5.4 반응 삭제

```typescript
const { data } = await supabase
  .from('user_interactions')
  .delete()
  .eq('id', id)
  .select('id, interaction, content_id')
  .single();
// data가 null이면 해당 ID 없음 → 404
```

### 5.5 메모 수정

```typescript
// 먼저 조회하여 interaction === '메모' 확인
const { data: existing } = await supabase
  .from('user_interactions')
  .select('id, interaction, memo_text, content_id')
  .eq('id', id)
  .single();

// 업데이트
const { data } = await supabase
  .from('user_interactions')
  .update({ memo_text })
  .eq('id', id)
  .select('id, interaction, memo_text, content_id')
  .single();
```

### 5.6 통계 집계

```typescript
// by_type — 인메모리 카운트
const { data: typeRows } = await supabase
  .from('user_interactions')
  .select('interaction')
  .gte('created_at', from)
  .lte('created_at', `${to}T23:59:59.999Z`)
  .order('created_at', { ascending: true });

// by_channel — content_items JOIN
const { data: channelRows } = await supabase
  .from('user_interactions')
  .select('content_items!inner(channel)')
  .gte('created_at', from)
  .lte('created_at', `${to}T23:59:59.999Z`)
  .order('created_at', { ascending: true });
```

---

## 6. 데이터 무결성 규칙

| 규칙 | 구현 |
|------|------|
| 같은 content_id + 같은 interaction (메모 제외) = 1건 | 부분 유니크 인덱스 (`idx_interactions_content_type_unique`) |
| 메모는 복수 허용 | 유니크 인덱스에서 메모 제외 (`WHERE interaction != '메모'`) |
| content_id는 content_items에 존재해야 함 | FK 제약 (ON DELETE CASCADE) |
| briefing_id는 briefings에 존재해야 함 (null 허용) | FK 제약 (ON DELETE SET NULL) |
| source 값은 'telegram_bot', 'web', 'system' 중 하나 | 애플리케이션 레벨 검증 (lib/interactions/types.ts의 ALL_SOURCES) |

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-02-28 | 1.0 | F-11 DB 스키마 문서 작성 (설계 확정) |
| 2026-02-28 | 1.1 | 구현 완료 확정본 업데이트 (테스트 PASS 확인) |
