# F-22 AI 월간 리포트 — DB 스키마 확정본

## 마이그레이션 파일
`supabase/migrations/009_monthly_reports.sql`

---

## 신규 테이블

### monthly_reports

월간 리포트를 저장하는 핵심 테이블.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 고유 식별자 |
| report_month | TEXT | NOT NULL, UNIQUE | 리포트 대상 월 ('YYYY-MM') |
| content | TEXT | NOT NULL | 전체 마크다운 리포트 |
| summary | TEXT | NOT NULL | 텔레그램용 1문단 요약 |
| top_topics | JSONB | NOT NULL, DEFAULT '[]' | Top 5 토픽 [{topic, readCount, score}] |
| generated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 리포트 생성 시각 |
| telegram_sent_at | TIMESTAMPTZ | NULL | 텔레그램 발송 시각 (NULL = 미발송) |

#### 인덱스
```sql
CREATE INDEX idx_monthly_reports_report_month
  ON monthly_reports(report_month DESC);

CREATE INDEX idx_monthly_reports_generated_at
  ON monthly_reports(generated_at DESC);
```

#### top_topics JSONB 구조
```json
[
  { "topic": "llm", "readCount": 3, "score": 0.9 },
  { "topic": "cloud-cost", "readCount": 1, "score": 0.7 }
]
```

#### RLS 정책
- `authenticated` 역할: SELECT, INSERT, UPDATE 허용
- Service Role Key: RLS 자동 우회 (cron 작업용)

---

### score_history

관심사 토픽의 일별 스코어 이력을 저장합니다.
F-21/F-22 공용 테이블 (월간 스코어 변화 분석에 사용).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 고유 식별자 |
| topic | TEXT | NOT NULL | 관심사 토픽명 |
| score | NUMERIC(4,3) | NOT NULL | 점수 (0.000~1.000) |
| recorded_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 기록 시각 |

#### 인덱스
```sql
CREATE INDEX idx_score_history_topic
  ON score_history(topic);

CREATE INDEX idx_score_history_recorded_at
  ON score_history(recorded_at DESC);

CREATE INDEX idx_score_history_topic_recorded_at
  ON score_history(topic, recorded_at DESC);  -- 월별 스코어 변화 조회 최적화
```

#### RLS 정책
- `authenticated` 역할: SELECT, INSERT 허용
- Service Role Key: RLS 자동 우회 (cron 작업용)

---

## 관련 테이블 (기존, 조회 전용)

### user_interactions
- 읽기 수 집계: `topic` 컬럼 기준 monthly groupby
- 조회 조건: `created_at BETWEEN 월시작 AND 월종료`

### interest_profile
- 현재 토픽 점수 조회: `topic, score` 컬럼
- topTopics 구성 시 score 매핑에 사용

### saved_items
- 완독/저장/보관 카운트: `status` 컬럼 (completed, archived, saved)
- 조회 조건: `saved_at BETWEEN 월시작 AND 월종료`

### keyword_contexts
- My Life OS 키워드 연동: `keywords` JSONB 배열
- 조회 조건: `expires_at > NOW()` (만료되지 않은 것만)

---

## 데이터 흐름

```
[Cron 매월 1일] → gatherMonthlyData
  ├── user_interactions → topTopics (readCount 집계)
  ├── interest_profile  → 토픽 스코어 매핑
  ├── score_history     → scoreChanges 계산
  ├── saved_items       → completedItems, savedItems, archivedItems
  └── keyword_contexts  → mylifeosInsights (키워드 목록)
       ↓
   generateReport (Claude API)
       ↓
   monthly_reports.insert()
       ↓
   sendReportToTelegram()
```
