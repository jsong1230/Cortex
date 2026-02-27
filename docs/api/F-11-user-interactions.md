# F-11 사용자 반응 수집 -- API 엔드포인트 문서 (확정본)

**버전**: 1.1 | **날짜**: 2026-02-28 | **상태**: 구현 완료
**구현 파일**:
- `app/api/interactions/route.ts` (POST 수정, GET 추가)
- `app/api/interactions/[id]/route.ts` (DELETE, PUT 신규)
- `app/api/interactions/stats/route.ts` (GET 신규)
- `lib/interactions/types.ts` (InteractionType, VALID_INTERACTIONS 공통 타입)

---

## 1. POST /api/interactions -- 반응 저장 (수정)

### 1.1 개요

웹 대시보드에서 사용자 반응을 저장한다. UPSERT 전략으로 중복 반응을 방지한다. 메모 타입은 복수 허용.

### 1.2 요청

```http
POST /api/interactions HTTP/1.1
Cookie: sb-access-token=...
Content-Type: application/json

{
  "content_id": "550e8400-e29b-41d4-a716-446655440000",
  "interaction": "좋아요",
  "source": "web"
}
```

**인증**: Supabase Auth 세션 쿠키

**요청 본문 필드**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `content_id` | `UUID` | O | 콘텐츠 아이템 ID |
| `briefing_id` | `UUID` | X | 브리핑 ID (null 허용, F-11에서 선택 필드로 변경) |
| `interaction` | `string` | O | 반응 타입 |
| `memo_text` | `string` | X | 메모 텍스트 (interaction='메모'일 때만) |
| `source` | `'web'` | O | 반응 출처 |

**유효한 interaction 값**: `좋아요`, `싫어요`, `저장`, `메모`, `웹열기`, `링크클릭`, `스킵`

### 1.3 응답

**201 Created (신규 반응)**:
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "interaction": "좋아요",
    "content_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**200 OK (중복 반응 — 멱등)**:
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "interaction": "좋아요",
    "content_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 1.4 에러 응답

| HTTP | errorCode | 상황 |
|------|-----------|------|
| 401 | `AUTH_REQUIRED` | 세션 없음 |
| 400 | `INTERACTION_INVALID_TYPE` | 유효하지 않은 interaction 값 |
| 400 | - | content_id 또는 interaction 누락 |
| 500 | - | DB 저장 실패 |

### 1.5 구현 상세 (UPSERT 전략)

- **메모 외 타입**: `upsert({ onConflict: 'content_id,interaction', ignoreDuplicates: true })`
  - 중복 시 upsert가 null 반환 → 기존 레코드 조회 후 200 반환
  - 신규 시 201 반환
- **메모 타입**: 항상 `insert()` (복수 허용)

---

## 2. GET /api/interactions -- 반응 이력 조회 (신규)

### 2.1 개요

사용자의 반응 이력을 조회한다. content_id, interaction 타입, source, 날짜 범위로 필터링 가능.

### 2.2 요청

```http
GET /api/interactions?content_id=uuid&interaction=저장&limit=20&offset=0 HTTP/1.1
Cookie: sb-access-token=...
```

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 기본값 | 제한 | 설명 |
|----------|------|------|--------|------|------|
| `content_id` | `UUID` | X | - | - | 특정 콘텐츠 필터 |
| `interaction` | `string` | X | - | - | 반응 타입 필터 |
| `source` | `string` | X | - | - | 소스 필터 (telegram_bot/web/system) |
| `from` | `YYYY-MM-DD` | X | - | - | 시작 날짜 |
| `to` | `YYYY-MM-DD` | X | - | - | 종료 날짜 |
| `limit` | `number` | X | 50 | 최대 100 | 반환 개수 |
| `offset` | `number` | X | 0 | 음수 → 0 | 페이지네이션 오프셋 |

### 2.3 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "content_id": "uuid",
        "briefing_id": "uuid",
        "interaction": "좋아요",
        "memo_text": null,
        "source": "web",
        "created_at": "2026-02-28T07:30:00+09:00",
        "content_title": "OpenAI GPT-5 출시 임박",
        "content_channel": "tech"
      }
    ],
    "total": 120,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### 2.4 에러 응답

| HTTP | errorCode | 상황 |
|------|-----------|------|
| 401 | `AUTH_REQUIRED` | 세션 없음 |
| 400 | `INTERACTION_INVALID_QUERY` | DB 쿼리 오류 (잘못된 파라미터 등) |

### 2.5 구현 상세

- `content_items!inner(title, channel)` JOIN으로 content_title, content_channel 포함
- Supabase `count: 'exact'`로 total 집계
- `range(offset, offset + limit - 1)`로 페이지네이션

---

## 3. DELETE /api/interactions/[id] -- 반응 취소 (신규)

### 3.1 개요

