# F-17 피로도 방지 장치 — DB 스키마 확정본

작성일: 2026-02-28
마이그레이션: `supabase/migrations/006_user_settings.sql`

---

## 신규 테이블: user_settings

1인 서비스 특성상 싱글톤 행(id='singleton')으로 운영한다.

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id               TEXT PRIMARY KEY DEFAULT 'singleton',
  channel_settings JSONB NOT NULL DEFAULT '{"tech":true,"world":true,"culture":true,"canada":true}'::jsonb,
  mute_until       TIMESTAMPTZ DEFAULT NULL,
  item_reduction   INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### 컬럼 설명

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | 항상 'singleton' |
| channel_settings | JSONB | 채널별 ON/OFF `{"tech":bool,"world":bool,"culture":bool,"canada":bool}` |
| mute_until | TIMESTAMPTZ | 뮤트 종료 시각. null = 뮤트 해제. `mute_until > now()` = 뮤트 중 |
| item_reduction | INT | 7일 무반응 시 자동 감소량. 0, 2, 4 중 하나. 최대 4 |
| created_at | TIMESTAMPTZ | 생성 시각 |
| updated_at | TIMESTAMPTZ | 마지막 수정 시각 (트리거 자동 갱신) |

### 제약

```sql
ALTER TABLE user_settings
  ADD CONSTRAINT chk_item_reduction CHECK (item_reduction >= 0 AND item_reduction <= 4);
```

### 트리거

```sql
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();
```

updated_at 자동 갱신.

### 기본 데이터

```sql
INSERT INTO user_settings (id, channel_settings, mute_until, item_reduction)
VALUES ('singleton', '{"tech":true,"world":true,"culture":true,"canada":true}', NULL, 0)
ON CONFLICT (id) DO NOTHING;
```

---

## 기존 테이블 영향

### briefings.items JSONB 변경

F-17 AC4 지원을 위해 `briefings.items` 배열 아이템에 `tags` 필드를 함께 저장한다.

**이전:**
```json
{
  "content_id": "uuid",
  "position": 1,
  "channel": "tech",
  "title": "...",
  "source": "hackernews",
  "source_url": "https://...",
  "summary_ai": "...",
  "score_initial": 0.85
}
```

**이후 (F-17 추가):**
```json
{
  "content_id": "uuid",
  "position": 1,
  "channel": "tech",
  "title": "...",
  "source": "hackernews",
  "source_url": "https://...",
  "summary_ai": "...",
  "score_initial": 0.85,
  "tags": ["AI", "LLM"]
}
```

`tags` 필드는 반복 이슈 감지(AC4)에 사용된다. 기존 데이터에는 없을 수 있으며 (null/undefined), 이 경우 타이틀 기반 매칭으로 폴백한다.

---

## 인덱스

추가 인덱스 없음 (싱글톤 행 특성상 인덱스 불필요).

---

## 데이터 흐름

```
user_settings.channel_settings → send-briefing cron (채널 필터)
user_settings.mute_until       → send-briefing cron (뮤트 체크)
user_interactions              → checkNoReactionStreak() (7일 무반응 여부)
user_settings.item_reduction   → send-briefing cron (아이템 수 감소)
briefings.items                → detectRepeatingIssues() (반복 이슈 감지)
```
