# F-20 웹 설정 페이지 — API 스펙 확정본

> 구현일: 2026-02-28
> 기존 API (F-17, F-15) 재사용 + 신규 3개 API 추가

---

## 기존 API (재사용)

### GET /api/settings/channels
채널 ON/OFF 설정 조회 — F-17 구현됨

### PUT /api/settings/channels
채널 ON/OFF 설정 업데이트 — F-17 구현됨

**Request Body:**
```json
{
  "tech": true,
  "world": true,
  "culture": false,
  "canada": true
}
```

### GET /api/alerts/settings
긴급 알림 트리거 설정 목록 조회 — F-15 구현됨

### PUT /api/alerts/settings
긴급 알림 트리거 ON/OFF + 방해 금지 시간 설정 — F-15 구현됨

**Request Body:**
```json
{
  "trigger_type": "toronto_weather",
  "is_enabled": false,
  "quiet_hours_start": "23:00",
  "quiet_hours_end": "07:00"
}
```

### GET /api/settings/mute
뮤트 상태 조회 — F-17 구현됨

### POST /api/settings/mute
뮤트 설정 — F-17 구현됨

### DELETE /api/settings/mute
뮤트 해제 — F-17 구현됨

---

## 신규 API

### GET /api/settings/rss

RSS 소스 URL 목록을 조회한다.

**인증:** 불필요 (1인 서비스)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "url": "https://example.com/feed.xml",
      "name": "Example Blog",
      "channel": "tech"
    }
  ]
}
```

**Response 500:**
```json
{ "success": false, "error": "에러 메시지" }
```

---

### POST /api/settings/rss

RSS 소스 URL을 추가한다.

**인증:** 불필요 (1인 서비스)

**Request Body:**
```json
{
  "url": "https://example.com/feed.xml",
  "name": "Example Blog",
  "channel": "tech"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| url | string | Y | RSS 피드 URL (http:// 또는 https://) |
| name | string | N | 소스 이름 (없으면 hostname 자동 추출) |
| channel | string | N | 채널 (tech/world/culture/canada, 기본값: tech) |

**Response 200:**
```json
{
  "success": true,
  "data": [/* 전체 RSS 소스 목록 */]
}
```

**Response 400 — url 누락:**
```json
{ "success": false, "error": "url 필드가 필요합니다." }
```

**Response 400 — 잘못된 URL 형식:**
```json
{ "success": false, "error": "유효하지 않은 URL 형식입니다. http:// 또는 https:// 로 시작해야 합니다." }
```

**Response 400 — 잘못된 channel:**
```json
{ "success": false, "error": "유효하지 않은 channel입니다. 허용값: tech, world, culture, canada" }
```

**Response 409 — 중복 URL:**
```json
{ "success": false, "error": "이미 등록된 RSS URL입니다." }
```

---

### DELETE /api/settings/rss

RSS 소스 URL을 삭제한다.

**인증:** 불필요 (1인 서비스)

**Request Body:**
```json
{ "url": "https://example.com/feed.xml" }
```

**Response 200:**
```json
{
  "success": true,
  "data": [/* 삭제 후 전체 RSS 소스 목록 */]
}
```

**Response 400 — url 누락:**
```json
{ "success": false, "error": "url 필드가 필요합니다." }
```

**Response 404 — 존재하지 않는 URL:**
```json
{ "success": false, "error": "등록되지 않은 RSS URL입니다." }
```

---

### GET /api/settings/mylifeos

My Life OS 연동 ON/OFF 상태를 조회한다.

**인증:** 불필요 (1인 서비스)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "enabled": true
  }
}
```

---

### PUT /api/settings/mylifeos

My Life OS 연동 ON/OFF를 설정한다.

**인증:** 불필요 (1인 서비스)

**Request Body:**
```json
{ "enabled": true }
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| enabled | boolean | Y | 연동 활성화 여부 |

**Response 200:**
```json
{
  "success": true,
  "data": { "enabled": true }
}
```

**Response 400 — enabled 누락:**
```json
{ "success": false, "error": "enabled 필드가 필요합니다." }
```

**Response 400 — 타입 오류:**
```json
{ "success": false, "error": "enabled 값은 불리언이어야 합니다." }
```

**Response 500:**
```json
{ "success": false, "error": "저장 실패: ..." }
```

---

### GET /api/settings/telegram

텔레그램 봇 연동 상태를 조회한다.
서버 환경변수 `TELEGRAM_CHAT_ID`와 `TELEGRAM_BOT_TOKEN` 설정 여부를 기반으로 판단한다.

**인증:** 불필요 (1인 서비스)

**Response 200 — 연동됨:**
```json
{
  "success": true,
  "data": {
    "linked": true,
    "chat_id_masked": "123******",
    "bot_username": "CortexBot"
  }
}
```

**Response 200 — 연동 안됨:**
```json
{
  "success": true,
  "data": {
    "linked": false,
    "chat_id_masked": null,
    "bot_username": "CortexBot"
  }
}
```

**chat_id_masked 규칙:** 앞 3자리 노출 + 나머지 `*` 마스킹
예: `123456789` → `123******`

**환경변수:**
| 변수 | 용도 |
|------|------|
| TELEGRAM_CHAT_ID | 텔레그램 chat ID (연동 여부 판단에 사용) |
| TELEGRAM_BOT_TOKEN | 봇 토큰 (연동 여부 판단에 사용) |
| TELEGRAM_BOT_USERNAME | 봇 사용자명 (없으면 'CortexBot' 기본값) |

---

## 웹 페이지

### GET /settings (Server Component)

`/settings` 라우트는 Next.js Server Component로 구현되었다.
서버에서 초기 데이터를 로드하고 클라이언트 컴포넌트에 props로 전달한다.

**페이지 섹션:**
1. 채널 설정 — `ChannelToggles` 컴포넌트 (AC2)
2. 긴급 알림 설정 — `AlertSettings` 컴포넌트 (AC3, AC4)
3. RSS 소스 관리 — `RssSources` 컴포넌트 (AC1)
4. My Life OS 연동 — `MyLifeOsToggle` 컴포넌트 (AC5)
5. 텔레그램 연동 — `TelegramStatus` 컴포넌트 (AC6)
