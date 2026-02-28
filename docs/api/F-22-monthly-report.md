# F-22 AI 월간 리포트 — API 스펙 확정본

## 개요

매월 1일에 지난달 완독 아이템 + My Life OS 일기를 교차 분석하여 월간 리포트를 생성합니다.
텔레그램 발송 및 웹 /insights에서 조회 가능합니다.

---

## 엔드포인트 목록

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/cron/monthly-report` | 월간 리포트 생성 (Cron) | CRON_SECRET |
| GET | `/api/insights/reports` | 월간 리포트 목록 | Supabase Auth |
| GET | `/api/insights/reports/[month]` | 특정 월 리포트 조회 | Supabase Auth |

---

## POST /api/cron/monthly-report

### 설명
매월 1일 01:00 UTC (KST 10:00)에 Vercel Cron에 의해 실행됩니다.
이전 달의 데이터를 집계하여 Claude API로 리포트를 생성합니다.

### 인증
```
Authorization: Bearer {CRON_SECRET}
```

### 요청 본문
없음 (POST 메서드이지만 본문 불필요)

### 응답

#### 200 OK — 성공
```json
{
  "success": true,
  "data": {
    "report_month": "2026-01",
    "report_id": "uuid",
    "top_topics_count": 5,
    "tokens_used": 1500,
    "telegram_sent": true
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "에러 메시지",
  "errorCode": "CONFIG_ERROR | SAVE_ERROR"
}
```

### 처리 플로우
1. CRON_SECRET 검증
2. ANTHROPIC_API_KEY 검증
3. 이전 달(YYYY-MM) 계산 (getPreviousMonth)
4. gatherMonthlyData: user_interactions, saved_items, interest_profile, keyword_contexts, score_history 집계
5. generateReport: Claude API로 마크다운 리포트 생성
6. saveReport: monthly_reports 테이블에 삽입
7. sendReportToTelegram: 텔레그램 요약 발송 (non-fatal)
8. markReportAsSent: telegram_sent_at 업데이트

---

## GET /api/insights/reports

### 설명
월간 리포트 목록 조회 (최신순, 페이지네이션). content 필드는 제외됩니다 (용량 절약).

### 쿼리 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| page | integer | 1 | 페이지 번호 (1 이상) |
| limit | integer | 12 | 페이지당 아이템 수 (1~50) |

### 응답

#### 200 OK
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "report_month": "2026-01",
        "summary": "1월에는 LLM과 클라우드 비용에 집중하셨습니다.",
        "top_topics": [
          { "topic": "llm", "readCount": 3, "score": 0.9 },
          { "topic": "cloud-cost", "readCount": 1, "score": 0.7 }
        ],
        "generated_at": "2026-02-01T01:05:00Z",
        "telegram_sent_at": "2026-02-01T01:06:00Z"
      }
    ],
    "total": 12,
    "limit": 12,
    "offset": 0,
    "hasMore": false
  }
}
```

#### 400 Bad Request — 잘못된 파라미터
```json
{
  "success": false,
  "error": "page는 1 이상의 정수여야 합니다",
  "errorCode": "INVALID_PARAMS"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

---

## GET /api/insights/reports/[month]

### 설명
특정 월의 전체 리포트 내용(마크다운 포함)을 조회합니다.

### 경로 파라미터

| 파라미터 | 형식 | 예시 |
|----------|------|------|
| month | YYYY-MM | 2026-01 |

### 응답

#### 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "report_month": "2026-01",
    "content": "## 2026년 1월 월간 리포트\n\n### 핵심 관심사\n...",
    "summary": "1월에는 LLM과 클라우드 비용에 집중하셨습니다.",
    "top_topics": [
      { "topic": "llm", "readCount": 3, "score": 0.9 }
    ],
    "generated_at": "2026-02-01T01:05:00Z",
    "telegram_sent_at": "2026-02-01T01:06:00Z"
  }
}
```

#### 400 Bad Request — 잘못된 month 형식
```json
{
  "success": false,
  "error": "month는 YYYY-MM 형식이어야 합니다",
  "errorCode": "INVALID_PARAMS"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": "2020-01 리포트를 찾을 수 없습니다",
  "errorCode": "REPORT_NOT_FOUND"
}
```

---

## Vercel Cron 설정

```json
{
  "path": "/api/cron/monthly-report",
  "schedule": "0 1 1 * *",
  "comment": "F-22: 매월 1일 AI 월간 리포트 생성 (UTC 01:00 = KST 10:00)"
}
```

---

## 리포트 콘텐츠 구조 (마크다운)

Claude API가 생성하는 마크다운 리포트 섹션:

1. **핵심 관심사** — 이번 달 가장 많이 읽은 주제와 패턴 (AC2)
2. **눈에 띄는 변화** — 관심도 점수 변화와 신규 관심사 (AC2)
3. **My Life OS 연동 인사이트** — 일기/메모 키워드와 교차 분석 (AC2)
4. **추천 후속 질문** — 3~5개의 심화 탐구 질문 (AC2)
5. **Top 5 읽은 주제** — 읽기 횟수 기준 (AC4)

---

## 텔레그램 메시지 포맷

```
📊 <b>2026-01 월간 리포트</b>

{summary}

<b>Top 5 주제</b>
  1. llm (3회)
  2. cloud-cost (1회)
  ...

<a href="https://cortex.vercel.app/insights">전체 리포트 보기 →</a>
```
