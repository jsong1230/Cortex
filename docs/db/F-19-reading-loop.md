# F-19 읽기 루프 DB 스키마 확정본

## 개요

저장 아이템의 읽기 상태를 관리하는 `saved_items` 테이블.
마이그레이션 파일: `supabase/migrations/008_reading_status.sql`

---

## 테이블: saved_items

### 컬럼 정의

| 컬럼명 | 타입 | NOT NULL | 기본값 | 설명 |
|--------|------|----------|--------|------|
| id | UUID | Y | gen_random_uuid() | PK |
| content_id | UUID | Y | - | FK → content_items.id (CASCADE DELETE) |
| status | TEXT | Y | `'saved'` | CHECK: saved \| reading \| completed \| archived |
| saved_at | TIMESTAMPTZ | Y | NOW() | 저장 시각 |
| reading_started_at | TIMESTAMPTZ | N | NULL | 링크 첫 클릭 시각 (AC2) |
| completed_at | TIMESTAMPTZ | N | NULL | 완독 처리 시각 (AC3) |
| archived_at | TIMESTAMPTZ | N | NULL | 보관 처리 시각 (AC4) |

### 제약 조건

| 제약명 | 타입 | 내용 |
|--------|------|------|
| saved_items_pkey | PK | id |
| saved_items_content_id_unique | UNIQUE | content_id — 1인 서비스, content당 1개 |
| saved_items_content_id_fkey | FK | content_id → content_items(id) ON DELETE CASCADE |
| saved_items_status_check | CHECK | status IN ('saved', 'reading', 'completed', 'archived') |

### 인덱스

| 인덱스명 | 컬럼 | 용도 |
|---------|------|------|
| idx_saved_items_status | status | 상태별 필터링 |
| idx_saved_items_saved_at | saved_at DESC | 최신 저장순 정렬 |
| idx_saved_items_status_saved_at | (status, saved_at) | AC4 만료 아이템 복합 조회 |

### RLS 정책

| 정책명 | 작업 | 대상 | 조건 |
|--------|------|------|------|
| saved_items_select_policy | SELECT | authenticated | true |
| saved_items_insert_policy | INSERT | authenticated | true |
| saved_items_update_policy | UPDATE | authenticated | true |
| saved_items_delete_policy | DELETE | authenticated | true |

> Cron 작업은 Service Role Key로 RLS를 우회하여 실행.

---

## ERD (saved_items 관계)

```
content_items (id PK)
      ↑ FK (CASCADE DELETE)
saved_items
  - id (PK)
  - content_id (UNIQUE)
  - status: saved | reading | completed | archived
  - saved_at
  - reading_started_at
  - completed_at
  - archived_at
```

---

## 데이터 흐름

### 레코드 생성
- F-10 저장(북마크) 시 → `saved_items` INSERT (status='saved')
- `saveItem(contentId)` — UPSERT (중복 저장 시 기존 상태 유지)

### 상태 업데이트
- AC2: `markAsReading(contentId)` — status='reading', reading_started_at=NOW()
- AC3: `markAsCompleted(contentId)` — status='completed', completed_at=NOW()
- AC4: `archiveExpiredItems()` — status='archived', archived_at=NOW() (30일 경과 일괄)

### 조회
- `getUnreadItems()` — status IN ('saved', 'reading') 전체 조회
- `getItemsNearingArchive()` — saved_at BETWEEN 25일~30일 전 (AC6)
- `getMonthlyUnreadSummary()` — 상태별 COUNT (AC7)
- `getSavedItemByContentId(contentId)` — 단건 조회

---

## 성능 고려사항

- 1인 서비스로 데이터 규모가 작으므로 단순 인덱스로 충분
- `UNIQUE(content_id)` 제약으로 중복 저장 방지 + UPSERT 기반
- AC4 만료 쿼리: `(status, saved_at)` 복합 인덱스로 빠른 필터링
- N+1 방지: `getUnreadItems`, `getItemsNearingArchive`는 `content_items` JOIN 포함
