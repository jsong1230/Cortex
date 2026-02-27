# F-07 텔레그램 봇 명령어 처리 — DB 스키마 확정본

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**담당**: backend-dev
**참조**: docs/system/system-design.md §4, docs/specs/F-07-telegram-commands/design.md §9

---

## DB 변경사항

F-07은 기존 테이블을 활용하며 **신규 테이블을 추가하지 않는다.**

---

## 활용 테이블

### user_interactions

텔레그램 명령어 반응 저장에 사용하는 핵심 테이블.

```sql
CREATE TABLE user_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   UUID REFERENCES content_items(id),
  briefing_id  UUID REFERENCES briefings(id),
  interaction  TEXT NOT NULL,   -- '좋아요' | '싫어요' | '저장' | '메모' | '웹열기' | '링크클릭' | '스킵'
  memo_text    TEXT,            -- 메모 반응 시 텍스트
  source       TEXT,            -- 'telegram_bot' | 'web'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**F-07에서 사용하는 interaction 값**:

| 명령어 | interaction 값 | source |
|--------|---------------|--------|
| `/good` | `좋아요` | `telegram_bot` |
| `/bad` | `싫어요` | `telegram_bot` |
| `/save N` | `저장` | `telegram_bot` |
| 인라인 버튼 `like:uuid` | `좋아요` | `telegram_bot` |
| 인라인 버튼 `dislike:uuid` | `싫어요` | `telegram_bot` |
| 인라인 버튼 `save:uuid` | `저장` | `telegram_bot` |

---

### briefings

/good, /bad, /save 명령어에서 최신/오늘 브리핑 조회에 사용.

```sql
CREATE TABLE briefings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date     DATE NOT NULL UNIQUE,
  items             JSONB NOT NULL,       -- [{content_id, position, channel, reason}]
  telegram_sent_at  TIMESTAMPTZ,
  telegram_opened   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**F-07에서 사용하는 items JSONB 구조**:
```json
[
  {
    "content_id": "uuid",
    "position": 1,
    "channel": "tech"
  },
  {
    "content_id": "uuid",
    "position": 2,
    "channel": "world"
  }
]
```

**쿼리 패턴**:
- `/good`, `/bad`: `ORDER BY briefing_date DESC LIMIT 1` — 최신 브리핑
- `/save N`: `WHERE briefing_date = '{today-KST}' LIMIT 1` — 오늘 브리핑

---

### interest_profile

/keyword 명령어에서 관심 키워드 추가에 사용.

```sql
CREATE TABLE interest_profile (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL UNIQUE,
  score             FLOAT DEFAULT 0.5,    -- 0.0 ~ 1.0 (EMA 업데이트)
  interaction_count INT DEFAULT 0,
  last_updated      TIMESTAMPTZ DEFAULT NOW(),
  embedding         VECTOR(1536)          -- 토픽 임베딩 (유사도 검색용)
);
```

**F-07에서 사용하는 쿼리**:
- `/keyword XXX`: UPSERT (ON CONFLICT topic) — score=0.7, interaction_count=1로 초기화
- `/stats`: SELECT topic, score ORDER BY score DESC LIMIT 5

---

### alert_settings

/mute N 명령어에서 방학 모드 설정에 사용.

```sql
CREATE TABLE alert_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type         TEXT NOT NULL,
  is_enabled           BOOLEAN DEFAULT TRUE,
  quiet_hours_start    TIME DEFAULT '23:00',
  quiet_hours_end      TIME DEFAULT '07:00',
  last_triggered_at    TIMESTAMPTZ,
  daily_count          INT DEFAULT 0,
  daily_count_reset_at DATE DEFAULT CURRENT_DATE
);
```

**F-07에서 사용하는 레코드**:

| 필드 | 값 | 설명 |
|------|-----|------|
| `trigger_type` | `briefing_mute` | 방학 모드 전용 레코드 |
| `is_enabled` | `true` / `false` | 뮤트 활성화 여부 |
| `daily_count` | N (일수) | 중단 일수 저장 |
| `last_triggered_at` | now() | 뮤트 설정 시각 |

**쿼리 패턴**: UPSERT ON CONFLICT(trigger_type)

> `daily_count` 컬럼을 중단 일수 저장에 재활용한다. F-17 구현 시 전용 `user_settings` 테이블로 분리 예정.

---

## 마이그레이션 없음

F-07 구현에는 기존 테이블의 컬럼/인덱스/RLS 정책을 그대로 활용하며
추가적인 마이그레이션 파일이 필요하지 않다.

---

*F-07 DB Schema v1.0 | 2026-02-28*
