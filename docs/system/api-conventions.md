# Cortex -- API 컨벤션

**버전**: 1.0 | **날짜**: 2026-02-27 | **상태**: 확정
**참조**: `docs/system/system-design.md` 5장, `docs/project/features.md`

---

## 1. API 응답 포맷

### 1.1 공통 응답 인터페이스

```typescript
/** 모든 API 응답의 기본 구조 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;  // 비즈니스 에러 코드 (선택)
}
```

### 1.2 성공 응답

```typescript
// HTTP 200 OK
{
  "success": true,
  "data": {
    // T 타입 데이터
  }
}

// HTTP 201 Created (리소스 생성 시)
{
  "success": true,
  "data": {
    "id": "uuid",
    // 생성된 리소스
  }
}

// HTTP 200 OK (데이터 없는 성공)
{
  "success": true
}
```

### 1.3 에러 응답

```typescript
// HTTP 4xx / 5xx
{
  "success": false,
  "error": "사람이 읽을 수 있는 에러 메시지",
  "errorCode": "BUSINESS_ERROR_CODE"  // 선택
}
```

---

## 2. HTTP 상태 코드 사용 규칙

| 상태 코드 | 의미 | 사용 시점 |
|-----------|------|----------|
| **200** | OK | 조회 성공, 업데이트 성공 |
| **201** | Created | 새 리소스 생성 (POST /interactions) |
| **400** | Bad Request | 요청 본문 유효성 검증 실패 |
| **401** | Unauthorized | 인증 실패 (Cron Secret, Telegram Secret, Supabase Auth) |
| **404** | Not Found | 브리핑/아이템 미존재 |
| **405** | Method Not Allowed | 허용되지 않은 HTTP 메서드 |
| **409** | Conflict | 중복 데이터 (source_url 충돌 등) |
| **429** | Too Many Requests | 긴급 알림 하루 최대 3회 초과 |
| **500** | Internal Server Error | 서버 내부 에러 |
| **502** | Bad Gateway | 외부 API 호출 실패 (Claude, Telegram 등) |
| **503** | Service Unavailable | 외부 서비스 일시 장애 |

---

## 3. 인증 패턴

Cortex는 4가지 인증 방식을 사용한다. 1인 사용자 전용이므로 역할(Role) 기반 권한 관리는 불필요하다.

### 3.1 Cron Secret (Bearer Token)

**적용 대상**: `/api/cron/*` 전체, `/api/context/sync`

```typescript
// 요청 헤더
Authorization: Bearer {CRON_SECRET}

// 검증 로직
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  // 비즈니스 로직
}
```

**특징:**
- Vercel Cron Jobs에서 자동 호출 시 사용
- `CRON_SECRET` 환경 변수로 관리
- Supabase는 `SUPABASE_SERVICE_ROLE_KEY`로 접근하여 RLS 우회

### 3.2 Telegram Webhook Secret

**적용 대상**: `/api/telegram/webhook`

```typescript
// 요청 헤더
X-Telegram-Bot-Api-Secret-Token: {TELEGRAM_WEBHOOK_SECRET}

// 검증 로직
export async function POST(request: Request) {
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
  if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  // 텔레그램 메시지 처리
}
```

**특징:**
- 텔레그램 서버가 웹훅 호출 시 자동 첨부
- `setWebhook` API 호출 시 `secret_token` 파라미터로 등록

### 3.3 Supabase Auth (세션)

**적용 대상**: `/api/briefings/*`, `/api/interactions`, `/api/profile/*`, `/api/alerts/settings`

```typescript
// 검증 로직
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  const supabase = createServerClient(/* ... */);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  // 인증된 사용자 요청 처리
}
```

**특징:**
- 웹 대시보드 접근 시 사용
- Supabase Auth 세션 쿠키 기반
- 텔레그램 로그인 위젯 또는 이메일/비밀번호 인증

### 3.4 내부 전용 (Cron Secret)

**적용 대상**: `/api/context/sync`

- Cron Secret과 동일한 인증 방식
- `/api/cron/send-briefing` 내부에서 호출하거나 별도 Cron으로 트리거
- My Life OS 테이블 접근은 `SUPABASE_SERVICE_ROLE_KEY` 사용

