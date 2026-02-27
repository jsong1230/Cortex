# F-17 피로도 방지 장치 — API 스펙 확정본

작성일: 2026-02-28
구현 파일:
- `app/api/settings/channels/route.ts`
- `app/api/settings/mute/route.ts`
- `lib/fatigue-prevention.ts`
- `lib/telegram-commands.ts` (handleMute 수정)
- `app/api/cron/send-briefing/route.ts` (fatigue prevention 통합)

---

## 공통 규격

### 응답 형식

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "메시지" }
```

### 인증

설정 API는 현재 인증 없이 동작합니다 (1인 서비스 특성상 cron secret으로 보호된 환경에서 사용).

---

## 채널 설정 API

### GET /api/settings/channels

채널별 ON/OFF 설정을 반환한다. 설정이 없으면 기본값(모두 ON)을 반환한다.

**요청:** 없음

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "tech": true,
    "world": true,
    "culture": false,
    "canada": true
  }
}
```

**에러:**

| 상태 | 설명 |
|------|------|
| 500 | DB 조회 실패 |

---

### PUT /api/settings/channels

채널별 ON/OFF 설정을 업데이트한다.

**요청 바디:**

```json
{
  "tech": true,
  "world": false,
  "culture": true,
  "canada": false
}
```

모든 필드 필수. 값은 boolean이어야 한다.

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "tech": true,
    "world": false,
    "culture": true,
    "canada": false
  }
}
```

**에러:**

| 상태 | 설명 |
|------|------|
| 400 | 필드 누락 또는 비불리언 값 |
| 500 | DB 저장 실패 |

---

## 뮤트 설정 API

### GET /api/settings/mute

현재 뮤트 상태를 반환한다.

**요청:** 없음

**응답 예시 (뮤트 아님):**

```json
{
  "success": true,
  "data": {
    "isMuted": false,
    "muteUntil": null
  }
}
```

**응답 예시 (뮤트 중):**

```json
{
  "success": true,
  "data": {
    "isMuted": true,
    "muteUntil": "2026-03-03T22:00:00.000Z"
  }
}
```

---

### POST /api/settings/mute

N일간 브리핑을 중단한다.

**요청 바디:**

```json
{ "days": 3 }
```

`days`: 정수, 1 이상 365 이하 필수.

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "isMuted": true,
    "days": 3,
    "muteUntil": "2026-03-03T22:00:00.000Z"
  }
}
```

**에러:**

| 상태 | 설명 |
|------|------|
| 400 | days 누락, 음수, 365 초과, 정수 아님 |
| 500 | DB 저장 실패 |

---

### DELETE /api/settings/mute

뮤트를 즉시 해제한다.

**요청:** 없음

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "isMuted": false,
    "muteUntil": null
  }
}
```

---

## 텔레그램 /mute 명령어 변경

기존 `/mute N` 명령어는 `alert_settings` 테이블 대신 `user_settings.mute_until`을 업데이트하도록 변경되었다.

| 명령어 | 동작 |
|--------|------|
| `/mute 3` | 3일간 뮤트 (user_settings.mute_until 설정) |
| `/mute 0` | 뮤트 해제 (user_settings.mute_until = null) |

---

## 브리핑 파이프라인 변경 (send-briefing cron)

F-17 기능이 `POST /api/cron/send-briefing`에 통합되었다.

### 처리 순서

1. **AC2 뮤트 확인**: `mute_until > now`이면 발송 스킵
2. **AC1 채널 필터**: `channel_settings`에서 OFF인 채널 아이템 제외
3. 아이템 선정 (F-16)
4. **AC3 자동 감소**: 7일 무반응 감지 시 `item_reduction += 2` (max 4), 결과 아이템 수 감소
5. **AC4 반복 이슈 마킹**: 과거 2일치 브리핑과 비교, 3일 연속 등장 시 `is_following=true` 마킹
6. 포매팅 (F-16)
7. 발송

### 뮤트 스킵 응답

```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-03-01",
    "items_count": 0,
    "telegram_sent": false,
    "channels": {},
    "mode": "weekday",
    "skipped_reason": "muted"
  }
}
```
