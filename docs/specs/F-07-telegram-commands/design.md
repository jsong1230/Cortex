# F-07 텔레그램 봇 명령어 처리 — 설계서

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**참조**: docs/system/system-design.md, docs/system/api-conventions.md, docs/project/features.md #F-07

---

## 1. 기능 개요

텔레그램 봇에 사용자가 명령어를 입력하면 `/api/telegram/webhook` 엔드포인트에서 수신하여
각 명령어에 맞는 핸들러를 실행하고 텔레그램으로 응답을 발송한다.

### 1.1 인수조건 매핑

| AC | 명령어 | 동작 | 저장 위치 |
|----|--------|------|----------|
| AC1 | `/good` | 마지막 브리핑 전체 긍정 반응 기록 | user_interactions (interaction='좋아요') |
| AC2 | `/bad` | 마지막 브리핑 전체 부정 반응 기록 + 후속 질문 | user_interactions (interaction='싫어요') |
| AC3 | `/save N` | N번째 아이템 저장 | user_interactions (interaction='저장') |
| AC4 | `/more` | 오늘 브리핑 웹 상세 페이지 URL 발송 | 반응 없음 (URL만 발송) |
| AC5 | `/keyword XXX` | 관심 키워드 추가 | interest_profile (UPSERT) |
| AC6 | `/stats` | 이번 달 관심 토픽 Top 5 + 읽은 아티클 수 발송 | 반응 없음 (조회 후 발송) |
| AC7 | `/mute N` | N일간 브리핑 중단 | mute_settings (신규 또는 alert_settings 활용) |
| AC8 | 웹훅 인증 | X-Telegram-Bot-Api-Secret-Token 검증 | - |

---

## 2. 웹훅 아키텍처

```
[텔레그램 서버]
    │  POST /api/telegram/webhook
    │  X-Telegram-Bot-Api-Secret-Token: {TELEGRAM_WEBHOOK_SECRET}
    │  body: TelegramUpdate (message 또는 callback_query)
    ▼
[app/api/telegram/webhook/route.ts]
    │  1. verifyWebhookSecret() → 401 on fail
    │  2. parseUpdate(body) → TelegramUpdate 타입 파싱
    │  3. update.callback_query? → handleCallbackQuery()
    │     update.message? → dispatchCommand()
    ▼
[lib/telegram-commands.ts]
    │  parseCommand(text) → { command, args }
    │  switch(command):
    │    'good'    → handleGood()
    │    'bad'     → handleBad()
    │    'save'    → handleSave(N)
    │    'more'    → handleMore()
    │    'keyword' → handleKeyword(word)
    │    'stats'   → handleStats()
    │    'mute'    → handleMute(N)
    │    default   → handleUnknown() — 도움말 발송
    ▼
[lib/supabase/server.ts]
    │  user_interactions INSERT / SELECT
    │  briefings SELECT
    │  interest_profile UPSERT
    │  alert_settings UPDATE (mute)
    ▼
[lib/telegram.ts]
    │  sendMessage() — 텔레그램 응답 발송
```

---

## 3. Telegram Update 객체 구조

```typescript
// 텔레그램이 웹훅으로 전송하는 Update 타입 (관련 필드만 정의)
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;         // Unix timestamp
  text?: string;        // 명령어 텍스트
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;        // "like:uuid" | "dislike:uuid" | "save:uuid"
}

interface TelegramUser {
  id: number;
  first_name: string;
}

interface TelegramChat {
  id: number;
  type: string;
}
```

---

## 4. parseCommand 설계

### 4.1 입력/출력

```typescript
interface ParsedCommand {
  command: string;   // 'good' | 'bad' | 'save' | 'more' | 'keyword' | 'stats' | 'mute'
  args: string[];    // 추가 인자 배열
}

function parseCommand(text: string): ParsedCommand | null
```

### 4.2 파싱 규칙

| 입력 | 출력 |
|------|------|
| `/good` | `{ command: 'good', args: [] }` |
| `/bad` | `{ command: 'bad', args: [] }` |
| `/save 3` | `{ command: 'save', args: ['3'] }` |
| `/more` | `{ command: 'more', args: [] }` |
| `/keyword LLM` | `{ command: 'keyword', args: ['LLM'] }` |
| `/keyword React Server Components` | `{ command: 'keyword', args: ['React', 'Server', 'Components'] }` |
| `/stats` | `{ command: 'stats', args: [] }` |
| `/mute 3` | `{ command: 'mute', args: ['3'] }` |
| `hello` (명령어 아님) | `null` |
| `/` (슬래시만) | `null` |
| `/GOOD` (대문자) | `{ command: 'good', args: [] }` — 소문자 정규화 |

### 4.3 견고성 처리

- 앞뒤 공백 trim
- 명령어는 소문자로 정규화 (`/GOOD` → `good`)
- 봇 명칭 포함 처리: `/good@CortexBot` → `good` (@ 이후 무시)
- `/` 로 시작하지 않으면 `null` 반환

