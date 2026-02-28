# F-19 읽기 루프 API 스펙 (확정본)

## 개요
저장 아이템의 읽기 상태(saved/reading/completed/archived)를 관리하는 API 모음.

- **AC1**: 저장 아이템 상태 관리
- **AC2**: 원문 링크 클릭 시 "읽는 중" 자동 전환
- **AC3**: 사용자 수동 완독 체크
- **AC4**: 30일 경과 미완독 → 자동 보관

---

## 엔드포인트

### 1. GET /api/saved/[contentId]/status

현재 읽기 상태 조회.

**인증**: 필요 (Supabase Auth 세션)

**Path Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| contentId | UUID | Y | content_items.id |

**응답 (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "content_id": "uuid",
    "status": "reading",
    "saved_at": "2026-02-28T00:00:00Z",
    "reading_started_at": "2026-02-28T10:00:00Z",
    "completed_at": null,
    "archived_at": null
  }
}
```

**오류 응답**

| 상태 코드 | errorCode | 설명 |
|---------|----------|------|
| 401 | AUTH_REQUIRED | 인증 없음 |
| 400 | INVALID_CONTENT_ID | UUID 형식 오류 |
| 404 | SAVED_NOT_FOUND | 저장 기록 없음 |

---

### 2. PUT /api/saved/[contentId]/status

읽기 상태를 수동으로 변경 (AC3: 완독 체크).

**인증**: 필요 (Supabase Auth 세션)

**Path Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| contentId | UUID | Y | content_items.id |

**Request Body**
```json
{
  "status": "completed"
}
```

| 필드 | 타입 | 허용값 | 설명 |
|------|------|--------|------|
| status | string | `completed` \| `reading` | 변경할 상태 |

> `saved`와 `archived`는 수동 전환 불가 (시스템 자동 관리).

**응답 (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "content_id": "uuid",
    "status": "completed",
    "saved_at": "2026-02-01T00:00:00Z",
    "reading_started_at": "2026-02-28T09:00:00Z",
    "completed_at": "2026-02-28T10:30:00Z",
    "archived_at": null
  }
}
```

**오류 응답**

| 상태 코드 | errorCode | 설명 |
|---------|----------|------|
| 401 | AUTH_REQUIRED | 인증 없음 |
| 400 | INVALID_CONTENT_ID | UUID 형식 오류 |
| 400 | INVALID_STATUS | 허용되지 않은 status 값 |
| 404 | SAVED_NOT_FOUND | 저장 기록 없음 |
| 500 | - | DB 오류 |

---

### 3. POST /api/interactions (F-11 확장)

`interaction=웹열기` 또는 `interaction=링크클릭` 시 saved_items의 status를 `reading`으로 자동 전환 (AC2).

- 기존 F-11 API와 동일한 엔드포인트/요청 형식 유지
- `saved_items` 레코드가 없으면 자동 전환 없이 무시
- 내부적으로 `markAsReading()` fire-and-forget 호출

---

### 4. POST /api/cron/reading-loop

읽기 루프 자동화 Cron 작업.

**인증**: `Authorization: Bearer {CRON_SECRET}` 헤더 필요

**기능**

| 작업 | 주기 | 설명 |
|------|------|------|
| 만료 아이템 보관 | 매일 | 30일 경과 미완독 → archived (AC4) |
| 곧 보관 알림 | 매일 | 25~30일 사이 미완독 → 텔레그램 알림 (AC6) |
| 월간 요약 | 매월 마지막 날 | 미완독 아이템 요약 텔레그램 발송 (AC7) |

**응답 (200 OK)**
```json
{
  "success": true,
  "data": {
    "date": "2026-02-28",
    "archived_count": 2,
    "near_archive_notified": 1,
    "monthly_summary_sent": false
  }
}
```

---

## 상태 전이도

```
     저장
      ↓
   [saved]
      ↓ (링크 클릭, 자동 — AC2)
  [reading]
      ↓ (완독 체크, 수동 — AC3)
 [completed]

   [saved] ──────────────────────→ [archived]
  [reading]  (30일 경과, 자동 — AC4)
```

### 상태 설명

| 상태 | 설명 | 전환 조건 |
|------|------|----------|
| `saved` | 저장 완료, 읽기 전 | 초기 상태 |
| `reading` | 읽는 중 | 링크 클릭 (자동) |
| `completed` | 완독 | 사용자 수동 체크 |
| `archived` | 보관 | 30일 경과 미완독 (자동) |

---

## Weekly Digest 연동 (AC5)

토요일 Weekly Digest에 미완독 리마인더 섹션 자동 포함.

- `lib/weekly-digest.ts` → `generateWeeklyDigest()` 내부에서 `saved_items` 조회
- status = `saved` | `reading` 인 최신 5개 아이템 포함
- 형식: `• [제목](링크) (저장일: YYYY-MM-DD)`
