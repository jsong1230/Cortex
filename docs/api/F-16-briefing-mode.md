# F-16 평일/주말 브리핑 분리 — API 스펙 확정본

## 개요
- 기능: 평일(월~금) / 주말(토~일) 브리핑 포맷 분기
- 관련 Cron: `POST /api/cron/send-briefing`
- 구현 날짜: 2026-02-28

---

## Cron 스케줄 (vercel.json)

| 경로 | 스케줄 (cron) | 설명 |
|------|--------------|------|
| `/api/cron/send-briefing` | `0 22 * * 1-5` | 평일(월~금) KST 07:00 |
| `/api/cron/send-briefing` | `0 0 * * 0,6` | 주말(토~일) KST 09:00 |

---

## POST /api/cron/send-briefing

### 인증
```
Authorization: Bearer {CRON_SECRET}
```

### 동작 로직 (F-16 분기)

```
1. KST 기준 평일/주말 감지 (isWeekend())
2. 모드별 아이템 선정 (selectBriefingItems(items, mode))
3. 모드별 포매팅
   - 평일: formatWeekdayBriefing() — 제목+1줄 요약+스코어
   - 주말: formatWeekendBriefing() — 제목+3줄 요약+"왜 중요한가"
4. 토요일: Weekly Digest 섹션 추가 (formatWeeklyDigest())
5. sendBriefing() 발송
```

### 응답 (성공)
```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-03-07",
    "items_count": 6,
    "telegram_sent": true,
    "channels": {
      "tech": 2,
      "world": 1,
      "culture": 1,
      "canada": 1,
      "serendipity": 1
    },
    "mode": "weekend",
    "weekly_digest": true
  }
}
```

### 응답 (스킵)
```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-03-07",
    "items_count": 0,
    "telegram_sent": false,
    "channels": {},
    "mode": "weekend"
  }
}
```

### 응답 (오류)
```json
{
  "success": false,
  "error": "텔레그램 발송 실패: ...",
  "errorCode": "TELEGRAM_SEND_FAILED"
}
```

---

## 채널별 아이템 선정 수 (BriefingMode)

| 채널 | 평일 (weekday) | 주말 (weekend) |
|------|----------------|----------------|
| tech | 최대 3개 | 최대 2개 |
| world | 최대 2개 | 최대 1개 |
| culture | 최대 1개 | 최대 1개 |
| canada | 최대 2개 | 최대 1개 |
| serendipity | 1개 (랜덤) | 1개 (랜덤) |
| **합계** | **8+1개** | **5+1개** |

---

## 텔레그램 메시지 포맷

### 평일 포맷 (formatWeekdayBriefing)
```
🌅 2026.03.02 월요일 모닝 브리핑

🖥️ TECH
1. <a href="URL">제목</a> — 1줄 요약 (★8.5)
2. <a href="URL">제목</a> — 1줄 요약 (★7.2)

🌍 WORLD
1. <a href="URL">제목</a> — 1줄 요약 (★8.8)

🎬 CULTURE
1. <a href="URL">제목</a> — 1줄 요약 (★7.8)

🍁 TORONTO
📍 날씨: 맑음 -3°C
1. <a href="URL">제목</a> — 1줄 요약 (★8.1)

🎲 세렌디피티
💡 <a href="URL">제목</a> — 1줄 요약
```

### 주말 포맷 (formatWeekendBriefing)
```
🌅 2026.03.07 토요일 모닝 브리핑

🖥️ TECH
1. <a href="URL">제목</a>
1줄: ...
2줄: ...
3줄: ...
❓ <b>왜 중요한가</b>: ...

🌍 WORLD
1. <a href="URL">제목</a>
1줄: ...
2줄: ...
3줄: ...
❓ <b>왜 중요한가</b>: ...

[... 기타 채널 ...]

📋 <b>Weekly Digest</b>  ← 토요일만

👍 <b>이번 주 좋아요 Top 3</b>
1. <a href="URL">제목</a>
2. <a href="URL">제목</a>
3. <a href="URL">제목</a>

🔖 <b>미완독 리마인더</b>
• <a href="URL">제목</a> (저장일: 2026-02-24)

🍁 이번 주 토론토: 월~수 눈, 목~금 맑음

💬 이번 주는 LLM 인프라와 클라우드 비용에 관심이 집중됐네요.
```

---

## 신규 export (lib/telegram.ts)

| 함수/타입 | 설명 |
|-----------|------|
| `BriefingMode` | `'weekday' \| 'weekend'` 타입 |
| `isWeekend(date?)` | KST 기준 주말 여부 판단 |
| `selectBriefingItems(items, mode?)` | 모드별 아이템 선정 (기본값: 'weekday') |
| `formatWeekdayBriefing(items)` | 평일 브리핑 HTML 생성 |
| `formatWeekendBriefing(items)` | 주말 브리핑 HTML 생성 |
| `BriefingItem.extended_summary?` | 주말 3줄 요약 (선택 필드) |
| `BriefingItem.why_important?` | 주말 "왜 중요한가" (선택 필드) |

## 신규 export (lib/weekly-digest.ts)

| 함수/타입 | 설명 |
|-----------|------|
| `WeeklyDigestData` | Weekly Digest 데이터 인터페이스 |
| `LikedItem` | 좋아요 아이템 인터페이스 |
| `UnreadReminder` | 미완독 리마인더 인터페이스 |
| `formatWeeklyDigest(data)` | Weekly Digest HTML 섹션 생성 |
| `generateWeeklyDigest(supabase, fn)` | DB 조회 + AI 코멘트 생성 |

## 신규 export (lib/summarizer.ts)

| 함수/타입 | 설명 |
|-----------|------|
| `ExtendedSummaryResult` | 확장 요약 결과 인터페이스 |
| `generateExtendedSummary(item)` | 주말 3줄 요약 + "왜 중요한가" 생성 |
| `generateWeeklyComment(topics)` | Weekly Digest AI 한줄 코멘트 생성 |