---

## 5. 핸들러별 상세 설계

### 5.1 handleGood() — AC1

**동작**: 가장 최근 briefings 레코드를 조회하고, 해당 브리핑의 모든 items에 대해 user_interactions에 '좋아요' 반응을 INSERT한다.

```typescript
async function handleGood(): Promise<string>
```

**쿼리 흐름**:
1. `briefings` 테이블에서 최신 브리핑 조회 (`ORDER BY briefing_date DESC LIMIT 1`)
2. 브리핑의 `items` JSONB에서 `content_id` 배열 추출
3. 각 content_id에 대해 `user_interactions` INSERT:
   ```json
   { "content_id": "uuid", "briefing_id": "uuid", "interaction": "좋아요", "source": "telegram_bot" }
   ```
4. 성공 응답: `"브리핑에 좋아요를 남겼습니다! 오늘 브리핑이 마음에 드셨군요 😊"`

**브리핑이 없는 경우**: `"아직 브리핑이 없습니다. 내일 아침을 기다려주세요!"` 반환

### 5.2 handleBad() — AC2

**동작**: 최근 브리핑 전체 싫어요 반응 기록 + 후속 질문 발송

```typescript
async function handleBad(): Promise<string>
```

**쿼리 흐름**: handleGood과 동일하나 interaction='싫어요'로 저장.

**응답**:
```
브리핑에 싫어요를 남겼습니다.
어떤 주제가 별로였나요? /keyword 명령어로 관심 없는 주제를 알려주시면 학습에 반영할게요.
예) /keyword 주식
```

### 5.3 handleSave(n: number) — AC3

**동작**: 오늘 브리핑의 N번째 아이템(1-based)을 찾아 저장 반응 기록

```typescript
async function handleSave(n: number): Promise<string>
```

**쿼리 흐름**:
1. 오늘 날짜 기준 `briefings` 조회
2. `items` JSONB에서 `position === n`인 아이템의 content_id 추출
3. `user_interactions` INSERT: `interaction='저장'`
4. 성공 응답: `"N번째 아이템을 저장했습니다! /history 또는 웹에서 확인할 수 있어요."`

**유효하지 않은 N (0, 음수, 범위 초과)**:
- `"유효하지 않은 번호입니다. /save 1 ~ /save N 형식으로 입력해주세요."`

### 5.4 handleMore() — AC4

**동작**: 오늘 브리핑 웹 상세 페이지 URL 발송

```typescript
async function handleMore(): Promise<string>
```

**응답**:
```
오늘 브리핑 웹 상세 페이지:
{NEXT_PUBLIC_APP_URL}/briefings/{today-date}
```

**환경변수**: `NEXT_PUBLIC_APP_URL` — 배포 URL (없으면 `https://cortex.vercel.app` 기본값)

### 5.5 handleKeyword(word: string) — AC5

**동작**: 관심 키워드를 interest_profile에 추가

```typescript
async function handleKeyword(word: string): Promise<string>
```

**쿼리 흐름**:
1. `interest_profile` 테이블에 UPSERT:
   ```json
   { "topic": "word", "score": 0.7, "interaction_count": 1 }
   ```
   ON CONFLICT(topic): interaction_count + 1
2. 성공 응답: `"'keyword'를 관심 키워드로 추가했습니다! 다음 브리핑부터 반영돼요."`

**빈 키워드**:
- `"키워드를 입력해주세요. 예) /keyword LLM"`

### 5.6 handleStats() — AC6

**동작**: 이번 달 관심 토픽 Top 5 + 읽은 아티클 수 조회 후 포맷된 텍스트 반환

```typescript
async function handleStats(): Promise<string>
```

**쿼리 흐름**:
1. `user_interactions` 에서 이번 달(월 1일 ~ 현재) 기간 필터:
   - 아티클 수: `interaction IN ('좋아요', '저장', '링크클릭')` COUNT
   - `content_id` 기준 상위 content_items 조회 → tags 추출
2. `interest_profile` 에서 score 상위 5개 조회
3. 포맷 응답:
```
📊 이번 달 통계 (2026년 2월)

🔥 관심 토픽 Top 5:
1. LLM (관심도 8.5)
2. Kubernetes (관심도 7.2)
3. MSA (관심도 6.8)
4. 스타트업 (관심도 6.1)
5. 클라우드 (관심도 5.9)

📚 읽은 아티클: 42건
```

### 5.7 handleMute(n: number) — AC7

**동작**: N일간 브리핑 중단 (방학 모드)

```typescript
async function handleMute(n: number): Promise<string>
```

**저장 방식**: `alert_settings` 테이블의 `trigger_type='briefing_send'` 레코드를 활용하거나,
별도 `user_settings` JSONB 컬럼으로 관리한다.

> **구현 결정**: alert_settings 테이블에 `trigger_type='briefing_mute'` 레코드를 UPSERT하고
> `last_triggered_at`을 현재 시각, `daily_count`를 중단 일수 N으로 사용한다.
> `send-briefing` cron에서 이 레코드를 체크하여 발송 여부를 결정한다.
> (F-17 구현 시 별도 테이블로 분리 예정)

