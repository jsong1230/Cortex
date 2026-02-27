# F-05 AI 요약/스코어링 — DB 스키마 확정본

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정

---

## 개요

F-05는 기존 `content_items` 테이블의 `summary_ai`, `tags`, `score_initial` 컬럼을 채운다. 신규 테이블 생성 없음.

---

## content_items 테이블 (F-05 관련 컬럼)

F-01~F-04 수집기가 생성한 `content_items` 레코드에 F-05가 아래 컬럼을 업데이트한다.

| 컬럼 | 타입 | NULL 가능 | 설명 |
|------|------|-----------|------|
| `summary_ai` | `TEXT` | YES | Claude가 생성한 1~2줄 한국어 요약. NULL이면 미처리 대상 |
| `tags` | `TEXT[]` | YES | AI 추출 토픽 태그 (소문자 영어, 하이픈). 예: `{'llm', 'cloud-cost'}` |
| `score_initial` | `FLOAT4` | YES | 초기 관심도 점수 (0.0~1.0). 폴백 시 0.5 |

---

## F-05 관련 쿼리

### 요약 대상 아이템 조회

```sql
-- summary_ai가 NULL인 최근 24시간 수집 아이템 조회 (캐싱 체크)
SELECT id, title, full_text, channel, source, source_url, published_at
FROM content_items
WHERE summary_ai IS NULL
  AND collected_at >= NOW() - INTERVAL '24 hours'
ORDER BY channel, collected_at DESC;
```

### 요약 결과 업데이트

```sql
-- 개별 아이템 요약 결과 업데이트
UPDATE content_items
SET summary_ai    = $1,   -- SummarizeResult.summaryAi
    tags          = $2,   -- SummarizeResult.tags
    score_initial = $3    -- SummarizeResult.scoreInitial
WHERE id = $4;            -- SummarizeResult.id
```

---

## 캐싱 전략

1. 수집기가 `content_items`에 INSERT 시 `source_url` UNIQUE 제약으로 중복 방지
2. 요약 전 `summary_ai IS NULL` 조건으로 미처리 아이템만 조회 (재요약 방지)
3. 이미 `summary_ai`가 있는 아이템은 Claude API 호출 제외 → `SummarizeStats.cached` 카운트

---

## 폴백 저장 값

Claude API 실패 또는 응답 누락 시 저장되는 값:

| 컬럼 | 폴백 값 |
|------|--------|
| `summary_ai` | `item.title` (원본 제목) |
| `tags` | `{}` (빈 배열) |
| `score_initial` | `0.5` (중간값) |

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `supabase/migrations/001_cortex_tables.sql` | `content_items` 테이블 정의 |
| `lib/summarizer.ts` | DB 업데이트 로직 (Phase 0 완성 후 추가 예정) |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-05 구현 완료 후 초기 확정본 작성 |