특정 반응을 물리 삭제한다. 반응 취소(토글) 시 사용. 학습 데이터 정확성을 위해 논리 삭제 대신 물리 삭제.

### 3.2 요청

```http
DELETE /api/interactions/880e8400-e29b-41d4-a716-446655440003 HTTP/1.1
Cookie: sb-access-token=...
```

### 3.3 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "interaction": "좋아요",
    "content_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 3.4 에러 응답

| HTTP | errorCode | 상황 |
|------|-----------|------|
| 401 | `AUTH_REQUIRED` | 세션 없음 |
| 404 | `INTERACTION_NOT_FOUND` | 해당 ID의 반응 없음 |

### 3.5 구현 상세

- `delete().eq('id', id).select().single()` 체인으로 삭제 + 반환 데이터 확인
- 삭제된 레코드가 없으면 (data === null) → 404 반환

---

## 4. PUT /api/interactions/[id] -- 메모 수정 (신규)

### 4.1 개요

메모 타입 반응의 텍스트를 수정한다. 메모가 아닌 반응은 수정할 수 없다.

### 4.2 요청

```http
PUT /api/interactions/880e8400-e29b-41d4-a716-446655440003 HTTP/1.1
Cookie: sb-access-token=...
Content-Type: application/json

{
  "memo_text": "수정된 메모 텍스트"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `memo_text` | `string` | O | 수정할 메모 텍스트 |

### 4.3 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "interaction": "메모",
    "memo_text": "수정된 메모 텍스트",
    "content_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 4.4 에러 응답

| HTTP | errorCode | 상황 |
|------|-----------|------|
| 401 | `AUTH_REQUIRED` | 세션 없음 |
| 400 | `INTERACTION_MEMO_REQUIRED` | memo_text 누락 |
| 400 | `INTERACTION_NOT_MEMO` | 메모가 아닌 반응 수정 시도 |
| 404 | `INTERACTION_NOT_FOUND` | 해당 ID의 반응 없음 |

### 4.5 구현 상세

1. `select().eq('id', id).single()`으로 기존 레코드 조회
2. `interaction !== '메모'` 이면 400 INTERACTION_NOT_MEMO 반환
3. `update({ memo_text }).eq('id', id).select().single()`으로 업데이트

---

## 5. GET /api/interactions/stats -- 반응 통계 (신규)

### 5.1 개요

지정 기간의 반응 통계를 반환한다. 반응 타입별, 소스별, 채널별 집계.

### 5.2 요청

```http
GET /api/interactions/stats?from=2026-02-01&to=2026-02-28 HTTP/1.1
Cookie: sb-access-token=...
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `from` | `YYYY-MM-DD` | X | 30일 전 | 시작 날짜 |
| `to` | `YYYY-MM-DD` | X | 오늘 | 종료 날짜 |

### 5.3 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2026-02-01",
      "to": "2026-02-28"
    },
    "total": 245,
    "by_type": {
      "좋아요": 85,
      "싫어요": 20,
      "저장": 45,
      "메모": 12,
      "웹열기": 30,
      "링크클릭": 18,
      "스킵": 35
    },
    "by_source": {
      "telegram_bot": 120,
      "web": 90,
      "system": 35
    },
    "by_channel": {
      "tech": 100,
      "world": 50,
      "culture": 40,
      "canada": 35
    }
  }
}
```

### 5.4 에러 응답

| HTTP | errorCode | 상황 |
|------|-----------|------|
| 401 | `AUTH_REQUIRED` | 세션 없음 |

### 5.5 구현 상세

3개의 별도 쿼리로 집계:
1. `select('interaction')` → by_type 집계 (인메모리 카운트)
2. `select('source')` → by_source 집계 (인메모리 카운트)
3. `select('content_items!inner(channel)')` → by_channel 집계

모든 타입(`좋아요`, `싫어요`, `저장`, `메모`, `웹열기`, `링크클릭`, `스킵`)과 소스(`telegram_bot`, `web`, `system`)는 데이터가 없어도 0으로 초기화하여 반환.

---

## 6. 텔레그램 봇 변경사항

### 6.1 insertInteraction UPSERT 적용 (F-11)

`lib/telegram-commands.ts`의 `insertInteraction()` 함수가 INSERT에서 UPSERT로 변경됨:
- 메모 외 반응: `upsert({ onConflict: 'content_id,interaction', ignoreDuplicates: true })`
- 메모: 여전히 `insert()` (복수 허용)

`handleCallbackQuery()`도 내부적으로 `insertInteraction()`을 호출하여 UPSERT 적용.

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-02-28 | 1.0 | F-11 API 엔드포인트 문서 작성 (설계 확정) |
| 2026-02-28 | 1.1 | 구현 완료 확정본 업데이트 (테스트 PASS 확인) |
