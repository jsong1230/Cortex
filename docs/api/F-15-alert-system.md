# F-15 긴급 알림 시스템 — API 스펙 확정본

## 개요

| 항목 | 내용 |
|------|------|
| 기능명 | 긴급 알림 시스템 |
| 버전 | v1.0 |
| 작성일 | 2026-02-28 |
| 인수조건 | AC1~AC7 |

---

## 엔드포인트 목록

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | /api/cron/alerts/check | CRON_SECRET | 긴급 알림 트리거 체크 (Vercel Cron) |
| GET | /api/alerts/settings | Supabase Auth | 알림 설정 목록 조회 |
| PUT | /api/alerts/settings | Supabase Auth | 알림 설정 업데이트 |

---

## POST /api/cron/alerts/check

**설명**: 매시간 Vercel Cron이 호출하는 긴급 알림 트리거 체크 엔드포인트.
alert_settings에서 활성화된 트리거를 확인하고, 조건 충족 시 텔레그램으로 알림을 발송한다.

**인증**: `Authorization: Bearer {CRON_SECRET}` 헤더 필수

### 요청

```http
POST /api/cron/alerts/check
Authorization: Bearer {CRON_SECRET}
```

### 응답 200 — 정상 처리

```json
{
  "success": true,
  "data": {
    "triggered": 1,
    "skipped": ["keyword_breaking: quiet_hours"],
    "errors": []
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| triggered | number | 실제 발송된 알림 수 |
| skipped | string[] | 발송 건너뜀 이유 목록 |
| errors | string[] | 처리 중 오류 목록 |

### 응답 401 — 인증 실패

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 내부 처리 로직 (AC1~AC7)

1. **AC7**: `alert_settings` 테이블에서 활성화된 트리거 조회
2. **AC6**: 방해 금지 시간(기본 23:00~07:00) 체크
3. **AC5**: 오늘 발송 횟수 체크 (`alert_log` 기준, 최대 3회)
4. **AC4**: 당일 중복 발송 체크 (`alert_log` 기준, trigger_type + content_id)
5. **AC2**: `toronto_weather` 트리거 — OpenWeatherMap에서 날씨 조회
   - 폭설(snow >= 15mm/h)
   - 한파(temperature <= -20°C)
   - 폭풍 경보(hasWeatherAlert === true)
6. **AC3**: `keyword_breaking` 트리거 — `interest_profile` 상위 3개 토픽 × `content_items(source='hackernews', score_initial > 0.85)`
7. 조건 충족 시 `sendMessage()` 호출 후 `alert_log`에 기록

---

## GET /api/alerts/settings

**설명**: 모든 alert_settings 행 반환. 트리거별 ON/OFF 상태 및 방해 금지 시간 확인용.

**인증**: Supabase Auth 세션 쿠키

### 응답 200 — 성공

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "trigger_type": "toronto_weather",
      "is_enabled": true,
      "quiet_hours_start": "23:00",
      "quiet_hours_end": "07:00",
      "last_triggered_at": null,
      "daily_count": 0,
      "daily_count_reset_at": "2026-02-28"
    },
    {
      "id": "uuid",
      "trigger_type": "keyword_breaking",
      "is_enabled": true,
      "quiet_hours_start": "23:00",
      "quiet_hours_end": "07:00",
      "last_triggered_at": "2026-02-28T10:00:00Z",
      "daily_count": 1,
      "daily_count_reset_at": "2026-02-28"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| trigger_type | string | 트리거 종류 (아래 ENUM 참조) |
| is_enabled | boolean | 트리거 활성화 여부 |
| quiet_hours_start | string (HH:MM) | 방해 금지 시작 시간 (KST) |
| quiet_hours_end | string (HH:MM) | 방해 금지 종료 시간 (KST) |
| last_triggered_at | string \| null | 마지막 트리거 시각 (UTC ISO 8601) |
| daily_count | number | 오늘 발송 횟수 |
| daily_count_reset_at | string (YYYY-MM-DD) | daily_count 초기화 날짜 |

**trigger_type ENUM**:
- `toronto_weather` — 토론토 날씨 경보
- `keyword_breaking` — HN 속보 × 관심 키워드
- `world_emergency` — 세계 긴급 뉴스 (현재 미구현)
- `culture_trend` — 문화 트렌드 (기본 비활성화)
- `mylifeos_match` — My Life OS 컨텍스트 매칭 (현재 미구현)

### 응답 401 — 인증 필요

```json
{
  "success": false,
  "error": "인증이 필요합니다."
}
```

---

## PUT /api/alerts/settings

**설명**: 특정 트리거의 ON/OFF 상태 및 방해 금지 시간을 업데이트한다.

**인증**: Supabase Auth 세션 쿠키

### 요청 바디

```json
{
  "trigger_type": "toronto_weather",
  "is_enabled": false,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| trigger_type | TriggerType | 필수 | 업데이트할 트리거 종류 |
| is_enabled | boolean | 필수 | 활성화/비활성화 |
| quiet_hours_start | string (HH:MM) | 선택 | 방해 금지 시작 시간 |
| quiet_hours_end | string (HH:MM) | 선택 | 방해 금지 종료 시간 |

### 응답 200 — 성공

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "trigger_type": "toronto_weather",
    "is_enabled": false,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "08:00",
    "last_triggered_at": null,
    "daily_count": 0,
    "daily_count_reset_at": "2026-02-28"
  }
}
```

### 응답 400 — 검증 실패

```json
{
  "success": false,
  "error": "유효하지 않은 trigger_type입니다. 허용값: toronto_weather, keyword_breaking, ..."
}
```

에러 케이스:
- `trigger_type` 누락 또는 유효하지 않은 값
- `is_enabled` 누락
- 잘못된 JSON body

### 응답 401 — 인증 필요

```json
{
  "success": false,
  "error": "인증이 필요합니다."
}
```

---

## 텔레그램 알림 포맷

긴급 알림은 브리핑과 구분되는 `⚠️` 프리픽스를 사용한다.

```
⚠️ 긴급 알림

[알림 제목]
[알림 본문]

🔗 자세히 보기 (sourceUrl이 있는 경우)
```

예시 (날씨 경보):
```
⚠️ 긴급 알림

토론토 한파 경보
현재기온 -25°C (체감 -35°C). 방한 준비가 필요합니다.
```

예시 (HN 속보):
```
⚠️ 긴급 알림

[AI] HN 속보
New AI breakthrough changes everything

🔗 자세히 보기
```

---

## lib/alerts.ts 공개 API

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| isQuietHours | (start, end, now?) => boolean | 방해 금지 시간 여부 (AC6) |
| checkDailyAlertCount | (supabase) => Promise<boolean> | 하루 3회 캡 확인 (AC5) |
| hasDuplicateAlert | (supabase, type, contentId) => Promise<boolean> | 당일 중복 확인 (AC4) |
| checkTorontoWeatherAlert | () => Promise<AlertTrigger \| null> | 날씨 트리거 체크 (AC2) |
| checkKeywordBreaking | (supabase) => Promise<AlertTrigger \| null> | HN 키워드 트리거 체크 (AC3) |
| sendAlert | (supabase, setting, trigger) => Promise<{sent, reason?}> | 모든 가드 포함 발송 |
| processAlertTriggers | () => Promise<ProcessResult> | 전체 트리거 처리 (AC1) |
