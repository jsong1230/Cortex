# F-06 텔레그램 브리핑 발송 — 설계서

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**참조**: system-design.md §1.3, §4.1, §5.2, §6.3, api-conventions.md §3.1

---

## 1. 개요

매일 07:00 KST Vercel Cron이 `/api/cron/send-briefing`을 호출하면, 당일 요약 완료된
content_items에서 채널별로 상위 아이템을 선정하여 HTML 포맷 메시지를 구성한 뒤
텔레그램 Bot API로 발송하고, briefings 테이블에 기록한다.

---

## 2. 데이터 흐름

```
Vercel Cron (22:00 UTC / 07:00 KST)
  │
  ▼
POST /api/cron/send-briefing
  │  1) CRON_SECRET 인증
  │  2) Supabase에서 오늘 요약 완료 아이템 조회
  │     (summary_ai IS NOT NULL, collected_at >= TODAY 00:00 KST)
  │  3) selectBriefingItems(items)
  │     → 채널별 score_initial 기준 상위 N개 선정
  │     → TECH(2~3), WORLD(1~2), CULTURE(1~2), TORONTO(2~3), 세렌디피티(1 stub)
  │  4) formatBriefingMessage(selectedItems)
  │     → HTML 문자열 생성
  │  5) sendBriefing(selectedItems)
  │     → sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup })
  │     → 실패 시 1회 재시도
  │  6) briefings 테이블에 발송 기록 INSERT
  │
  ▼
{ success: true, data: { briefing_date, items_count, telegram_sent, channels } }
```

---

## 3. 브리핑 메시지 포맷 (HTML)

```
🌅 2026.02.28 금요일 모닝 브리핑

🖥️ TECH
1. <a href="URL">제목</a> — 요약 한줄 (★7.5)
2. <a href="URL">제목</a> — 요약 한줄 (★8.2)

🌍 WORLD
1. <a href="URL">제목</a> — 요약 한줄 (★6.1)

🎬 CULTURE
1. <a href="URL">제목</a> — 요약 한줄 (★7.0)

🍁 TORONTO
📍 날씨: 맑음 -3°C
1. <a href="URL">제목</a> — 요약 한줄 (★8.9)

🎲 세렌디피티
💡 <a href="URL">제목</a> — 요약 한줄
```

### 3.1 채널 헤더 이모지 매핑

| 채널 | DB channel 값 | 헤더 |
|------|--------------|------|
| TECH | `tech` | `🖥️ TECH` |
| WORLD | `world` | `🌍 WORLD` |
| CULTURE | `culture` | `🎬 CULTURE` |
| TORONTO | `canada` | `🍁 TORONTO` |
| 세렌디피티 | - (stub) | `🎲 세렌디피티` |

### 3.2 아이템 포맷

- 일반 채널: `{번호}. <a href="{source_url}">{title}</a> — {summary_ai} (★{score*10:.1f})`
- 세렌디피티: `💡 <a href="{source_url}">{title}</a> — {summary_ai}`
- score_initial은 0.0~1.0 범위이므로 ×10 하여 표시 (예: 0.75 → ★7.5)

### 3.3 날씨 아이템 특별 처리

TORONTO 채널에서 source='weather'인 아이템은 목록 번호 없이 `📍 날씨: {summary_ai}` 형식으로 채널 헤더 바로 아래에 표시한다.

---

## 4. 인라인 키보드 설계

Telegram InlineKeyboardMarkup — 각 아이템에 [📖 더보기] 버튼을 제공한다.

```typescript
// 브리핑 전체 메시지에 단일 키보드 (대표 버튼 1개)
// 각 아이템별 키보드는 F-07 구현 시 확장 예정
// F-06 범위: [📖 오늘 브리핑 웹에서 보기] → 웹 URL
reply_markup: {
  inline_keyboard: [
    [{ text: '📖 웹에서 보기', url: `${WEB_URL}/` }]
  ]
}
```

