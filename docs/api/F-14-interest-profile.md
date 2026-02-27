# F-14 웹 관심사 프로필 — API 스펙 확정본

> 구현 날짜: 2026-02-28
> 기준 파일: `app/api/profile/interests/route.ts`, `app/api/profile/interests/archived/route.ts`

---

## 공통 사항

| 항목 | 값 |
|------|-----|
| Base URL | `/api/profile/interests` |
| 인증 | Supabase Auth 세션 쿠키 (필수) |
| Content-Type | `application/json` |
| 응답 형식 | `{ success: boolean, data?: T, error?: string, errorCode?: string }` |

---

## 1. GET /api/profile/interests

활성(보관되지 않은) 토픽 목록 조회. `score` 내림차순 정렬.

### 응답

**200 OK**
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": "uuid",
        "topic": "Rust",
        "score": 0.92,
        "interaction_count": 14,
        "last_updated": "2026-02-28T07:00:00Z",
        "archived_at": null
      }
    ],
    "total": 1
  }
}
```

**401 Unauthorized**
```json
{ "success": false, "error": "인증이 필요합니다", "errorCode": "AUTH_REQUIRED" }
```

**500 Internal Server Error**
```json
{ "success": false, "error": "관심사 프로필 조회 중 오류가 발생했습니다" }
```

---

## 2. POST /api/profile/interests

토픽 수동 추가. 기본 `score=0.5`, `interaction_count=0`.

### 요청 바디

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `topic` | `string` | 필수 | 토픽 이름 (trim 후 빈 문자열 불가) |

```json
{ "topic": "Rust" }
```

### 응답

**201 Created**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "topic": "Rust",
    "score": 0.5,
    "interaction_count": 0,
    "last_updated": "2026-02-28T08:00:00Z",
    "archived_at": null
  }
}
```

**400 Bad Request** — topic 누락 또는 빈 문자열
```json
{ "success": false, "error": "topic 필드는 비어 있을 수 없습니다", "errorCode": "TOPIC_REQUIRED" }
```

**401 Unauthorized**
```json
{ "success": false, "error": "인증이 필요합니다", "errorCode": "AUTH_REQUIRED" }
```

**500 Internal Server Error**
```json
{ "success": false, "error": "토픽 추가 중 오류가 발생했습니다" }
```

---

## 3. PUT /api/profile/interests

토픽 스코어 수동 조정. `last_updated`도 갱신.

### 요청 바디

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | 필수 | 토픽 UUID |
| `score` | `number` | 필수 | 새 스코어 (0.0 ~ 1.0) |

```json
{ "id": "uuid", "score": 0.8 }
```

### 응답

**200 OK**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "topic": "Rust",
    "score": 0.8,
    "interaction_count": 14,
    "last_updated": "2026-02-28T08:30:00Z",
    "archived_at": null
  }
}
```

**400 Bad Request** — id 누락 또는 score 범위 초과
```json
{ "success": false, "error": "score는 0~1 사이의 숫자여야 합니다", "errorCode": "SCORE_INVALID" }
```

**401 Unauthorized**
```json
{ "success": false, "error": "인증이 필요합니다", "errorCode": "AUTH_REQUIRED" }
```

---

## 4. DELETE /api/profile/interests

토픽 소프트 삭제 (아카이브). `archived_at = now()`으로 설정.

### 요청 바디

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | 필수 | 토픽 UUID |

```json
{ "id": "uuid" }
```

### 응답

**200 OK**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "topic": "Rust",
    "score": 0.8,
    "interaction_count": 14,
    "last_updated": "2026-02-28T08:30:00Z",
    "archived_at": "2026-02-28T09:00:00Z"
  }
}
```

**400 Bad Request** — id 누락
```json
{ "success": false, "error": "id 필드가 필요합니다", "errorCode": "ID_REQUIRED" }
```

**401 Unauthorized**
```json
{ "success": false, "error": "인증이 필요합니다", "errorCode": "AUTH_REQUIRED" }
```

---

## 5. GET /api/profile/interests/archived

보관된(archived_at IS NOT NULL) 토픽 목록 조회. `archived_at` 내림차순 정렬.

### 응답

**200 OK**
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": "uuid",
        "topic": "Angular",
        "score": 0.3,
        "interaction_count": 2,
        "last_updated": "2025-11-01T00:00:00Z",
        "archived_at": "2025-12-01T00:00:00Z"
      }
    ],
    "total": 1
  }
}
```

**401 Unauthorized**
```json
{ "success": false, "error": "인증이 필요합니다", "errorCode": "AUTH_REQUIRED" }
```

---

## 6. POST /api/profile/interests/archived

보관된 토픽 복원. `archived_at = null`로 설정.

### 요청 바디

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | 필수 | 토픽 UUID |

```json
{ "id": "uuid" }
```

### 응답

**200 OK**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "topic": "Angular",
    "score": 0.3,
    "interaction_count": 2,
    "last_updated": "2025-11-01T00:00:00Z",
    "archived_at": null
  }
}
```

**400 Bad Request** — id 누락
```json
{ "success": false, "error": "id 필드가 필요합니다", "errorCode": "ID_REQUIRED" }
```

**401 Unauthorized**
```json
{ "success": false, "error": "인증이 필요합니다", "errorCode": "AUTH_REQUIRED" }
```

---

## 에러 코드 목록

| errorCode | HTTP | 설명 |
|-----------|------|------|
| `AUTH_REQUIRED` | 401 | 세션 없음 또는 만료 |
| `TOPIC_REQUIRED` | 400 | topic 필드 누락 또는 빈 문자열 |
| `ID_REQUIRED` | 400 | id 필드 누락 또는 빈 문자열 |
| `SCORE_INVALID` | 400 | score가 0~1 범위 초과 |
