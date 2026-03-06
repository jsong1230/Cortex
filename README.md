# Cortex — 개인화 AI 브리핑 봇

> 매일 아침 7시, 텔레그램으로 발송되는 AI 큐레이션 브리핑 서비스 — 가족 멀티유저 지원

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20pgvector-green?logo=supabase)](https://supabase.com)
[![Claude API](https://img.shields.io/badge/Claude-claude--sonnet--4-orange)](https://anthropic.com)
[![Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)](https://vercel.com)

---

## 개요

Cortex는 5개 채널(TECH / WORLD / CULTURE / TORONTO / 세렌디피티)에서 콘텐츠를 수집하고, Claude API로 요약·선별하여 매일 아침 텔레그램으로 발송하는 AI 큐레이션 서비스입니다.

사용자의 반응(👍 👎 🔖 💬)을 학습하여 관심사 프로필을 지속적으로 업데이트하고, 브리핑 품질을 점진적으로 개선합니다.

**멀티유저 지원**: 가족 구성원 각자가 `/start`로 등록하면 독립적인 관심사 프로필과 개인화 브리핑을 받을 수 있습니다.

```
[수집기 4채널]  →  [Claude 요약/스코어링]  →  [텔레그램 발송]
      ↓                                              ↓
  Supabase DB                              [사용자 반응 수집]
      ↑                                              ↓
[브리핑 재조정]  ←  [EMA 관심도 학습]  ←  [interest_profile 업데이트]
```

---

## 주요 기능

### 브리핑 5채널

| 채널 | 소스 | 선정 방식 | 일 아이템 수 |
|------|------|----------|------------|
| 🖥️ TECH | Hacker News, GitHub Trending, RSS, arXiv | EMA 개인화 학습 | 2~3개 |
| 🌍 WORLD | 네이버뉴스, 다음뉴스, 연합뉴스, BBC Korea | Claude 중요도 판단 | 1~2개 |
| 🎬 CULTURE | 네이버 실검, 멜론 차트, 넷플릭스 TOP 10, 유튜브 트렌딩 | 트렌드 순위 기반 | 1~2개 |
| 🍁 TORONTO | CBC, Toronto Star, OpenWeatherMap | 중요도 + 날씨 고정 | 2~3개 |
| 🎲 세렌디피티 | 전 채널 | 역가중치 확률 랜덤 | 1개 |

### 텔레그램 봇 명령어

| 명령어 | 기능 |
|--------|------|
| `/start` | 서비스 등록 (멀티유저 — 가족 구성원 각자 실행) |
| `/good` | 현재 아이템 좋아요 (관심도 +) |
| `/bad` | 현재 아이템 싫어요 (관심도 -) |
| `/save` | 저장 목록에 추가 |
| `/more` | 아이템 상세 URL 발송 |
| `/keyword` | 키워드 알림 등록 |
| `/stats` | 이번 주 학습 통계 |
| `/mute` | 특정 채널 음소거 |

### 학습 엔진

- **EMA(지수이동평균)** 기반 관심도 스코어 업데이트
- **pgvector** 임베딩으로 유사 관심사 검색
- **recencyScore** 시간 감쇠 함수 (`exp(-0.05 * 경과시간)`) 적용
- **serendipity** 역가중치 정규화로 관심사 인접 영역 자연스럽게 노출

### 알림 2단계

- **Tier 1**: 정기 브리핑 (평일 07:00 KST / 주말 09:00 KST)
- **Tier 2**: 긴급 알림 (날씨 경보, 관심 키워드 속보, My Life OS 메모 매칭) — 하루 최대 3회

### 웹 대시보드

- 오늘의 브리핑 카드 뷰
- 브리핑 히스토리 (날짜별 아카이브)
- 관심사 프로필 시각화
- 저장 아이템 읽기 루프 (저장 → 읽는 중 → 완독 → 보관)
- 월간 AI 인사이트 리포트

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router), TypeScript |
| 스타일링 | Tailwind CSS |
| 데이터베이스 | Supabase (PostgreSQL + pgvector) |
| AI | Claude API (`claude-sonnet-4`) |
| 봇 | Telegram Bot API |
| 스케줄러 | Vercel Cron Jobs (9개) |
| 배포 | Vercel |
| 테스트 | Vitest (유닛), Playwright (E2E) |

---

## 디렉토리 구조

```
cortex/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   ├── collect/route.ts          # 콘텐츠 수집 파이프라인 (KST 06:30)
│   │   │   ├── send-briefing/route.ts    # 텔레그램 브리핑 발송 (KST 07:00)
│   │   │   ├── alerts/check/route.ts     # 긴급 알림 체크 (1시간마다)
│   │   │   ├── archive-topics/route.ts   # 저관심 토픽 아카이브 (매주 일)
│   │   │   ├── snapshot-scores/route.ts  # 일별 스코어 스냅샷 (KST 23:00)
│   │   │   ├── reading-loop/route.ts     # 미완독 리마인더 (자정)
│   │   │   └── monthly-report/route.ts  # 월간 AI 리포트 (매월 1일)
│   │   ├── telegram/webhook/route.ts     # 텔레그램 봇 웹훅
│   │   ├── briefings/                    # 브리핑 조회 API
│   │   ├── interactions/                 # 사용자 반응 수집 API
│   │   ├── profile/interests/            # 관심사 프로필 API
│   │   ├── insights/                     # 인사이트 집계 API
│   │   ├── usage/route.ts                # Claude API 일별 비용 집계
│   │   └── ...
│   └── (web)/
│       ├── page.tsx                      # 오늘의 브리핑
│       ├── item/[id]/page.tsx            # 아이템 상세
│       ├── history/page.tsx              # 브리핑 히스토리
│       ├── profile/page.tsx              # 관심사 프로필
│       ├── insights/page.tsx             # 월간 인사이트
│       └── settings/page.tsx             # 설정
├── lib/
│   ├── collectors/
│   │   ├── hackernews.ts                 # HN Firebase API
│   │   ├── github.ts                     # GitHub Trending
│   │   ├── rss.ts                        # 범용 RSS 파서
│   │   ├── naver.ts                      # 네이버 뉴스/데이터랩
│   │   ├── youtube.ts                    # 유튜브 트렌딩 KR
│   │   ├── toronto-news.ts               # CBC, Toronto Star
│   │   ├── weather.ts                    # OpenWeatherMap
│   │   └── ...
│   ├── utils/
│   │   ├── date.ts                       # KST 시간 유틸
│   │   ├── env.ts                        # 환경변수 검증
│   │   └── logger.ts                     # 구조화 로거
│   ├── summarizer.ts                     # Claude API 요약 + 스코어링 (핵심)
│   ├── scoring.ts                        # EMA 스코어링 + recencyScore
│   ├── serendipity.ts                    # 세렌디피티 역가중치 선정
│   ├── telegram.ts                       # 텔레그램 봇 유틸
│   ├── telegram-users.ts                 # 멀티유저 관리 (등록/조회)
│   ├── telegram-commands.ts              # 봇 명령어 핸들러
│   ├── mylifeos.ts                       # My Life OS DB 연동
│   ├── alerts.ts                         # 긴급 알림 로직
│   ├── weekly-digest.ts                  # 주말 Weekly Digest
│   └── monthly-report.ts                 # AI 월간 리포트 생성
├── supabase/
│   └── migrations/                       # DB 마이그레이션 (001~014)
├── components/                           # React UI 컴포넌트
├── tests/
│   ├── unit/                             # Vitest 유닛 테스트
│   └── integration/                      # 통합 테스트
└── docs/
    └── project/
        ├── roadmap.md                    # 전체 로드맵
        └── improvement-plan.md           # 개선 계획 (I-01~I-21)
```

---

## 데이터베이스 스키마

Supabase (PostgreSQL + pgvector) 기반. 주요 테이블:

| 테이블 | 설명 |
|--------|------|
| `telegram_users` | 등록된 텔레그램 사용자 (telegram_id ↔ UUID 매핑, 멀티유저 기반) |
| `content_items` | 수집된 콘텐츠 (채널, 제목, URL, AI 요약, 초기 스코어) |
| `briefings` | 매일 발송된 브리핑 기록 (items JSONB, user_id 격리) |
| `user_interactions` | 사용자 반응 로그 (학습 엔진 핵심 데이터, user_id 격리) |
| `interest_profile` | 토픽별 EMA 스코어 + pgvector 임베딩 (user_id 격리) |
| `alert_settings` | 긴급 알림 트리거 설정 |
| `saved_items` | 저장 아이템 읽기 상태 (저장/읽는중/완독/보관) |
| `score_history` | 관심도 스코어 변화 이력 |
| `monthly_reports` | AI 생성 월간 리포트 |
| `api_usage_log` | Claude API 일별 토큰 사용량 |

---

## 로컬 개발 환경 설정

### 사전 요구사항

- Node.js 18+
- Supabase 계정 + 프로젝트
- Telegram Bot Token ([@BotFather](https://t.me/BotFather))
- Anthropic API Key

### 1. 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/jsong1230/Cortex.git
cd Cortex
npm install
```

### 2. 환경변수 설정

`.env.local` 파일 생성:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Claude API
ANTHROPIC_API_KEY=your_anthropic_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Vercel Cron 보안
CRON_SECRET=your_cron_secret

# 사이트 URL (하드코딩 방지)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 외부 API (선택)
OPENWEATHER_API_KEY=         # 토론토 날씨
YOUTUBE_DATA_API_KEY=        # 유튜브 트렌딩
NAVER_CLIENT_ID=             # 네이버 뉴스
NAVER_CLIENT_SECRET=

# My Life OS 연동 (선택)
MYLIFEOS_INTEGRATION_ENABLED=false
```

### 3. Supabase DB 마이그레이션

```bash
# Supabase CLI 설치
brew install supabase/tap/supabase

# 프로젝트 링크
supabase link --project-ref your_project_ref

# 마이그레이션 적용 (001~014 순서대로)
supabase db push
```

### 4. 개발 서버 실행

```bash
npm run dev
# http://localhost:3000 접속
```

### 5. 텔레그램 웹훅 설정

```bash
# ngrok으로 로컬 터널 생성
ngrok http 3000

# 웹훅 등록 (ngrok URL 사용)
curl -X POST "https://api.telegram.org/bot{BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-ngrok-url.ngrok.io/api/telegram/webhook", "secret_token": "your_webhook_secret"}'
```

---

## 실행 명령어

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm test             # 유닛 테스트 (Vitest)
npm run test:ui      # Vitest UI 대시보드
npm run test:coverage # 테스트 커버리지
npm run test:e2e     # E2E 테스트 (Playwright)
npm run lint         # ESLint 검사
```

---

## Vercel 배포

### Cron Jobs (vercel.json)

| 작업 | 스케줄 (UTC) | KST 시각 |
|------|-------------|---------|
| 콘텐츠 수집 | `30 21 * * *` | 매일 06:30 |
| 평일 브리핑 발송 | `0 22 * * 1-5` | 평일 07:00 |
| 주말 브리핑 발송 | `0 0 * * 0,6` | 주말 09:00 |
| 긴급 알림 체크 | `0 2 * * *` | 매일 11:00 (Hobby 플랜 제한) |
| 토픽 아카이브 | `0 3 * * 0` | 매주 일요일 12:00 |
| 컨텍스트 동기화 | `0 21 * * *` | 매일 06:30 |
| 스코어 스냅샷 | `0 14 * * *` | 매일 23:00 |
| 읽기 루프 | `0 15 * * *` | 매일 자정 |
| 월간 리포트 | `0 1 1 * *` | 매월 1일 10:00 |

### 환경변수 설정

Vercel 대시보드 → Settings → Environment Variables에 위의 `.env.local` 항목 모두 등록.

---

## API 비용 모니터링

Claude API 사용량은 자동으로 `api_usage_log` 테이블에 기록됩니다.

```bash
# 최근 7일 일별 비용 조회
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain.vercel.app/api/usage?days=7"
```

응답 예시:

```json
{
  "success": true,
  "data": {
    "period": { "days": 7 },
    "summary": {
      "totalTokens": 420000,
      "totalCostUsd": 0.00378,
      "callCount": 7
    },
    "daily": [
      { "date": "2026-03-05", "totalTokens": 62000, "totalCostUsd": 0.000558, "callCount": 1 }
    ]
  }
}
```

---

## 아키텍처 설계 원칙

1. **채널 독립 에러 격리** — 각 수집기는 독립 `try/catch`, 하나가 실패해도 브리핑 발송 중단 없음
2. **Claude API 집중 관리** — 모든 AI 호출은 `lib/summarizer.ts`에서만 처리 (비용 추적 용이)
3. **원자적 중복 방지** — `user_interactions`에 DB UNIQUE constraint + `ignoreDuplicates: true` UPSERT
4. **Vercel 타임아웃 대응** — 채널별 수집기 60초 제한 (`withTimeout`), 총 300초 제한 이내
5. **구조화 로깅** — `log({ event, level, data, error })` 표준 함수로 Vercel Logs 검색 최적화

---

## 테스트

```bash
# 전체 유닛 테스트 실행
npm test

# 특정 테스트 파일만 실행
npx vitest tests/unit/scoring.test.ts

# E2E 테스트 (브라우저 필요)
npm run test:e2e
```

테스트 커버리지: **1007 테스트 / 95 파일** 통과

주요 테스트 항목:
- `scoring.test.ts` — recencyScore 지수 감쇠, calculateTechScore 부분 정보 처리
- `telegram-commands-dedup.test.ts` — race condition (동시 5개 요청 시나리오)
- `telegram-users.test.ts` — 멀티유저 등록/조회 (getUserByTelegramId, getActiveUsers, upsertTelegramUser)
- `date.test.ts` — KST/UTC 타임존 경계값 (UTC 00:00~09:00 구간)
- `serendipity/inverse-weight.test.ts` — 역가중치 정규화 (0.05~1.0)

---

## 개선 이력

24개 기능 구현 후 안정화 단계에서 21개 개선 항목(I-01~I-21) 완료:

- **보안**: webhook 디버그 정보 제거, 환경변수 시작 시 검증
- **안정성**: race condition 완전 해결 (UPSERT + DB UNIQUE)
- **코드 품질**: recencyScore 실제 계산, serendipity 가중치 정규화
- **성능**: DB 복합 인덱스 6개 추가
- **운영**: 표준 로거, Cron 타임아웃, Claude API 비용 추적
- **멀티유저**: 가족 4명 개인화 브리핑 지원 (telegram_users 테이블, /start 명령어)

자세한 내용: [`docs/project/improvement-plan.md`](docs/project/improvement-plan.md)

---

## 관련 프로젝트

- **[MyLifeOS](https://github.com/jsong1230/MyLifeOS)** — 같은 Supabase DB 공유. 일기/메모/할 일 컨텍스트를 Cortex 브리핑에 연동.

---

## 라이선스

개인 프로젝트 — 비공개 사용 목적
