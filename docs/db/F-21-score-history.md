# F-21 DB 스키마 확정본 — score_history 테이블

작성일: 2026-02-28
마이그레이션 파일: `supabase/migrations/009_score_history.sql`

---

## 1. score_history 테이블

토픽별 일별 스코어 스냅샷을 저장합니다.
`/api/cron/snapshot-scores` 크론 작업이 매일 UTC 14:00에 레코드를 삽입합니다.
`/api/insights/landscape` 및 `/api/insights/trends` API가 최근 30일 데이터를 조회합니다.

### 스키마

```sql
CREATE TABLE IF NOT EXISTS score_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT NOT NULL,
  score       FLOAT NOT NULL CHECK (score >= 0 AND score <= 1),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 컬럼 정의

| 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|------|------|----------|--------|------|
| `id` | UUID | O | gen_random_uuid() | PK |
| `topic` | TEXT | O | — | 토픽 이름 (interest_profile.topic 참조, FK 없음) |
| `score` | FLOAT | O | — | 0.0~1.0 EMA 스코어 스냅샷 |
| `recorded_at` | TIMESTAMPTZ | O | NOW() | 스냅샷 기록 시각 |

### 인덱스

```sql
-- 토픽별 최신순 조회 (N개 토픽 히스토리 조회 시 사용)
CREATE INDEX IF NOT EXISTS idx_score_history_topic_recorded_at
  ON score_history(topic, recorded_at DESC);

-- 날짜 범위 필터링 (30일 이내 전체 조회 시 사용)
CREATE INDEX IF NOT EXISTS idx_score_history_recorded_at
  ON score_history(recorded_at DESC);
```

### RLS 정책

| 정책명 | 작업 | 대상 | 조건 |
|--------|------|------|------|
| `score_history_select_policy` | SELECT | authenticated | true |
| `score_history_insert_policy` | INSERT | authenticated | true |

Service Role Key는 RLS를 자동으로 우회하므로 cron 작업에서 별도 정책 없이 INSERT 가능.

---

## 2. 연관 테이블 관계

```
interest_profile.topic  ──(논리 참조, FK 없음)──  score_history.topic
```

score_history는 interest_profile과 명시적 FK를 맺지 않습니다.
이유: 아카이브된 토픽의 히스토리도 보존해야 하기 때문입니다.

---

## 3. 데이터 흐름

```
매일 UTC 14:00
  → POST /api/cron/snapshot-scores
  → interest_profile (archived_at IS NULL) 전체 조회
  → score_history INSERT (topic, score, recorded_at)

조회 시
  → GET /api/insights/landscape
  → score_history WHERE recorded_at >= NOW() - 30일
  → topic별 그룹핑 후 응답
```

---

## 4. 스토리지 추정

- 일 1회 스냅샷, 최대 50개 토픽 기준
- 월 약 1,500 레코드, 연 약 18,000 레코드
- 레코드당 약 100 바이트 → 연 약 1.8 MB (인덱스 포함 시 약 5 MB)
- 90일 이상 오래된 레코드 주기적 정리 권장 (추후 별도 cron 추가)