---

## 4. API 라우트 목록

### 4.1 Cron 엔드포인트 (서버 전용)

| 메서드 | 엔드포인트 | 인증 | 설명 | 관련 기능 |
|--------|-----------|------|------|----------|
| POST | `/api/cron/collect` | Cron Secret | 콘텐츠 수집 파이프라인 (06:30 KST) | F-01~F-05 |
| POST | `/api/cron/send-briefing` | Cron Secret | 브리핑 생성 + 텔레그램 발송 (07:00 KST) | F-06, F-16 |
| POST | `/api/cron/alerts/check` | Cron Secret | 긴급 알림 트리거 체크 (매시간) | F-15 |

### 4.2 텔레그램 웹훅

| 메서드 | 엔드포인트 | 인증 | 설명 | 관련 기능 |
|--------|-----------|------|------|----------|
| POST | `/api/telegram/webhook` | Telegram Secret | 봇 메시지/인라인 버튼 수신 | F-07, F-11 |

### 4.3 웹 대시보드 API

| 메서드 | 엔드포인트 | 인증 | 설명 | 관련 기능 |
|--------|-----------|------|------|----------|
| GET | `/api/briefings/today` | Supabase Auth | 오늘 브리핑 조회 | F-08 |
| GET | `/api/briefings/[date]` | Supabase Auth | 특정 날짜 브리핑 조회 (YYYY-MM-DD) | F-10 |
| POST | `/api/interactions` | Supabase Auth | 웹 반응 로그 저장 | F-11 |
| GET | `/api/profile/interests` | Supabase Auth | 관심사 프로필 조회 | F-14 |
| PUT | `/api/alerts/settings` | Supabase Auth | 긴급 알림 트리거 ON/OFF 설정 | F-15, F-20 |

### 4.4 내부 API

| 메서드 | 엔드포인트 | 인증 | 설명 | 관련 기능 |
|--------|-----------|------|------|----------|
| POST | `/api/context/sync` | Cron Secret | My Life OS 컨텍스트 동기화 | F-18 |

---

## 5. 에러 코드 체계

### 5.1 비즈니스 에러 코드

```
{DOMAIN}_{ERROR_TYPE}
```

| 에러 코드 | HTTP 상태 | 설명 | 발생 API |
|-----------|----------|------|----------|
| `BRIEFING_NOT_FOUND` | 404 | 해당 날짜의 브리핑이 존재하지 않음 | GET `/api/briefings/today`, GET `/api/briefings/[date]` |
| `BRIEFING_ALREADY_SENT` | 409 | 오늘 브리핑이 이미 발송됨 | POST `/api/cron/send-briefing` |
| `CONTENT_NOT_FOUND` | 404 | 콘텐츠 아이템이 존재하지 않음 | POST `/api/interactions` |
| `INTERACTION_INVALID_TYPE` | 400 | 유효하지 않은 반응 타입 | POST `/api/interactions` |
| `INTERACTION_DUPLICATE` | 409 | 동일 콘텐츠에 동일 반응이 이미 존재 | POST `/api/interactions` |
| `COLLECTION_PARTIAL_FAILURE` | 200 | 일부 채널 수집 실패 (전체 실패 아님) | POST `/api/cron/collect` |
| `COLLECTION_TOTAL_FAILURE` | 500 | 모든 채널 수집 실패 | POST `/api/cron/collect` |
| `TELEGRAM_SEND_FAILED` | 502 | 텔레그램 메시지 발송 실패 | POST `/api/cron/send-briefing` |
| `TELEGRAM_WEBHOOK_INVALID` | 401 | 텔레그램 웹훅 시크릿 검증 실패 | POST `/api/telegram/webhook` |
| `CLAUDE_API_FAILED` | 502 | Claude API 호출 실패 | POST `/api/cron/collect` |
| `ALERT_DAILY_LIMIT` | 429 | 긴급 알림 하루 최대 3회 초과 | POST `/api/cron/alerts/check` |
| `ALERT_QUIET_HOURS` | 200 | 방해 금지 시간대 (정상 스킵) | POST `/api/cron/alerts/check` |
| `ALERT_TRIGGER_NOT_FOUND` | 404 | 알림 트리거 유형이 존재하지 않음 | PUT `/api/alerts/settings` |
| `CONTEXT_SYNC_FAILED` | 502 | My Life OS 데이터 접근 실패 | POST `/api/context/sync` |
| `AUTH_REQUIRED` | 401 | 인증이 필요함 | 모든 인증 필요 API |
| `AUTH_INVALID_TOKEN` | 401 | 유효하지 않은 토큰 | Cron/Telegram 인증 API |

