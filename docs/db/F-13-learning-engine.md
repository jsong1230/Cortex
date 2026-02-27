# F-13 학습 엔진 EMA 스코어링 — DB 스키마 확정본

작성일: 2026-02-28
마이그레이션: `supabase/migrations/005_learning_engine.sql`

---

## 1. 변경 테이블

### interest_profile (기존 테이블 컬럼 추가)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 고유 식별자 |
| topic | TEXT | NOT NULL, UNIQUE | 토픽 이름 |
| score | FLOAT | DEFAULT 0.5 | EMA 관심도 점수 (0.0~1.0) |
| interaction_count | INT | DEFAULT 0 | 누적 반응 횟수 |
| last_updated | TIMESTAMPTZ | DEFAULT NOW() | 마지막 EMA 업데이트 시각 |
| embedding | VECTOR(1536) | | 토픽 임베딩 (유사도 검색용) |
| **archived_at** | **TIMESTAMPTZ** | **DEFAULT NULL** | **보관 시각 (AC5 신규 추가)** |

#### 신규 인덱스 (005 마이그레이션 추가)

```sql
-- 보관 여부 인덱스 (NULL = 활성 토픽)
CREATE INDEX idx_interest_archived_at
  ON interest_profile(archived_at)
  WHERE archived_at IS NULL;

-- 보관 대상 조회 복합 인덱스
CREATE INDEX idx_interest_score_updated
  ON interest_profile(score, last_updated);
```

#### 기존 인덱스 (001 마이그레이션)

```sql
CREATE INDEX idx_interest_score ON interest_profile(score DESC);

CREATE INDEX idx_interest_embedding
  ON interest_profile
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 2. 신규 RPC 함수

### `search_content_by_embedding(query_embedding, match_count)`
```sql
RETURNS TABLE(id UUID, similarity FLOAT)
```
- content_items.embedding이 NULL이 아닌 항목 대상
- cosine similarity 기반 정렬
- HNSW 인덱스 활용

### `search_interests_by_embedding(query_embedding, match_count)`
```sql
RETURNS TABLE(id UUID, similarity FLOAT)
```
- interest_profile.archived_at IS NULL 조건 포함
- embedding이 NULL이 아닌 항목 대상

### `search_contexts_by_embedding(query_embedding, match_count)`
```sql
RETURNS TABLE(id UUID, similarity FLOAT)
```
- keyword_contexts.expires_at IS NULL OR expires_at > NOW() 조건 포함

### `upsert_topics(topics TEXT[], default_score FLOAT)`
```sql
RETURNS INT  -- 신규 삽입된 토픽 수
```
- INSERT ... ON CONFLICT (topic) DO NOTHING
- 신규 토픽만 삽입, 기존 토픽 score 변경 없음

### `archive_low_score_topics()`
```sql
RETURNS JSON  -- { "archived_count": N }
```
- score <= 0.2 AND last_updated <= NOW() - INTERVAL '3 months' AND archived_at IS NULL
- archived_at = NOW() 로 업데이트

---

## 3. 스코어 업데이트 흐름 (애플리케이션 레이어)

```
user_interactions INSERT/UPSERT
  ↓ (비동기 fire-and-forget)
content_items.tags 조회
  ↓
extractTopicsFromTags() — 유효 토픽 추출
  ↓
registerTopicsToProfile() — 신규 토픽 등록
  interest_profile UPSERT (신규 topics만, ignoreDuplicates)
  ↓
updateInterestScore() — EMA 업데이트
  interest_profile SELECT ... WHERE topic IN (tags)
  ↓ EMA 계산: newScore = 0.3 * weight + 0.7 * currentScore
  interest_profile UPSERT (onConflict: 'topic')
```

---

## 4. 자동 보관 로직 (AC5)

### 트리거 조건
- score <= 0.2
- last_updated <= 3개월 전
- archived_at IS NULL

### 실행 방식
- `/api/cron/archive-topics` POST (매주 일요일 03:00 UTC)
- 또는 `archive_low_score_topics()` RPC 직접 호출

### 보관 처리 결과
- `archived_at = NOW()` 설정
- `GET /api/profile/interests` 조회 시 제외됨 (archived_at IS NULL 필터)
- 물리 삭제 아님 (복구 가능)

---

## 5. 임베딩 저장 전략 (AC4)

### 저장 대상
| 테이블 | 임베딩 대상 | 차원 |
|--------|------------|------|
| content_items | title + summary_ai | 1536 |
| interest_profile | topic 텍스트 | 1536 |
| keyword_contexts | keywords 배열 join | 1536 |

### 비고
- OpenAI text-embedding-3-small 모델 사용
- OPENAI_API_KEY 미설정 시 embedding 컬럼은 NULL 유지
- 유사도 검색은 embedding NOT NULL인 항목만 대상
- HNSW 인덱스 파라미터: m=16, ef_construction=64 (소규모 데이터셋 최적)