> 주의: Telegram HTML parse_mode에서는 `<a href="URL">text</a>` 형식만 사용 가능하다.
> `<b>`, `<i>`, `<code>` 태그도 허용되지만 F-06 범위에서는 최소화한다.

---

## 5. 채널별 아이템 선정 로직 (selectBriefingItems)

### 5.1 선정 기준

```typescript
const CHANNEL_LIMITS: Record<string, { min: number; max: number }> = {
  tech:    { min: 2, max: 3 },
  world:   { min: 1, max: 2 },
  culture: { min: 1, max: 2 },
  canada:  { min: 2, max: 3 },
};
```

- score_initial 기준 내림차순 정렬
- 각 채널에서 최대 `max`개 선정 (아이템이 부족하면 있는 만큼만)
- 세렌디피티: 전 채널 아이템 중 랜덤 1개 선택 (F-23 구현 전 stub)

### 5.2 DB 조회 조건

```sql
SELECT id, channel, source, source_url, title, summary_ai, score_initial, tags
FROM content_items
WHERE summary_ai IS NOT NULL
  AND collected_at >= {today_kst_00:00}::timestamptz
ORDER BY channel, score_initial DESC
```

KST 기준 오늘 날짜: `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })`

---

## 6. sendBriefing — 재시도 로직

```typescript
async function sendBriefing(text: string, options: SendMessageOptions): Promise<void> {
  try {
    await sendMessage(options);
  } catch (error) {
    // AC6: 1회 재시도
    await sendMessage(options);  // 실패 시 throw (로깅은 route에서)
  }
}
```

- 1차 실패 → 즉시 재시도 (대기 없음, F-06 AC6 "1회 재시도")
- 2차 실패 → 에러를 throw하여 route에서 로깅

---

## 7. briefings 테이블 저장

```typescript
// INSERT 데이터
{
  briefing_date: '2026-02-28',          // DATE (YYYY-MM-DD)
  items: [                               // JSONB
    {
      content_id: 'uuid',
      position: 1,
      channel: 'tech',
      title: '제목',
      source: 'hackernews',
      source_url: 'https://...',
      summary_ai: '요약',
      score_initial: 0.85,
    },
    // ...
  ],
  telegram_sent_at: '2026-02-28T22:00:00Z',  // TIMESTAMPTZ (UTC)
}
```

---

## 8. 에러 처리

| 상황 | 처리 방식 |
|------|----------|
| CRON_SECRET 불일치 | 401 Unauthorized 반환 |
| 오늘 요약 완료 아이템 없음 | 빈 메시지 대신 최소 브리핑 발송 또는 스킵 (에러 없음) |
| 특정 채널 아이템 없음 | 해당 채널 섹션 생략 |
| Telegram API 1차 실패 | 즉시 재시도 1회 |
| Telegram API 2차 실패 | 에러 로깅 + 500 반환 |
| Supabase briefings INSERT 실패 | 에러 로깅 (발송은 이미 완료됐으므로 non-fatal) |

---

## 9. 성능 고려사항

- content_items 조회: `idx_content_items_collected_at` 인덱스 활용
- 채널별 정렬: DB에서 처리 (ORDER BY channel, score_initial DESC)
- 메시지 길이: 텔레그램 단일 메시지 최대 4096자. 아이템이 많으면 요약 생략
- 텔레그램 발송 후 briefings INSERT (발송 성공 → 기록 순서 보장)

---

## 10. 모듈 구조

```
lib/telegram.ts           — 신규 함수 추가
  ├── formatBriefingMessage(items)   → string (HTML)
  ├── createInlineKeyboard(webUrl)   → InlineButton[][]
  ├── selectBriefingItems(items)     → BriefingItem[]
  └── sendBriefing(items, webUrl)    → Promise<{ messageId?: number }>

app/api/cron/send-briefing/route.ts  — 구현
  └── POST: 인증 → 조회 → 선정 → 포맷 → 발송 → 기록
```

---

*F-06 설계서 v1.0 | 2026-02-28*