### 5.2 에러 응답 형식

```json
{
  "success": false,
  "error": "해당 날짜(2026-02-27)의 브리핑이 존재하지 않습니다",
  "errorCode": "BRIEFING_NOT_FOUND"
}
```

**부분 실패 응답 (수집 파이프라인):**
```json
{
  "success": true,
  "data": {
    "collected": { "tech": 15, "world": 8, "culture": 0, "canada": 5 },
    "summarized": 25,
    "duplicates_skipped": 3,
    "errors": [
      { "channel": "culture", "source": "melon", "error": "HTML 파싱 실패" }
    ]
  }
}
```

> 수집 파이프라인은 개별 채널 실패 시에도 `success: true`를 반환한다. `errors` 배열이 비어있지 않으면 부분 실패(COLLECTION_PARTIAL_FAILURE)를 의미한다. 모든 채널이 실패하면 `success: false` + `COLLECTION_TOTAL_FAILURE`를 반환한다.

---

## 6. 요청/응답 예시

### 6.1 POST `/api/cron/collect` -- 콘텐츠 수집

**요청:**
```http
POST /api/cron/collect HTTP/1.1
Authorization: Bearer {CRON_SECRET}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "data": {
    "collected": {
      "tech": 15,
      "world": 8,
      "culture": 12,
      "canada": 5
    },
    "summarized": 35,
    "duplicates_skipped": 5,
    "errors": []
  }
}
```

### 6.2 POST `/api/cron/send-briefing` -- 브리핑 발송

**요청:**
```http
POST /api/cron/send-briefing HTTP/1.1
Authorization: Bearer {CRON_SECRET}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-02-27",
    "items_count": 8,
    "telegram_sent": true,
    "channels": {
      "tech": 3,
      "world": 1,
      "culture": 1,
      "canada": 2,
      "serendipity": 1
    }
  }
}
```

### 6.3 POST `/api/cron/alerts/check` -- 긴급 알림 체크

**요청:**
```http
POST /api/cron/alerts/check HTTP/1.1
Authorization: Bearer {CRON_SECRET}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "data": {
    "checked_triggers": ["toronto_weather", "keyword_breaking", "world_emergency", "mylifeos_match"],
    "alerts_sent": 1,
    "daily_count": 2,
    "details": [
      {
        "trigger": "toronto_weather",
        "fired": true,
        "reason": "폭설 경보: 토론토 예상 적설량 20cm"
      }
    ]
  }
}
```

### 6.4 POST `/api/telegram/webhook` -- 텔레그램 웹훅

**요청 (인라인 버튼 콜백):**
```http
POST /api/telegram/webhook HTTP/1.1
X-Telegram-Bot-Api-Secret-Token: {TELEGRAM_WEBHOOK_SECRET}
Content-Type: application/json

{
  "update_id": 123456789,
  "callback_query": {
    "id": "query_id",
    "from": { "id": 123456, "first_name": "jsong" },
    "data": "like:550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "data": {
    "interaction": "좋아요",
    "content_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**요청 (명령어):**
```http
POST /api/telegram/webhook HTTP/1.1
X-Telegram-Bot-Api-Secret-Token: {TELEGRAM_WEBHOOK_SECRET}
Content-Type: application/json

