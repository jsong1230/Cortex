# Cortex — 개인 AI 브리핑 봇

## 프로젝트 개요
매일 아침 7시, 텔레그램으로 개인화된 브리핑을 발송하는 AI 큐레이션 서비스.
5개 채널(TECH / WORLD / CULTURE / TORONTO / 세렌디피티)로 구성.
My Life OS(jsong1230/MyLifeOS)와 Supabase DB를 공유해 일기/메모 컨텍스트 연동.

## 기술 스택
- **프레임워크**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **데이터베이스**: Supabase (PostgreSQL + pgvector 벡터 검색)
- **인증**: Supabase Auth (텔레그램 로그인 위젯)
- **AI**: Claude API (anthropic SDK) — 요약 + 큐레이션 + 월간 인사이트
- **봇**: 텔레그램 Bot API (node-telegram-bot-api)
- **스케줄러**: Vercel Cron Jobs (매일 06:30 수집, 07:00 발송)
- **콘텐츠 수집**: RSS Parser + HN Firebase API + YouTube Data API + 네이버 데이터랩 API
- **배포**: Vercel

## 환경 변수 (.env.local)
```
# Supabase (My Life OS와 공유)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# 텔레그램
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=

# Vercel Cron 보안
CRON_SECRET=

# 외부 API
OPENWEATHER_API_KEY=         # 토론토 날씨
YOUTUBE_DATA_API_KEY=        # 유튜브 트렌딩 KR
NAVER_CLIENT_ID=             # 네이버 데이터랩
NAVER_CLIENT_SECRET=

# My Life OS 연동
MYLIFEOS_INTEGRATION_ENABLED=true
```

## 핵심 파일 구조
```
cortex/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   ├── collect/route.ts        # 콘텐츠 수집 파이프라인 (06:30)
│   │   │   ├── send-briefing/route.ts  # 텔레그램 브리핑 발송 (07:00)
│   │   │   └── alerts/check/route.ts  # 긴급 알림 트리거 체크 (1시간마다)
│   │   ├── telegram/
│   │   │   └── webhook/route.ts        # 텔레그램 봇 명령어 수신
│   │   ├── briefings/
│   │   │   ├── today/route.ts
│   │   │   └── [date]/route.ts
│   │   ├── interactions/route.ts       # 반응 로그 저장 (학습 핵심)
│   │   ├── profile/interests/route.ts  # 관심사 프로필
│   │   └── context/sync/route.ts       # My Life OS 컨텍스트 동기화
│   ├── (web)/
│   │   ├── page.tsx           # 오늘의 브리핑
│   │   ├── item/[id]/page.tsx # 아이템 상세 + 메모
│   │   ├── history/page.tsx   # 브리핑 히스토리 + 저장 목록
│   │   ├── profile/page.tsx   # 관심사 프로필 시각화
│   │   ├── settings/page.tsx  # 설정 (채널 ON/OFF, 알림 설정)
│   │   └── insights/page.tsx  # 월간 인사이트 (Phase 4)
│   └── layout.tsx
├── lib/
│   ├── collectors/
│   │   ├── hackernews.ts      # HN Firebase API
│   │   ├── github.ts          # GitHub Trending
│   │   ├── rss.ts             # 범용 RSS 파서
│   │   ├── naver.ts           # 네이버 뉴스/데이터랩/실검
│   │   ├── daum.ts            # 다음 뉴스
│   │   ├── yonhap.ts          # 연합뉴스
│   │   ├── youtube.ts         # 유튜브 트렌딩 KR
│   │   ├── melon.ts           # 멜론 차트
│   │   ├── netflix.ts         # 넷플릭스 한국 TOP 10
│   │   ├── toronto-news.ts    # CBC, Toronto Star, Globe and Mail
│   │   └── weather.ts         # OpenWeatherMap (토론토)
│   ├── summarizer.ts          # Claude API 요약 + 스코어링
│   ├── scoring.ts             # 관심도 점수 EMA 업데이트
│   ├── embedding.ts           # pgvector 임베딩 생성/검색
│   ├── telegram.ts            # 텔레그램 봇 유틸리티
│   ├── mylifeos.ts            # My Life OS DB 연동
│   └── alerts.ts              # 긴급 알림 트리거 로직
├── supabase/
│   └── migrations/
│       ├── 001_cortex_tables.sql
│       └── 002_alert_settings.sql
└── CLAUDE.md
```