**쿼리 흐름**:
1. `alert_settings` UPSERT:
   ```json
   {
     "trigger_type": "briefing_mute",
     "is_enabled": true,
     "last_triggered_at": "now()",
     "daily_count": N
   }
   ```
2. 성공 응답: `"N일간 브리핑을 중단합니다. 다시 받으려면 /mute 0 또는 /unmute를 입력하세요."`

**유효하지 않은 N (0 또는 음수 입력 → 뮤트 해제)**:
- `"브리핑 수신이 재개됩니다!"`

### 5.8 handleUnknown() — 도움말

**동작**: 알 수 없는 명령어 입력 시 도움말 발송

```typescript
function handleUnknown(command: string): string
```

**응답**:
```
알 수 없는 명령어: /unknown

사용 가능한 명령어:
/good — 오늘 브리핑 좋아요
/bad — 오늘 브리핑 싫어요 + 피드백
/save N — N번째 아이템 저장
/more — 오늘 브리핑 웹 URL
/keyword XXX — 관심 키워드 추가
/stats — 이번 달 통계
/mute N — N일간 브리핑 중단
```

---

## 6. callback_query 처리 (인라인 버튼)

인라인 버튼 콜백은 `lib/telegram.ts`의 `parseCallbackData`를 사용하여 처리한다.

```
callback_query.data 형식: "{action}:{content_id}"
예: "like:550e8400-e29b-41d4-a716-446655440000"
예: "dislike:550e8400-..."
예: "save:550e8400-..."
```

**처리 흐름**:
1. `parseCallbackData(data)` → `{ action, contentId }`
2. action 매핑:
   - `like` → `interaction='좋아요'`
   - `dislike` → `interaction='싫어요'`
   - `save` → `interaction='저장'`
3. `user_interactions` INSERT
4. `answerCallbackQuery` 호출 (텔레그램 로딩 스피너 해제)

---

## 7. 웹훅 엔드포인트 설계

### 7.1 인증

```typescript
// X-Telegram-Bot-Api-Secret-Token 헤더 검증
const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

### 7.2 처리 흐름

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. 인증 검증
  // 2. body 파싱 → TelegramUpdate
  // 3. callback_query 처리 → handleCallbackQuery()
  // 4. message.text 처리 → parseCommand() → dispatchCommand()
  // 5. 성공: 200 { success: true }
  // 6. 에러: 500 { success: false, error: "..." }
}
```

### 7.3 응답 형식

텔레그램은 웹훅 응답 자체를 사용자에게 보여주지 않는다. HTTP 200 OK만 반환하면 된다.
실제 메시지는 `sendMessage` API를 통해 별도 발송한다.

---

## 8. 에러 처리

| 상황 | 처리 방식 |
|------|----------|
| 인증 실패 | 401 반환, 처리 중단 |
| Supabase 쿼리 오류 | 사용자에게 "일시적 오류" 텍스트 발송, 200 반환 (텔레그램 재전송 방지) |
| sendMessage 실패 | 에러 로깅, 200 반환 (텔레그램 재전송 방지) |
| 잘못된 인자 (숫자 아닌 N) | 사용자에게 안내 메시지 발송 |
| 브리핑 미존재 | 사용자에게 안내 메시지 발송 |

> **200 반환 원칙**: 웹훅에서 4xx/5xx를 반환하면 텔레그램이 동일 메시지를 재전송한다.
> 비즈니스 로직 실패는 200으로 반환하되, 사용자에게 안내 메시지를 발송한다.

---

## 9. 신규 추가 없음 — DB 스키마 변경 없음

F-07 구현은 기존 테이블(user_interactions, briefings, interest_profile, alert_settings)을 활용하며
새로운 테이블을 추가하지 않는다.

**기존 테이블 활용**:
- `user_interactions`: 명령어 반응 저장 (interaction 컬럼 활용)
- `briefings`: 최신 브리핑 조회, N번째 아이템 조회
- `interest_profile`: 관심 키워드 UPSERT
- `alert_settings`: 뮤트 설정 저장

---

## 10. 모듈 구조

```
lib/
└── telegram-commands.ts      # 신규 파일
    ├── parseCommand()         # 명령어 파싱
    ├── dispatchCommand()      # Update → 핸들러 디스패치
    ├── handleGood()           # AC1
    ├── handleBad()            # AC2
    ├── handleSave()           # AC3
    ├── handleMore()           # AC4
    ├── handleKeyword()        # AC5
    ├── handleStats()          # AC6
    ├── handleMute()           # AC7
    ├── handleCallbackQuery()  # 인라인 버튼 처리
    └── handleUnknown()        # 도움말

app/api/telegram/webhook/
└── route.ts                   # 기존 스텁 → 완전 구현
```

---

*F-07 Design v1.0 | 2026-02-28*