{
  "update_id": 123456790,
  "message": {
    "from": { "id": 123456, "first_name": "jsong" },
    "text": "/save 3"
  }
}
```

**인라인 키보드 콜백 데이터 형식:**
```
{action}:{content_id}
예: like:550e8400-e29b-41d4-a716-446655440000
예: dislike:550e8400-e29b-41d4-a716-446655440000
예: save:550e8400-e29b-41d4-a716-446655440000
```

### 6.5 GET `/api/briefings/today` -- 오늘 브리핑

**요청:**
```http
GET /api/briefings/today HTTP/1.1
Cookie: sb-access-token=...
```

**성공 응답 (200):**
```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-02-27",
    "items": [
      {
        "content_id": "550e8400-e29b-41d4-a716-446655440000",
        "position": 1,
        "channel": "tech",
        "title": "OpenAI, GPT-5 출시 임박",
        "summary_ai": "OpenAI가 GPT-5 모델 출시를 앞두고 있으며, 멀티모달 성능이 대폭 향상될 것으로 알려졌다.",
        "source": "hackernews",
        "source_url": "https://news.ycombinator.com/item?id=12345",
        "reason": null,
        "user_interaction": null
      },
      {
        "content_id": "660e8400-e29b-41d4-a716-446655440001",
        "position": 2,
        "channel": "canada",
        "title": "토론토 폭설 경보",
        "summary_ai": "오늘 오후부터 내일 아침까지 20cm 이상의 폭설이 예상된다.",
        "source": "cbc",
        "source_url": "https://www.cbc.ca/news/toronto/...",
        "reason": "지난주 메모: 출퇴근 경로 관련 아티클 포함",
        "user_interaction": "좋아요"
      }
    ]
  }
}
```

**에러 응답 (404):**
```json
{
  "success": false,
  "error": "오늘(2026-02-27)의 브리핑이 아직 생성되지 않았습니다",
  "errorCode": "BRIEFING_NOT_FOUND"
}
```

### 6.6 GET `/api/briefings/[date]` -- 날짜별 브리핑

**요청:**
```http
GET /api/briefings/2026-02-25 HTTP/1.1
Cookie: sb-access-token=...
```

**응답**: `/api/briefings/today`와 동일한 구조.

### 6.7 POST `/api/interactions` -- 반응 저장

**요청:**
```http
POST /api/interactions HTTP/1.1
Cookie: sb-access-token=...
Content-Type: application/json

{
  "content_id": "550e8400-e29b-41d4-a716-446655440000",
  "briefing_id": "770e8400-e29b-41d4-a716-446655440002",
  "interaction": "좋아요",
  "source": "web"
}
```

**메모 반응 요청:**
```json
{
  "content_id": "550e8400-e29b-41d4-a716-446655440000",
  "briefing_id": "770e8400-e29b-41d4-a716-446655440002",
  "interaction": "메모",
  "memo_text": "다음주 팀 미팅에서 논의해볼 것",
  "source": "web"
}
```

**성공 응답 (201):**
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

**유효성 검증 에러 (400):**
```json
{
  "success": false,
  "error": "interaction 필드는 '좋아요'|'싫어요'|'저장'|'메모'|'웹열기'|'링크클릭' 중 하나여야 합니다",
  "errorCode": "INTERACTION_INVALID_TYPE"
}
```

### 6.8 GET `/api/profile/interests` -- 관심사 프로필

**요청:**
```http
GET /api/profile/interests HTTP/1.1
Cookie: sb-access-token=...
```

**성공 응답 (200):**
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "topic": "LLM",
        "score": 0.85,
        "interaction_count": 42,
        "last_updated": "2026-02-26T15:30:00Z"
      },
      {
        "topic": "Kubernetes",
        "score": 0.72,
        "interaction_count": 28,
        "last_updated": "2026-02-25T09:00:00Z"
      },
      {
        "topic": "React Server Components",
        "score": 0.65,
        "interaction_count": 15,
        "last_updated": "2026-02-24T12:00:00Z"
      }
    ]
  }
}
```

### 6.9 PUT `/api/alerts/settings` -- 알림 설정

**요청:**
```http
PUT /api/alerts/settings HTTP/1.1
Cookie: sb-access-token=...
Content-Type: application/json

{
  "trigger_type": "toronto_weather",
  "is_enabled": true,
  "quiet_hours_start": "23:00",
  "quiet_hours_end": "07:00"
}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "data": {
    "trigger_type": "toronto_weather",
    "is_enabled": true,
    "quiet_hours_start": "23:00",
    "quiet_hours_end": "07:00"
  }
}
```

