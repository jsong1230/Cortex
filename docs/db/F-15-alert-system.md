# F-15 긴급 알림 시스템 — DB 스키마 확정본

## 개요

| 항목 | 내용 |
|------|------|
| 기능명 | 긴급 알림 시스템 |
| 마이그레이션 | 002_alert_settings.sql (기존), 006_alert_log.sql (신규) |
| 작성일 | 2026-02-28 |

---

## 테이블: alert_settings (기존 — 002_alert_settings.sql)

트리거별 ON/OFF, 방해 금지 시간, 일일 발송 횟수를 관리한다. (AC7)

### 스키마

```sql
CREATE TABLE IF NOT EXISTS alert_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type         TEXT NOT NULL UNIQUE,
  is_enabled           BOOLEAN DEFAULT TRUE,
  quiet_hours_start    TIME DEFAULT '23:00',
  quiet_hours_end      TIME DEFAULT '07:00',
  last_triggered_at    TIMESTAMPTZ,
  daily_count          INT DEFAULT 0,
  daily_count_reset_at DATE DEFAULT CURRENT_DATE
);
```

### 컬럼

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | PK |
| trigger_type | TEXT | NO | — | 트리거 종류 (UNIQUE) |
| is_enabled | BOOLEAN | YES | TRUE | 트리거 활성화 여부 |
| quiet_hours_start | TIME | YES | 23:00 | 방해 금지 시작 시간 |
| quiet_hours_end | TIME | YES | 07:00 | 방해 금지 종료 시간 |
| last_triggered_at | TIMESTAMPTZ | YES | NULL | 마지막 트리거 시각 |
| daily_count | INT | YES | 0 | 오늘 발송 횟수 (참고용) |
| daily_count_reset_at | DATE | YES | CURRENT_DATE | daily_count 초기화 날짜 |

### trigger_type 초기 데이터

| trigger_type | is_enabled | 비고 |
|---|---|---|
| toronto_weather | TRUE | 토론토 날씨 경보 |
| keyword_breaking | TRUE | HN 속보 × 관심 키워드 |
| world_emergency | TRUE | 세계 긴급 뉴스 (구현 대기) |
| culture_trend | FALSE | 문화 트렌드 (노이즈 방지로 기본 비활성) |
| mylifeos_match | TRUE | My Life OS 컨텍스트 (구현 대기) |

---

## 테이블: alert_log (신규 — 006_alert_log.sql)

발송된 알림 이력을 기록한다. 당일 중복 방지(AC4)와 하루 3회 하드 캡(AC5) 집계에 사용된다.

### 스키마

```sql
CREATE TABLE IF NOT EXISTS alert_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  content_id   UUID,
  source_url   TEXT,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 컬럼

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | PK |
| trigger_type | TEXT | NO | — | 트리거 종류 |
| title | TEXT | NO | — | 알림 제목 |
| message | TEXT | NO | — | 알림 본문 |
| content_id | UUID | YES | NULL | 연관 콘텐츠 ID (keyword_breaking 등) |
| source_url | TEXT | YES | NULL | 원본 링크 |
| sent_at | TIMESTAMPTZ | NO | NOW() | 발송 시각 |

### 인덱스

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| idx_alert_log_trigger_type | trigger_type | 트리거별 조회 |
| idx_alert_log_content_id | content_id | 콘텐츠별 조회 |
| idx_alert_log_sent_at | sent_at DESC | 날짜 기반 카운트 (AC5) |
| idx_alert_log_trigger_content_sent | (trigger_type, content_id, sent_at DESC) | 당일 중복 조회 최적화 (AC4) |

### 쿼리 패턴

**AC5: 하루 3회 캡 확인**
```sql
SELECT id FROM alert_log
WHERE sent_at >= '2026-02-28T00:00:00Z';
-- count >= 3이면 발송 불가
```

**AC4: 당일 중복 확인 (keyword_breaking)**
```sql
SELECT * FROM alert_log
WHERE trigger_type = 'keyword_breaking'
  AND content_id = 'content-uuid-001'
  AND sent_at >= '2026-02-28T00:00:00Z';
-- 결과 있으면 중복 → 발송 건너뜀
```

**AC4: 당일 중복 확인 (toronto_weather, content_id NULL)**
```sql
SELECT * FROM alert_log
WHERE trigger_type = 'toronto_weather'
  AND content_id IS NULL
  AND sent_at >= '2026-02-28T00:00:00Z';
```

---

## 데이터 흐름

```
Vercel Cron (1시간)
    │
    ▼
POST /api/cron/alerts/check
    │
    ▼
processAlertTriggers()
    ├── alert_settings 조회 (trigger_type, is_enabled, quiet_hours)
    ├── isQuietHours() 체크 → 방해 금지 시간이면 스킵
    ├── checkDailyAlertCount(alert_log) → 3회 초과면 스킵
    ├── hasDuplicateAlert(alert_log) → 당일 중복이면 스킵
    ├── checkTorontoWeatherAlert() → OpenWeatherMap API
    ├── checkKeywordBreaking() → content_items × interest_profile
    │
    ▼ (조건 충족 시)
sendMessage() — 텔레그램 발송
    │
    ▼
alert_log INSERT — 발송 이력 기록
```

---

## 주요 설계 결정

1. **daily_count vs alert_log 집계**: `alert_settings.daily_count`는 참고용 필드로 남겨두고, 실제 카운트는 `alert_log`를 직접 집계한다. 이유: 서버 재시작/DB 장애 시 카운트 불일치 방지.

2. **content_id NULL 허용**: `toronto_weather` 트리거는 특정 콘텐츠 ID가 없으므로 NULL을 허용한다. AC4 중복 체크 시 `trigger_type + sent_at >= today` 조건으로만 판단한다.

3. **오류 시 안전 기본값**:
   - `checkDailyAlertCount` DB 오류 시 `false` 반환 (과잉 발송 방지 우선)
   - `hasDuplicateAlert` DB 오류 시 `false` 반환 (알림 누락 방지 우선)
   - 날씨 API 실패 시 `null` 반환 (알림 스킵)
