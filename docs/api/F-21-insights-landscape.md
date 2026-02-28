# F-21 API 스펙 확정본 — 관심사 지형도

작성일: 2026-02-28
구현 기능: F-21 관심사 지형도 (버블 차트 + 30일 추이)

---

## 1. GET /api/insights/landscape

관심사 프로필(interest_profile) 활성 토픽과 score_history 30일 데이터를 결합해 반환합니다.
BubbleChart, InsightsSummary, TrendChart 컴포넌트의 데이터 소스입니다.

### 요청

```
GET /api/insights/landscape
Authorization: Supabase 세션 쿠키 (필수)
```

### 응답 — 성공 (200 OK)

```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "topic": "TypeScript",
        "score": 0.85,
        "interactionCount": 12,
        "history": [
          { "date": "2026-01-30", "score": 0.78 },
          { "date": "2026-02-14", "score": 0.82 }
        ]
      }
    ],
    "total": 1
  }
}
```

### 응답 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `topics[].topic` | string | 토픽 이름 |
| `topics[].score` | float (0~1) | 현재 EMA 스코어 |
| `topics[].interactionCount` | int | 누적 반응 횟수 |
| `topics[].history` | array | 최근 30일 스냅샷 목록 |
| `topics[].history[].date` | string (YYYY-MM-DD) | 스냅샷 날짜 |
| `topics[].history[].score` | float (0~1) | 해당 날짜 스코어 |

### 오류 응답

| 상태 코드 | errorCode | 설명 |
|----------|-----------|------|
| 401 | `AUTH_REQUIRED` | 인증 세션 없음 |
| 500 | — | interest_profile 또는 score_history 조회 실패 |

---

## 2. GET /api/insights/trends

score_history 테이블에서 최근 30일 토픽별 추이 데이터를 반환합니다.
TrendChart 라인 차트 전용 엔드포인트입니다.

### 요청

```
GET /api/insights/trends
Authorization: Supabase 세션 쿠키 (필수)
```

### 응답 — 성공 (200 OK)

```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "topic": "TypeScript",
        "points": [
          { "date": "2026-01-30", "score": 0.78 },
          { "date": "2026-02-28", "score": 0.85 }
        ]
      }
    ],
    "total": 1,
    "period_days": 30
  }
}
```

### 오류 응답

| 상태 코드 | errorCode | 설명 |
|----------|-----------|------|
| 401 | `AUTH_REQUIRED` | 인증 세션 없음 |
| 500 | — | score_history 조회 실패 |

---

## 3. POST /api/cron/snapshot-scores

일별 관심사 스코어 스냅샷을 score_history 테이블에 기록합니다.
Vercel Cron에 의해 매일 UTC 14:00 (KST 23:00)에 호출됩니다.

### 요청

```
POST /api/cron/snapshot-scores
Authorization: Bearer {CRON_SECRET}
```

### 응답 — 성공 (200 OK)

```json
{
  "success": true,
  "data": {
    "snapshot_count": 15
  }
}
```

### 오류 응답

| 상태 코드 | 설명 |
|----------|------|
| 401 | CRON_SECRET 불일치 |
| 500 | interest_profile 조회 또는 score_history 삽입 실패 |

---

## 4. 공통 사항

- 모든 응답 형식: `{ success: boolean, data?: T, error?: string, errorCode?: string }`
- 인증 방식: Supabase SSR 세션 쿠키 (웹 API), Bearer CRON_SECRET (cron)
- 히스토리 날짜: `recorded_at` TIMESTAMPTZ → `YYYY-MM-DD` 슬라이싱
