# F-06 텔레그램 브리핑 발송 — 테스트 명세

**버전**: 1.0 | **날짜**: 2026-02-28
**참조**: design.md, features.md #F-06

---

## 단위 테스트 (tests/unit/telegram.test.ts)

### U-01: formatBriefingMessage — 5채널 구성 HTML 메시지 생성

| ID | 케이스 | 검증 항목 |
|----|--------|----------|
| U-01-1 | 5채널 모두 아이템이 있는 경우 | 각 채널 헤더(🖥️ TECH, 🌍 WORLD, 🎬 CULTURE, 🍁 TORONTO, 🎲 세렌디피티)가 메시지에 포함됨 |
| U-01-2 | TECH 채널 2개 아이템 | 아이템 번호(1., 2.), source_url 링크, summary_ai, score_initial(★N.N) 포함됨 |
| U-01-3 | 날씨 아이템 (source='weather') | 📍 날씨: 형식으로 표시되고 목록 번호 없음 |
| U-01-4 | TORONTO 채널 날씨 + 뉴스 혼합 | 날씨 먼저, 뉴스는 번호 부여됨 |
| U-01-5 | HTML 형식 검증 | `<a href="...">` 태그 포함, parse_mode HTML에 유효한 형식 |
| U-01-6 | 날짜 헤더 | 🌅 YYYY.MM.DD 요일 모닝 브리핑 형식 |

### U-02: createInlineKeyboard — 인라인 키보드 생성

| ID | 케이스 | 검증 항목 |
|----|--------|----------|
| U-02-1 | 웹 URL 제공 시 | `[{ text: '📖 웹에서 보기', url: webUrl }]` 형식의 2D 배열 반환 |
| U-02-2 | 반환 타입 검증 | `InlineButton[][]` 형식 (텔레그램 InlineKeyboardMarkup 호환) |

### U-03: selectBriefingItems — score 기준 채널별 상위 N개 선정

| ID | 케이스 | 검증 항목 |
|----|--------|----------|
| U-03-1 | TECH 아이템 5개 입력 | score_initial 기준 상위 3개만 반환 |
| U-03-2 | WORLD 아이템 3개 입력 | score_initial 기준 상위 2개만 반환 |
| U-03-3 | CULTURE 아이템 1개 입력 | 최소 min(1)이므로 1개 반환 |
| U-03-4 | TORONTO 아이템 4개 입력 | score_initial 기준 상위 3개만 반환 |
| U-03-5 | 빈 채널 (아이템 없음) | 해당 채널 결과 빈 배열 (에러 없음) |
| U-03-6 | 세렌디피티 stub | 전 채널에서 랜덤 1개 선택됨 (결과 배열 길이 1) |
| U-03-7 | score_initial 내림차순 보장 | 반환된 아이템들이 score_initial 내림차순으로 정렬됨 |

### U-04: sendBriefing — Bot API 호출 + 재시도 로직

| ID | 케이스 | 검증 항목 |
|----|--------|----------|
| U-04-1 | 정상 발송 | fetch 1회 호출, sendMessage Bot API URL 호출됨 |
| U-04-2 | 1차 실패 → 2차 성공 | fetch 2회 호출, 최종 성공 반환 |
| U-04-3 | 1차 실패 → 2차 실패 | fetch 2회 호출 후 에러 throw |
| U-04-4 | parse_mode HTML | 요청 body에 parse_mode: 'HTML' 포함됨 |
| U-04-5 | 인라인 키보드 포함 | 요청 body에 reply_markup.inline_keyboard 포함됨 |
| U-04-6 | 환경변수 미설정 | TELEGRAM_BOT_TOKEN 없으면 에러 throw |

### U-05: 빈 아이템 시 채널 섹션 생략

| ID | 케이스 | 검증 항목 |
|----|--------|----------|
| U-05-1 | CULTURE 아이템 없음 | 메시지에 🎬 CULTURE 섹션 없음 |
| U-05-2 | WORLD 아이템 없음 | 메시지에 🌍 WORLD 섹션 없음 |
| U-05-3 | 모든 채널 아이템 없음 | 헤더만 있는 최소 메시지 반환 |

---

## 통합 테스트 (tests/integration/cron-send-briefing.test.ts)

### I-01: CRON_SECRET 인증

| ID | 케이스 | 검증 항목 |
|----|--------|----------|
| I-01-1 | Authorization 헤더 없음 | 401 Unauthorized 반환 |
| I-01-2 | 잘못된 CRON_SECRET | 401 Unauthorized 반환 |
| I-01-3 | 올바른 CRON_SECRET | 200 성공 처리 진행 |

### I-02: 전체 발송 흐름

| ID | 케이스 | 검증 항목 |
|----|--------|----------|
| I-02-1 | 정상 흐름 | Supabase 조회 → 선정 → 포맷 → sendMessage → briefings INSERT → 200 성공 |
| I-02-2 | 응답 구조 | `{ success: true, data: { briefing_date, items_count, telegram_sent: true, channels } }` |
| I-02-3 | briefings 테이블 저장 | Supabase insert 호출됨, briefing_date와 items JSONB 포함 |
| I-02-4 | Telegram 발송 실패 | sendMessage 2회 호출 후 에러 로깅, 500 반환 |
| I-02-5 | 오늘 아이템 없음 | items_count: 0, telegram_sent: false (빈 브리핑 스킵) |

---

## 모킹 전략

```typescript
// fetch 전역 모킹 (Telegram Bot API)
vi.stubGlobal('fetch', mockFetch);

// Supabase 클라이언트 모킹
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ from: vi.fn()... })
}));

// 환경변수
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.TELEGRAM_CHAT_ID = '123456789';
process.env.CRON_SECRET = 'test-cron-secret';
```

---

*F-06 테스트 명세 v1.0 | 2026-02-28*
