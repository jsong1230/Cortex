# F-20 웹 설정 페이지 — DB 스키마 확정본

> 구현일: 2026-02-28
> 마이그레이션: `supabase/migrations/007_rss_sources.sql`

---

## 변경 테이블

### user_settings (기존 + 컬럼 추가)

F-17에서 생성된 싱글톤 테이블에 F-20 전용 컬럼을 추가한다.

**기존 컬럼:**
| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| id | TEXT | 'singleton' | 싱글톤 식별자 (PK) |
| channel_settings | JSONB | `{"tech":true,"world":true,"culture":true,"canada":true}` | 채널 ON/OFF |
| mute_until | TIMESTAMPTZ | NULL | 뮤트 종료 시각 |
| item_reduction | INT | 0 | 자동 아이템 감소량 |
| created_at | TIMESTAMPTZ | NOW() | 생성 시각 |
| updated_at | TIMESTAMPTZ | NOW() | 수정 시각 (트리거 자동 갱신) |

**F-20 추가 컬럼:**
| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| custom_rss_urls | JSONB | `[]` | 사용자 정의 RSS URL 목록 |
| mylifeos_enabled | BOOLEAN | false | My Life OS 연동 ON/OFF |

**custom_rss_urls JSONB 구조:**
```json
[
  {
    "url": "https://example.com/feed.xml",
    "name": "Example Blog",
    "channel": "tech"
  }
]
```

각 항목의 channel 허용값: `tech` | `world` | `culture` | `canada`

**설계 결정:**
- 별도 `custom_rss_sources` 테이블 대신 `user_settings` JSONB 컬럼 선택
- 이유: 1인 서비스 특성상 복잡한 테이블 분리가 불필요
- JSONB는 단순 배열 조작(추가/삭제)에 충분한 성능 제공
- 최대 예상 소스 수: 수십 개 이하 (인덱스 불필요)

---

## 참조 테이블 (변경 없음)

### alert_settings (F-15 구현됨)

방해 금지 시간대 설정은 `alert_settings.quiet_hours_start / quiet_hours_end`에 저장됨.
F-20 AC4는 기존 `/api/alerts/settings` API를 그대로 활용함.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| trigger_type | TEXT | toronto_weather / keyword_breaking / world_emergency / culture_trend / mylifeos_match |
| is_enabled | BOOLEAN | 활성화 여부 |
| quiet_hours_start | TEXT | 방해 금지 시작 (HH:MM) |
| quiet_hours_end | TEXT | 방해 금지 종료 (HH:MM) |
| last_triggered_at | TIMESTAMPTZ | 마지막 발송 시각 |
| daily_count | INT | 오늘 발송 횟수 |
| daily_count_reset_at | DATE | 카운트 초기화 날짜 |

---

## 텔레그램 상태 (DB 없음)

텔레그램 연동 상태는 서버 환경변수에서 확인한다. DB에 저장하지 않는다.

- `TELEGRAM_CHAT_ID` — 비어있으면 연동 안됨
- `TELEGRAM_BOT_TOKEN` — 비어있으면 연동 안됨
- `TELEGRAM_BOT_USERNAME` — 봇 표시명 (기본값: CortexBot)

---

## 마이그레이션 파일

**`supabase/migrations/007_rss_sources.sql`**

```sql
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS custom_rss_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS mylifeos_enabled BOOLEAN NOT NULL DEFAULT false;

UPDATE user_settings
SET
  custom_rss_urls = COALESCE(custom_rss_urls, '[]'::jsonb),
  mylifeos_enabled = COALESCE(mylifeos_enabled, false)
WHERE id = 'singleton';
```