### 6.10 POST `/api/context/sync` -- My Life OS 동기화

**요청:**
```http
POST /api/context/sync HTTP/1.1
Authorization: Bearer {CRON_SECRET}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "data": {
    "diary_keywords_extracted": 12,
    "todo_keywords_extracted": 5,
    "note_keywords_extracted": 3,
    "expired_contexts_deleted": 8,
    "new_contexts_created": 20
  }
}
```

---

## 7. 공통 규칙

### 7.1 Content-Type

- 모든 요청/응답: `application/json`
- 예외: 텔레그램 웹훅은 텔레그램 서버가 `application/json`으로 전송

### 7.2 날짜/시간 형식

| 타입 | 형식 | 예시 |
|------|------|------|
| 날짜 (date) | `YYYY-MM-DD` | `2026-02-27` |
| 타임스탬프 (timestamptz) | ISO 8601 | `2026-02-27T07:00:00+09:00` |
| 시간 (time) | `HH:MM` | `23:00`, `07:00` |

- 서버 내부 처리: UTC
- Vercel Cron 설정: UTC 기준 (KST 06:30 = UTC 21:30)
- 사용자 표시: KST (UTC+9) 변환 후 표시

### 7.3 페이지네이션

Cortex는 1인 사용자 전용이므로 대용량 페이지네이션이 필요한 경우가 제한적이다.

| API | 방식 | 기본값 |
|-----|------|--------|
| `/api/briefings/[date]` | 단건 조회 | 해당 날짜 1건 |
| `/api/profile/interests` | 전체 조회 | 전체 토픽 반환 (수십 건 수준) |
| 브리핑 히스토리 (향후) | cursor 기반 또는 offset | `limit=20, offset=0` |

```typescript
// offset 기반 페이지네이션 응답 구조 (향후 필요 시)
interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

### 7.4 Rate Limiting

- **불필요**: 1인 사용자 전용이므로 Rate Limiting을 별도 구현하지 않는다.
- **예외**: 긴급 알림은 하루 최대 3회 하드 캡 (`alert_settings.daily_count`).
- **외부 API 쿼터**: 외부 서비스의 Rate Limit은 각 수집기(collector)에서 개별 관리.

### 7.5 Vercel Cron 설정

```json
{
  "crons": [
    {
      "path": "/api/cron/collect",
      "schedule": "30 21 * * *"
    },
    {
      "path": "/api/cron/send-briefing",
      "schedule": "0 22 * * *"
    },
    {
      "path": "/api/cron/alerts/check",
      "schedule": "0 * * * *"
    }
  ]
}
```

> UTC 기준: KST 06:30 = UTC 21:30, KST 07:00 = UTC 22:00.
> 주말 브리핑 시간(09:00 KST)은 `send-briefing` 내부에서 요일 체크 후 처리.
> Vercel Hobby 플랜 Cron 제한(2개)에 주의. Pro 플랜 전환 또는 collect + send-briefing 합병 검토.

### 7.6 텔레그램 봇 명령어 목록

| 명령어 | 동작 | 관련 기능 |
|--------|------|----------|
| `/good` | 마지막 브리핑 전체 긍정 기록 | F-07 AC1 |
| `/bad` | 전체 부정 기록 + 후속 키워드 질문 | F-07 AC2 |
| `/save N` | N번째 아이템 저장 | F-07 AC3 |
| `/more` | 오늘 브리핑 웹 URL 발송 | F-07 AC4 |
| `/keyword XXX` | 관심 키워드 추가 | F-07 AC5 |
| `/stats` | 이번 달 관심 토픽 Top 5 + 읽은 아티클 수 | F-07 AC6 |
| `/mute N` | N일간 브리핑 중단 (방학 모드) | F-07 AC7 |

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-27 | 초기 API 컨벤션 작성 | system-design.md v1.0 기반, 11개 API 라우트 정의 |