## 데이터베이스 핵심 테이블
My Life OS와 동일한 Supabase 인스턴스 사용. Cortex 전용 테이블:
- `content_items` — 수집된 콘텐츠 (channel: tech/world/culture/canada)
- `briefings` — 매일 발송된 브리핑 기록
- `user_interactions` — 반응 로그 (학습 엔진 핵심 데이터)
- `interest_profile` — 학습된 관심사 프로필 + pgvector 임베딩
- `keyword_contexts` — My Life OS 일기/메모 키워드 (7일 TTL)
- `alert_settings` — 긴급 알림 트리거 설정

My Life OS에서 읽는 테이블:
- `diary_entries` — 최근 7일 일기 키워드 추출
- `todos` / `notes` — 미완료 태스크/메모 키워드

## 브리핑 5채널 구조
| 채널 | 소스 | 선정 방식 | 일 선정 수 |
|------|------|-----------|-----------|
| 🖥️ TECH | HN, GitHub, RSS, arXiv | 개인화 학습 (EMA) | 2~3개 |
| 🌍 WORLD | 네이버/다음/연합뉴스/BBC Korea | Claude 중요도 판단 | 1~2개 |
| 🎬 CULTURE | 네이버실검, 멜론, 넷플릭스, 유튜브 | 트렌드 순위 기반 | 1~2개 |
| 🍁 TORONTO | CBC, Toronto Star, 날씨API | 중요도 + 날씨 고정 | 2~3개 |
| 🎲 세렌디피티 | 전 채널 | 관심사 인접 랜덤 | 1개 |

## 알림 2단계 구조
- **Tier 1**: 정기 브리핑 (평일 07:00 / 주말 09:00)
- **Tier 2**: 긴급 알림 (토론토 날씨경보, 관심키워드 속보, My Life OS 메모 매칭) — 하루 최대 3회

## 개발 단계별 계획
### Phase 0 — 뼈대 (1주차)
1. `supabase/migrations/001_cortex_tables.sql` 실행
2. `lib/collectors/` — HN, GitHub, RSS, 연합뉴스 수집기 구현
3. `lib/summarizer.ts` — Claude API 요약 로직
4. `app/api/cron/collect/route.ts` — 수집 파이프라인 연결
5. 텔레그램 BotFather에서 봇 생성 → `app/api/cron/send-briefing/route.ts` 구현
- ✅ **완료 기준**: 매일 아침 텔레그램으로 브리핑 수신

### Phase 1 — 피드백 루프 (2주차)
- 웹 브리핑 카드 UI + 인라인 피드백 버튼 (👍 👎 🔖 💬)
- `user_interactions` 테이블 + `/api/interactions` API
- 텔레그램 '더보기' 버튼 → 웹 URL 발송
- Supabase Auth + 텔레그램 로그인 위젯
- ✅ **완료 기준**: 웹에서 반응 남기면 DB에 저장됨

### Phase 2 — 학습 + 개인화 (3~4주차)
- pgvector 임베딩 생성 + `interest_profile` EMA 업데이트
- 반응 기반 스코어링 → 다음날 브리핑 가중치 반영
- 웹 `/profile` 관심사 시각화
- Cron 1시간마다 긴급 알림 트리거 체크
- ✅ **완료 기준**: 1주 사용 후 브리핑 품질 체감 향상

### Phase 3 — My Life OS 연동 (5주차)
- `lib/mylifeos.ts` — diary_entries, todos 키워드 추출
- 컨텍스트 매칭 아이템에 💡 이유 표시
- ✅ **완료 기준**: 일기 키워드가 다음날 브리핑에 반영됨

### Phase 4 — 인사이트 (7~8주차)
- 웹 `/insights` 관심사 지형도
- 월간 AI 생각 정리 리포트
- ✅ **완료 기준**: 나를 나보다 잘 아는 브리핑 체감

## 코딩 규칙
- TypeScript strict 모드 사용
- Supabase 쿼리는 항상 RLS 정책 확인
- Claude API 호출은 `lib/summarizer.ts`에서만 처리 (비용 추적 용이)
- 크롤링보다 공식 API 우선 사용
- 에러 발생 시 브리핑 발송 실패 방지 — 채널별 독립 try/catch
