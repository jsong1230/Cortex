# API 스펙 확정본 — F-06 텔레그램 브리핑 발송

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**구현 파일**: `app/api/cron/send-briefing/route.ts`, `lib/telegram.ts`

---

## POST `/api/cron/send-briefing`

### 개요

매일 07:00 KST Vercel Cron이 호출하는 브리핑 발송 엔드포인트.
오늘 요약 완료된 content_items를 채널별 상위 아이템으로 선정하여
텔레그램 HTML 메시지로 발송하고 briefings 테이블에 기록한다.

### 인증

```
Authorization: Bearer {CRON_SECRET}
```

- Cron Secret 불일치 시 401 Unauthorized 반환
- Vercel Cron Jobs가 자동 호출 시 `CRON_SECRET` 환경변수 사용

### 요청

```http
POST /api/cron/send-briefing HTTP/1.1
Authorization: Bearer {CRON_SECRET}
```

- Body 없음

### 응답

#### 성공 (200)

```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-02-28",
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

#### 아이템 없음 (200, 발송 스킵)

```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-02-28",
    "items_count": 0,
    "telegram_sent": false,
    "channels": {}
  }
}
```

#### 인증 실패 (401)

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

#### 텔레그램 발송 실패 (500)

```json
{
  "success": false,
  "error": "텔레그램 발송 실패: ...",
  "errorCode": "TELEGRAM_SEND_FAILED"
}
```

#### DB 조회 실패 (500)

```json
{
  "success": false,
  "error": "DB 조회 실패"
}
```

---

## 텔레그램 메시지 포맷

### HTML 메시지 구조

```
🌅 2026.02.28 금요일 모닝 브리핑

🖥️ TECH
1. <a href="https://...">LLM 인프라 최적화 가이드</a> — LLM 서빙 비용 절감 전략 (★8.5)
2. <a href="https://...">Rust HTTP 서버</a> — Node.js 대비 3배 빠른 벤치마크 (★7.8)

🌍 WORLD
1. <a href="https://...">한국 경제 성장률 상향</a> — 2026년 2.7% 예상 (★7.2)

🎬 CULTURE
1. <a href="https://...">아이유 신곡</a> — 멜론 1위 달성 (★7.8)

🍁 TORONTO
📍 날씨: 맑음 -3°C
1. <a href="https://...">TTC 파업 예고</a> — 다음 주 파업 예고 (★8.8)
2. <a href="https://...">토론토 TTC 개편</a> — 요금 인상 계획 (★8.1)

🎲 세렌디피티
💡 <a href="https://...">Rust HTTP 서버</a> — Node.js 대비 3배 빠른 벤치마크
```

### 인라인 키보드

```json
{
  "inline_keyboard": [
    [
      { "text": "📖 웹에서 보기", "url": "https://cortex.vercel.app/" }
    ]
  ]
}
```

---

## lib/telegram.ts 공개 API

### formatBriefingMessage(items: BriefingItem[]): string

채널별 아이템 배열을 받아 HTML 형식의 브리핑 메시지 문자열을 반환한다.

- CHANNEL_ORDER: `['tech', 'world', 'culture', 'canada', 'serendipity']`
- 빈 채널은 섹션 자체를 생략한다
- 날씨 아이템(source='weather')은 `📍 날씨:` 형식으로 표시
- 세렌디피티는 번호 없이 `💡` 형식으로 표시

### createInlineKeyboard(webUrl: string): InlineButton[][]

브리핑 메시지용 인라인 키보드를 반환한다.

```typescript
// 반환값
[[ { text: '📖 웹에서 보기', url: webUrl } ]]
```

### selectBriefingItems(items: BriefingItem[]): BriefingItem[]

score_initial 기준 채널별 상위 N개를 선정한다.

| 채널 | 최소 | 최대 |
|------|------|------|
| tech | 2 | 3 |
| world | 1 | 2 |
| culture | 1 | 2 |
| canada | 2 | 3 |
| serendipity | 1 | 1 (stub) |

세렌디피티는 F-23 구현 전 전 채널 랜덤 1개 stub 처리.

### sendBriefing(text: string, webUrl: string): Promise<SendBriefingResult>

브리핑 메시지를 발송하며 1회 재시도를 포함한다.

- 1차 성공 → `{ messageId: number }` 반환
- 1차 실패 → 즉시 재시도
- 2차 실패 → `Error` throw

```typescript
interface SendBriefingResult {
  messageId?: number;
}
```

---

## 환경 변수

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | 필수 | 텔레그램 봇 토큰 (BotFather 발급) |
| `TELEGRAM_CHAT_ID` | 필수 | 발송 대상 채팅 ID |
| `CRON_SECRET` | 필수 | Cron 엔드포인트 인증 키 |
| `NEXT_PUBLIC_SITE_URL` | 선택 | 웹 URL (기본값: `https://cortex.vercel.app`) |
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수 | Supabase 서비스 키 (RLS 우회) |

---

## Vercel Cron 설정 (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/send-briefing",
      "schedule": "0 22 * * *"
    }
  ]
}
```

UTC 22:00 = KST 07:00.

---

*F-06 API 스펙 확정본 v1.0 | 2026-02-28*
