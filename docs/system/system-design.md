# 시스템 설계서 — Cortex

**버전**: 1.0 | **날짜**: 2026-02-27 | **상태**: 확정
**프로젝트**: Cortex — 개인 AI 브리핑 봇
**사용자**: jsong1230 (1인 전용)

---

## 1. 시스템 개요

### 1.1 아키텍처 패턴

**Next.js 풀스택 모노리스** (App Router 기반)

Cortex는 Next.js 14 App Router 위에 프론트엔드(웹 대시보드)와 백엔드(API Routes + Cron 핸들러)를 단일 프로젝트로 구성하는 풀스택 모노리스 아키텍처를 채택한다. 1인 사용자 전용이므로 마이크로서비스 분리나 별도 백엔드 서버가 불필요하며, Vercel 배포 한 번으로 전체 시스템이 동작한다.

- **배포**: Vercel (단일 프로젝트)
- **스케줄링**: Vercel Cron Jobs (서버리스 함수 트리거)
- **데이터베이스**: Supabase (PostgreSQL + pgvector) — My Life OS와 공유
- **외부 연동**: 텔레그램 Bot API (웹훅), Claude API, 각종 콘텐츠 소스 API/RSS

### 1.2 전체 아키텍처 다이어그램

```
                         +-------------------+
                         |   Vercel Cron     |
                         |  06:30 수집       |
                         |  07:00 발송       |
                         |  매시간 알림 체크  |
                         +--------+----------+
                                  |
                                  v
+------------------------------------------------------------------+
|                      Next.js 14 App Router (Vercel)              |
|                                                                  |
|  +--------------------+    +----------------------------------+  |
|  | app/(web)/         |    | app/api/                         |  |
|  |  page.tsx (브리핑) |    |  cron/collect/route.ts           |  |
|  |  item/[id]/        |    |  cron/send-briefing/route.ts     |  |
|  |  history/          |    |  cron/alerts/check/route.ts      |  |
|  |  profile/          |    |  telegram/webhook/route.ts       |  |
|  |  settings/         |    |  briefings/today/route.ts        |  |
|  |  insights/         |    |  briefings/[date]/route.ts       |  |
|  +--------------------+    |  interactions/route.ts            |  |
|                            |  profile/interests/route.ts      |  |
|  +--------------------+    |  context/sync/route.ts           |  |
|  | lib/               |    |  alerts/settings/route.ts        |  |
|  |  collectors/       |    +----------------------------------+  |
|  |  summarizer.ts     |                                          |
|  |  scoring.ts        |                                          |
|  |  embedding.ts      |                                          |
|  |  telegram.ts       |                                          |
|  |  mylifeos.ts       |                                          |
|  |  alerts.ts         |                                          |
|  +--------------------+                                          |
+------------------------------------------------------------------+
         |              |                    |
         v              v                    v
+-------------+  +--------------+  +------------------+
| Supabase    |  | Claude API   |  | Telegram Bot API |
| PostgreSQL  |  | (anthropic)  |  | (Webhook)        |
| + pgvector  |  | 요약/스코어링  |  | 발송/수신        |
+-------------+  +--------------+  +------------------+
         |
         v
+-------------------+
| My Life OS 테이블  |
| diary_entries     |
| todos / notes     |
+-------------------+
```

### 1.3 데이터 흐름도

```
[1] 수집 (06:30 Cron)
    RSS/API/파싱 → content_items 저장 → 중복 제거 (source_url UNIQUE)

[2] AI 처리 (06:30 Cron 내부)
    content_items → Claude API 요약 생성 → 관심도 스코어링
    → interest_profile 기반 가중치 적용 → pgvector 임베딩 생성

[3] 브리핑 생성 (07:00 Cron)
    채널별 상위 아이템 선정 → briefings 테이블 저장
    → 텔레그램 sendMessage 발송 (인라인 키보드 포함)

[4] 반응 수집
    텔레그램 인라인 버튼 → webhook/route.ts → user_interactions 저장
    웹 대시보드 피드백 → /api/interactions → user_interactions 저장

[5] 학습 (반응 저장 시 트리거)
    user_interactions → interest_profile EMA 업데이트
    → 다음날 브리핑 스코어링에 반영

[6] My Life OS 연동 (07:00 Cron 전 또는 별도 Cron)
    diary_entries, todos, notes → 키워드 추출
    → keyword_contexts 저장 (7일 TTL) → 브리핑 컨텍스트 매칭

[7] 긴급 알림 (매시간 Cron)
    alert_settings 확인 → 트리거 조건 체크 (날씨, 키워드, 속보)
    → 조건 충족 시 텔레그램 즉시 발송 (하루 최대 3회)
```

---

## 2. 기술 스택 상세

### 2.1 프레임워크 및 런타임

| 구성 요소 | 기술 | 버전 | 선택 이유 |
|-----------|------|------|----------|
| 프레임워크 | Next.js (App Router) | 14.x | My Life OS와 동일 스택, SSR/API Routes 통합 |
| 언어 | TypeScript | 5.x | strict 모드, 타입 안전성 |
| 스타일링 | Tailwind CSS | 3.x | 유틸리티 퍼스트, 빠른 UI 개발 |
| 패키지 매니저 | npm | - | Vercel 기본 지원 |

### 2.2 데이터베이스

| 구성 요소 | 기술 | 비고 |
|-----------|------|------|
| 주 DB | Supabase (PostgreSQL) | My Life OS와 동일 인스턴스 공유 |
| 벡터 검색 | pgvector | 콘텐츠/관심사 임베딩 유사도 검색 |
| 인증 | Supabase Auth | 텔레그램 로그인 위젯 연동 |
| Realtime | 사용하지 않음 | 1인 사용자, 폴링으로 충분 |

### 2.3 외부 서비스

| 서비스 | SDK/라이브러리 | 용도 |
|--------|--------------|------|
| Claude API | `@anthropic-ai/sdk` | 콘텐츠 요약, 관심도 스코어링, 월간 인사이트 |
| Telegram Bot API | `node-telegram-bot-api` 또는 직접 HTTP | 브리핑 발송, 명령어 수신 |
| OpenWeatherMap API | HTTP fetch | 토론토 날씨 수집 |
| YouTube Data API v3 | HTTP fetch | 유튜브 트렌딩 KR |
| 네이버 데이터랩 API | HTTP fetch | 한국 검색/쇼핑 트렌드 |
| HN Firebase API | HTTP fetch | Hacker News Top Stories |

### 2.4 인프라

| 구성 요소 | 기술 | 비고 |
|-----------|------|------|
| 호스팅/배포 | Vercel | Next.js 최적 배포, 무료 플랜 |
| 스케줄러 | Vercel Cron Jobs | 서버리스 함수 트리거, cron 표현식 |
| 모니터링 | Vercel Analytics + 자체 로깅 | 기본 제공 메트릭 활용 |
| 도메인 | Vercel 기본 도메인 또는 커스텀 | 1인 사용이므로 기본 도메인 가능 |

---

## 3. 디렉토리 구조

```
cortex/
├── .claude/                          # Claude Code 설정
│   ├── agents/                       # 커스텀 에이전트
│   ├── skills/                       # 스킬 (task + reference)
│   └── settings.json
├── .worktrees/                       # Agent Team 병렬 작업 (자동 생성, .gitignore)
├── app/                              # Next.js 14 App Router
│   ├── api/                          # API Routes (백엔드)
│   │   ├── cron/
│   │   │   ├── collect/route.ts      # [Cron 06:30] 콘텐츠 수집 파이프라인
│   │   │   ├── send-briefing/route.ts # [Cron 07:00] 텔레그램 브리핑 발송
│   │   │   └── alerts/
│   │   │       └── check/route.ts    # [Cron 매시간] 긴급 알림 트리거 체크
│   │   ├── telegram/
│   │   │   └── webhook/route.ts      # 텔레그램 봇 메시지/버튼 수신
│   │   ├── briefings/
│   │   │   ├── today/route.ts        # GET: 오늘 브리핑 조회
│   │   │   └── [date]/route.ts       # GET: 특정 날짜 브리핑
│   │   ├── interactions/route.ts     # POST: 반응 로그 저장
│   │   ├── profile/
│   │   │   └── interests/route.ts    # GET: 관심사 프로필 조회
│   │   ├── context/
│   │   │   └── sync/route.ts         # POST: My Life OS 컨텍스트 동기화
│   │   └── alerts/
│   │       └── settings/route.ts     # PUT: 알림 트리거 ON/OFF 설정
│   ├── (web)/                        # 웹 대시보드 (라우트 그룹)
│   │   ├── page.tsx                  # / — 오늘의 브리핑
│   │   ├── item/
│   │   │   └── [id]/page.tsx         # /item/[id] — 아이템 상세 + 메모
│   │   ├── history/page.tsx          # /history — 브리핑 히스토리
│   │   ├── profile/page.tsx          # /profile — 관심사 프로필
│   │   ├── settings/page.tsx         # /settings — 채널/알림 설정
│   │   └── insights/page.tsx         # /insights — 월간 인사이트 (Phase 4)
│   └── layout.tsx                    # 루트 레이아웃
├── lib/                              # 비즈니스 로직 모듈
│   ├── collectors/                   # 콘텐츠 수집기 (소스별 독립 모듈)
│   │   ├── hackernews.ts             # HN Firebase REST API
│   │   ├── github.ts                 # GitHub Trending 페이지 파싱
│   │   ├── rss.ts                    # 범용 RSS 파서 (사용자 정의 피드 포함)
│   │   ├── naver.ts                  # 네이버 뉴스 RSS + 데이터랩 API + 실검 파싱
│   │   ├── daum.ts                   # 다음 뉴스 RSS + 이슈 트렌드 파싱
│   │   ├── yonhap.ts                # 연합뉴스 RSS
│   │   ├── youtube.ts                # YouTube Data API v3 (트렌딩 KR)
│   │   ├── melon.ts                  # 멜론 실시간 차트 파싱
│   │   ├── netflix.ts                # 넷플릭스 한국 TOP 10 파싱
│   │   ├── toronto-news.ts           # CBC, Toronto Star, Globe and Mail RSS
│   │   └── weather.ts                # OpenWeatherMap API (토론토)
│   ├── summarizer.ts                 # Claude API 요약 + 스코어링 (모든 AI 호출 집중)
│   ├── scoring.ts                    # 관심도 점수 EMA 업데이트 로직
│   ├── embedding.ts                  # pgvector 임베딩 생성/유사도 검색
│   ├── telegram.ts                   # 텔레그램 봇 유틸리티 (발송, 인라인 키보드)
│   ├── mylifeos.ts                   # My Life OS DB 연동 (격리된 쿼리 모듈)
│   ├── alerts.ts                     # 긴급 알림 트리거 로직
│   ├── supabase/
│   │   ├── client.ts                 # Supabase 클라이언트 (브라우저용)
│   │   └── server.ts                 # Supabase 서버 클라이언트 (API Routes용)
│   └── utils/
│       ├── date.ts                   # 날짜/시간 유틸리티 (KST 변환 등)
│       └── format.ts                 # 브리핑 텍스트 포매팅
├── components/                       # React 컴포넌트
│   ├── briefing/
│   │   ├── briefing-card.tsx         # 브리핑 아이템 카드
│   │   ├── channel-badge.tsx         # 채널 뱃지 (TECH/WORLD/CULTURE/TORONTO)
│   │   └── feedback-buttons.tsx      # 피드백 버튼 행 (좋아요/싫어요/저장/메모)
│   ├── profile/
│   │   └── interest-chart.tsx        # 관심사 스코어 시각화
│   └── layout/
│       ├── header.tsx
│       └── nav.tsx
├── supabase/
│   └── migrations/
│       ├── 001_cortex_tables.sql     # 핵심 테이블 (content_items, briefings 등)
│       └── 002_alert_settings.sql    # 긴급 알림 설정 테이블
├── public/                           # 정적 파일
├── docs/                             # 프로젝트 문서 (doc-rules 준수)
│   ├── project/                      # 1단계: 프로젝트 기획
│   ├── system/                       # 2단계: 시스템 설계
│   ├── specs/{기능명}/               # 3단계: 기능별 사전 문서
│   ├── api/                          # 4단계: API 사후 문서
│   ├── db/                           # 4단계: DB 사후 문서
│   ├── components/                   # 4단계: 컴포넌트 문서 (선택)
│   ├── tests/{기능명}/               # 테스트 결과
│   └── infra/                        # 인프라 문서
├── .env.local                        # 환경 변수 (git 제외)
├── CLAUDE.md                         # Claude Code 프로젝트 지침
├── CHANGELOG.md                      # 변경 이력
├── vercel.json                       # Vercel Cron 설정
├── next.config.mjs                   # Next.js 설정
├── tailwind.config.ts                # Tailwind 설정
├── tsconfig.json                     # TypeScript 설정
└── package.json
```

### 3.1 모듈별 역할과 의존성

| 모듈 | 역할 | 의존 대상 |
|------|------|----------|
| `app/api/cron/collect/` | 수집 파이프라인 오케스트레이션 | `lib/collectors/*`, `lib/summarizer`, `lib/embedding` |
| `app/api/cron/send-briefing/` | 브리핑 생성 + 텔레그램 발송 | `lib/scoring`, `lib/telegram`, `lib/mylifeos` |
| `app/api/cron/alerts/check/` | 긴급 알림 조건 체크 + 발송 | `lib/alerts`, `lib/telegram`, `lib/collectors/weather` |
| `app/api/telegram/webhook/` | 텔레그램 명령어/버튼 처리 | `lib/telegram`, `lib/scoring` |
| `app/api/briefings/` | 웹 대시보드용 브리핑 데이터 제공 | `lib/supabase/server` |
| `app/api/interactions/` | 반응 저장 + 학습 트리거 | `lib/scoring`, `lib/supabase/server` |
| `lib/collectors/*` | 각 소스별 콘텐츠 수집 (독립) | 외부 API/RSS만 의존, 상호 의존 없음 |
| `lib/summarizer` | Claude API 호출 집중 모듈 | `@anthropic-ai/sdk` |
| `lib/scoring` | EMA 기반 관심도 점수 업데이트 | `lib/supabase/server` |
| `lib/embedding` | pgvector 임베딩 생성/검색 | `lib/supabase/server`, Claude API (임베딩) |
| `lib/telegram` | 텔레그램 봇 발송/수신 유틸리티 | `TELEGRAM_BOT_TOKEN` 환경 변수 |
| `lib/mylifeos` | My Life OS 테이블 읽기 (격리) | `lib/supabase/server` (동일 인스턴스) |
| `lib/alerts` | 긴급 알림 트리거 조건 판정 | `lib/supabase/server`, `lib/collectors/weather` |

---

## 4. 데이터베이스 설계

### 4.1 Cortex 전용 테이블

Cortex는 My Life OS와 동일한 Supabase 인스턴스(PostgreSQL)를 공유한다. Cortex 전용 테이블은 `cortex_` 접두사 없이 독립된 이름을 사용하되, My Life OS 테이블과 충돌하지 않는 이름을 사용한다.

#### content_items

수집된 모든 콘텐츠를 저장하는 핵심 테이블.

```sql
CREATE TABLE content_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       TEXT NOT NULL,          -- 'tech' | 'world' | 'culture' | 'canada'
  source        TEXT NOT NULL,          -- 'hackernews' | 'naver_news' | 'melon' 등
  source_url    TEXT NOT NULL UNIQUE,   -- 중복 수집 방지 키
  title         TEXT NOT NULL,
  summary_ai    TEXT,                   -- Claude가 생성한 1~2줄 요약
  full_text     TEXT,
  embedding     VECTOR(1536),           -- pgvector 임베딩
  published_at  TIMESTAMPTZ,
  collected_at  TIMESTAMPTZ DEFAULT NOW(),
  tags          TEXT[],                 -- AI가 추출한 토픽 태그
  score_initial FLOAT DEFAULT 0.5      -- AI 초기 관심도 점수 (0.0~1.0)
);

-- 인덱스
CREATE INDEX idx_content_items_channel ON content_items(channel);
CREATE INDEX idx_content_items_collected_at ON content_items(collected_at DESC);
CREATE INDEX idx_content_items_source_url ON content_items(source_url);
```

#### briefings

매일 발송된 브리핑 기록. 날짜당 1건.

```sql
CREATE TABLE briefings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date     DATE NOT NULL UNIQUE,
  items             JSONB NOT NULL,       -- [{content_id, position, channel, reason}]
  telegram_sent_at  TIMESTAMPTZ,
  telegram_opened   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_briefings_date ON briefings(briefing_date DESC);
```

#### user_interactions

학습 엔진의 핵심 데이터. 모든 반응을 기록한다.

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

-- 인덱스
CREATE INDEX idx_interactions_content ON user_interactions(content_id);
CREATE INDEX idx_interactions_created ON user_interactions(created_at DESC);
CREATE INDEX idx_interactions_type ON user_interactions(interaction);
```

#### interest_profile

학습된 관심사 프로필. 토픽별 EMA 점수와 임베딩을 보유한다.

```sql
CREATE TABLE interest_profile (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL UNIQUE,
  score             FLOAT DEFAULT 0.5,    -- 0.0 ~ 1.0 (EMA 업데이트)
  interaction_count INT DEFAULT 0,
  last_updated      TIMESTAMPTZ DEFAULT NOW(),
  embedding         VECTOR(1536)          -- 토픽 임베딩 (유사도 검색용)
);

-- 인덱스
CREATE INDEX idx_interest_score ON interest_profile(score DESC);
```

#### alert_settings

긴급 알림(Tier 2) 트리거 설정.

```sql
CREATE TABLE alert_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type         TEXT NOT NULL,
  -- 'toronto_weather' | 'keyword_breaking' | 'world_emergency'
  -- | 'culture_trend' | 'mylifeos_match'
  is_enabled           BOOLEAN DEFAULT TRUE,
  quiet_hours_start    TIME DEFAULT '23:00',
  quiet_hours_end      TIME DEFAULT '07:00',
  last_triggered_at    TIMESTAMPTZ,
  daily_count          INT DEFAULT 0,
  daily_count_reset_at DATE DEFAULT CURRENT_DATE
);
```

#### keyword_contexts

My Life OS 일기/메모에서 추출한 키워드 컨텍스트. 7일 TTL.

```sql
CREATE TABLE keyword_contexts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source     TEXT,             -- '일기' | '할일' | '메모'
  source_id  UUID,             -- My Life OS 원본 레코드 ID
  keywords   TEXT[],
  embedding  VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ       -- 7일 TTL (수집 시 설정)
);

-- 인덱스
CREATE INDEX idx_keyword_contexts_expires ON keyword_contexts(expires_at);
```

### 4.2 My Life OS 연동 테이블 (읽기 전용)

Cortex는 아래 My Life OS 테이블을 **읽기 전용**으로 접근한다. 스키마 변경 권한은 My Life OS 프로젝트에 있으며, Cortex는 `lib/mylifeos.ts`에서 모든 연동 쿼리를 격리하여 스키마 변경 시 영향을 최소화한다.

| My Life OS 테이블 | 읽는 데이터 | Cortex 활용 |
|-------------------|-----------|------------|
| `diary_entries` | 최근 7일 일기 텍스트 | 키워드 추출 → keyword_contexts 저장 → 브리핑 가중치 |
| `todos` | 미완료 태스크 제목 | 키워드 추출 → 관련 아티클 서페이싱 |
| `notes` | 메모 제목/본문 | 키워드 추출 → 관련 아티클 서페이싱 |

### 4.3 pgvector 인덱스 전략

벡터 검색은 `content_items.embedding`, `interest_profile.embedding`, `keyword_contexts.embedding` 3곳에서 사용한다.

```sql
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW 인덱스 (근사 최근접 이웃, 빠른 검색)
-- 초기 데이터가 적으므로 (수천 건) IVFFlat보다 HNSW가 적합
CREATE INDEX idx_content_embedding ON content_items
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_interest_embedding ON interest_profile
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_keyword_embedding ON keyword_contexts
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**인덱스 전략 근거:**
- 1인 사용자이므로 데이터 규모가 작다 (6개월 기준 content_items 약 5,000건 예상)
- HNSW는 IVFFlat 대비 빌드 시간이 길지만 검색 정확도와 속도가 우수하다
- `m=16, ef_construction=64`는 소규모 데이터셋에 적합한 설정이다
- 데이터가 10만 건을 넘으면 인덱스 파라미터 재조정 검토

### 4.4 RLS (Row Level Security) 정책

Cortex는 1인 사용자 전용이지만, Supabase를 My Life OS와 공유하므로 RLS를 활성화하여 데이터 격리를 보장한다.

```sql
-- 모든 Cortex 테이블에 RLS 활성화
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_contexts ENABLE ROW LEVEL SECURITY;

-- Service Role Key를 사용하는 서버 측 API는 RLS 우회
-- Anon Key를 사용하는 클라이언트 측은 인증된 사용자만 접근

-- 예시: content_items 읽기 정책 (인증된 사용자만)
CREATE POLICY "authenticated_read" ON content_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- 예시: user_interactions 쓰기 정책 (인증된 사용자만)
CREATE POLICY "authenticated_insert" ON user_interactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

**RLS 전략:**
- **Cron API Routes**: `SUPABASE_SERVICE_ROLE_KEY` 사용 → RLS 우회 (서버 전용, Cron Secret으로 보호)
- **웹 대시보드 API Routes**: `SUPABASE_SERVICE_ROLE_KEY` 사용 + Supabase Auth 세션 검증
- **클라이언트 직접 접근**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` 사용 → RLS 적용

### 4.5 데이터 만료 정책

| 테이블 | 만료 정책 | 구현 방법 |
|--------|----------|----------|
| `content_items` | 90일 이상 아이템 아카이브 | Cron 주 1회 실행, `archived_at` 컬럼 추가 |
| `keyword_contexts` | 7일 TTL | `expires_at` 기준, Cron으로 주기 삭제 |
| `user_interactions` | 만료 없음 (학습 데이터) | 영구 보관 |
| `interest_profile` | score 0.2 이하 3개월 후 자동 보관 | Cron 월 1회 체크 |

---

## 5. API 설계

### 5.1 API 공통 규칙

**응답 형식:**
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**인증 방식:**

| 인증 유형 | 적용 대상 | 검증 방법 |
|-----------|----------|----------|
| Cron Secret | `/api/cron/*` | `Authorization: Bearer {CRON_SECRET}` 헤더 |
| Telegram Webhook Secret | `/api/telegram/webhook` | `X-Telegram-Bot-Api-Secret-Token` 헤더 |
| Supabase Auth | `/api/briefings/*`, `/api/interactions`, `/api/profile/*`, `/api/alerts/settings` | Supabase 세션 쿠키 |
| 내부 전용 | `/api/context/sync` | `CRON_SECRET` (Cron에서만 호출) |

### 5.2 Cron 엔드포인트

#### POST `/api/cron/collect`
**트리거**: Vercel Cron 매일 06:30 KST
**인증**: Cron Secret
**동작**:
1. 모든 채널의 수집기를 병렬 실행 (채널별 독립 try/catch)
2. 수집된 아이템을 content_items에 저장 (source_url UNIQUE로 중복 방지)
3. Claude API로 각 아이템 요약 생성 (배치 처리, 비용 최적화)
4. pgvector 임베딩 생성
5. interest_profile 기반 초기 스코어 계산

```typescript
// 응답 예시
{
  success: true,
  data: {
    collected: { tech: 15, world: 8, culture: 12, canada: 5 },
    summarized: 35,
    duplicates_skipped: 5,
    errors: []  // 채널별 에러 (실패해도 다른 채널은 계속 진행)
  }
}
```

#### POST `/api/cron/send-briefing`
**트리거**: Vercel Cron 매일 07:00 KST (주말 09:00)
**인증**: Cron Secret
**동작**:
1. My Life OS 컨텍스트 동기화 (keyword_contexts 업데이트)
2. 채널별 상위 아이템 선정 (TECH 2~3, WORLD 1~2, CULTURE 1~2, TORONTO 2~3, 세렌디피티 1)
3. 평일/주말 포맷에 맞게 브리핑 텍스트 생성
4. briefings 테이블에 저장
5. 텔레그램 sendMessage로 발송 (인라인 키보드 포함)

#### POST `/api/cron/alerts/check`
**트리거**: Vercel Cron 매시간 정각
**인증**: Cron Secret
**동작**:
1. alert_settings에서 활성화된 트리거 목록 조회
2. 방해 금지 시간 체크 (기본 23:00~07:00)
3. 하루 발송 횟수 체크 (최대 3회)
4. 각 트리거 조건 확인 (날씨 경보, 키워드 속보, My Life OS 매칭 등)
5. 조건 충족 시 텔레그램 즉시 발송

### 5.3 텔레그램 웹훅

#### POST `/api/telegram/webhook`
**트리거**: 텔레그램 서버에서 Push
**인증**: `X-Telegram-Bot-Api-Secret-Token` 헤더
**수신 이벤트**:

| 이벤트 유형 | 처리 로직 |
|------------|----------|
| 인라인 버튼 콜백 (callback_query) | content_id + 반응 타입 파싱 → user_interactions 저장 → scoring 업데이트 |
| `/good` 명령어 | 마지막 브리핑 전체 긍정 기록 |
| `/bad` 명령어 | 부정 피드백 + 후속 키워드 질문 발송 |
| `/save N` 명령어 | N번째 아이템 저장 처리 |
| `/more` 명령어 | 오늘 브리핑 웹 URL 발송 |
| `/keyword XXX` 명령어 | interest_profile에 토픽 추가 |
| `/stats` 명령어 | 이번 달 관심사 Top 5 + 읽은 아티클 수 발송 |
| `/mute N` 명령어 | N일간 브리핑 중단 플래그 설정 |

**인라인 키보드 콜백 데이터 형식:**
```
{action}:{content_id}
예: like:550e8400-e29b-41d4-a716-446655440000
예: dislike:550e8400-e29b-41d4-a716-446655440000
예: save:550e8400-e29b-41d4-a716-446655440000
```

### 5.4 웹 대시보드 API

#### GET `/api/briefings/today`
오늘 브리핑 데이터를 반환한다. 브리핑이 없으면 404.

```typescript
// 응답
{
  success: true,
  data: {
    briefing_date: "2026-02-27",
    items: [
      {
        content_id: "uuid",
        position: 1,
        channel: "tech",
        title: "...",
        summary_ai: "...",
        source: "hackernews",
        source_url: "https://...",
        reason: null,  // 또는 "지난주 MSA 메모 관련"
        user_interaction: null  // 또는 "좋아요"
      }
    ]
  }
}
```

#### GET `/api/briefings/[date]`
특정 날짜의 브리핑을 반환한다. 형식: `YYYY-MM-DD`.

#### POST `/api/interactions`
웹 대시보드에서의 반응을 저장한다.

```typescript
// 요청 본문
{
  content_id: "uuid",
  briefing_id: "uuid",
  interaction: "좋아요" | "싫어요" | "저장" | "메모" | "웹열기" | "링크클릭",
  memo_text?: "메모 내용",
  source: "web"
}
```

#### GET `/api/profile/interests`
현재 관심사 프로필을 반환한다.

```typescript
// 응답
{
  success: true,
  data: {
    topics: [
      { topic: "LLM", score: 0.85, interaction_count: 42 },
      { topic: "Kubernetes", score: 0.72, interaction_count: 28 }
    ]
  }
}
```

#### PUT `/api/alerts/settings`
긴급 알림 트리거 ON/OFF를 설정한다.

```typescript
// 요청 본문
{
  trigger_type: "toronto_weather",
  is_enabled: true,
  quiet_hours_start: "23:00",
  quiet_hours_end: "07:00"
}
```

---

## 6. 외부 서비스 연동

### 6.1 콘텐츠 수집 소스별 전략

| 소스 | 수집 방법 | API/파싱 상세 | 호출 빈도 | 비고 |
|------|----------|-------------|----------|------|
| Hacker News | Firebase REST API | `https://hacker-news.firebaseio.com/v0/topstories.json` → 개별 아이템 fetch | 1일 1회 (06:30) | Top 50개 가져와 10개 선정 |
| GitHub Trending | HTML 파싱 | `https://github.com/trending` 페이지 파싱 | 1일 1회 | 구조 변경 시 파싱 깨짐 주의 |
| 사용자 정의 RSS | `rss-parser` 라이브러리 | 사용자가 /settings에서 등록한 URL 목록 | 1일 1회 | 피드당 최신 5건 |
| 네이버 뉴스 | RSS | `https://news.naver.com/main/rss/{section}.nhn` (정치/경제/사회/IT) | 1일 1회 | 섹션당 20건 수집 |
| 네이버 데이터랩 | 공식 API | `https://openapi.naver.com/v1/datalab/search` | 1일 1회 | `NAVER_CLIENT_ID/SECRET` 필요 |
| 다음 뉴스 | RSS | `https://news.daum.net/rss` (주요뉴스) | 1일 1회 | 50건 수집 |
| 연합뉴스 | RSS | `https://www.yonhapnewstv.co.kr/browse/feed/` 주요뉴스 | 1일 1회 | 100건 수집 |
| BBC Korea | RSS | `https://feeds.bbci.co.uk/korean/rss.xml` | 1일 1회 | 30건 수집 |
| YouTube 트렌딩 | YouTube Data API v3 | `videos.list` (chart=mostPopular, regionCode=KR) | 1일 1회 | `YOUTUBE_DATA_API_KEY` 필요, 일일 쿼터 주의 |
| 멜론 차트 | HTML 파싱 | `https://www.melon.com/chart/index.htm` | 1일 1회 | User-Agent 필요, UI 변경 리스크 |
| 넷플릭스 TOP 10 | HTML 파싱 | `https://www.netflix.com/tudum/top10` (한국) | 1일 1회 | 파싱 안정성 낮음, 대체 소스 준비 |
| Toronto Star | RSS | `https://www.thestar.com/feeds` | 1일 1회 | 30건 수집 |
| CBC Canada | RSS | `https://www.cbc.ca/cmlink/rss-canada` | 1일 1회 | 30건 수집 |
| 토론토 날씨 | OpenWeatherMap API | `https://api.openweathermap.org/data/2.5/weather?q=Toronto,CA` | 1일 1회 + 긴급 알림 시 | `OPENWEATHER_API_KEY` 필요 |

### 6.2 Claude API 호출 패턴 (비용 최적화)

Claude API는 `lib/summarizer.ts`에서만 호출하여 비용 추적과 최적화를 집중 관리한다.

**호출 유형별 전략:**

| 호출 유형 | 모델 | 입력 크기 | 호출 빈도 | 예상 비용/일 |
|-----------|------|----------|----------|------------|
| 아이템 요약 (1~2줄) | Claude Sonnet (최신) | 아이템 제목+본문 (500~2000 토큰) | 30~50회/일 | ~$0.15 |
| WORLD 채널 선정 (중요도 판단) | Claude Sonnet (최신) | 후보 헤드라인 목록 (1000~2000 토큰) | 1회/일 | ~$0.01 |
| 세렌디피티 아이템 선정 | Claude Sonnet (최신) | 관심사 프로필 + 후보 목록 | 1회/일 | ~$0.01 |
| 월간 인사이트 생성 | Claude Sonnet (최신) | 한 달 반응 데이터 + 일기 키워드 | 1회/월 | ~$0.05 |

**비용 최적화 전략:**
1. **배치 요약**: 아이템을 개별 호출하지 않고 채널별로 묶어서 배치 요약 (5~10개씩)
2. **캐싱**: 동일 source_url 아이템 재요약 방지 (summary_ai가 이미 있으면 스킵)
3. **토큰 절약**: full_text 대신 title + 처음 500자만 요약 입력으로 사용
4. **모델 선택**: 요약은 Sonnet 모델로 충분 (Opus 불필요)
5. **일일 비용 추적**: 호출 횟수와 토큰 사용량을 로깅하여 이상 감지

**예상 월간 비용**: ~$5~15 (일 평균 $0.20~0.50)

### 6.3 텔레그램 Bot API 웹훅 설정

```typescript
// 초기 설정 (1회 실행)
// BotFather에서 봇 생성 후 토큰 발급

// 웹훅 등록
const webhookUrl = `${VERCEL_URL}/api/telegram/webhook`;
await fetch(
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: TELEGRAM_WEBHOOK_SECRET,  // 웹훅 검증용
      allowed_updates: ['message', 'callback_query'],
    }),
  }
);
```

**텔레그램 봇 메시지 발송 패턴:**
```typescript
// 브리핑 발송 (인라인 키보드 포함)
await fetch(
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: briefingText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👍', callback_data: `like:${contentId}` },
            { text: '👎', callback_data: `dislike:${contentId}` },
            { text: '🔖', callback_data: `save:${contentId}` },
          ],
          [
            { text: '👉 자세히 보기', url: `${WEB_URL}/item/${contentId}` },
          ],
        ],
      },
    }),
  }
);
```

### 6.4 날씨 API (OpenWeatherMap)

```typescript
// 토론토 현재 날씨 + 예보
// Current Weather: /data/2.5/weather?q=Toronto,CA&units=metric&lang=kr
// 5 Day Forecast:  /data/2.5/forecast?q=Toronto,CA&units=metric&lang=kr

// 긴급 알림 트리거 조건
// - 폭설: 강설량 15cm 이상
// - 한파: 기온 -20도 이하
// - 폭풍: weather alert 존재
```

### 6.5 YouTube Data API v3

```typescript
// 한국 트렌딩 영상 조회
// GET https://www.googleapis.com/youtube/v3/videos
//   ?part=snippet,statistics
//   &chart=mostPopular
//   &regionCode=KR
//   &maxResults=10
//   &key={YOUTUBE_DATA_API_KEY}

// 일일 쿼터: 10,000 units (videos.list = 1 unit/call)
// 1일 1회 호출이므로 쿼터 문제 없음
```

---

## 7. 인프라 및 배포

### 7.1 Vercel 배포 전략

Cortex는 단일 Next.js 프로젝트로 Vercel에 배포한다.

| 항목 | 설정 |
|------|------|
| 프레임워크 프리셋 | Next.js |
| 빌드 커맨드 | `next build` |
| Node.js 버전 | 20.x |
| 리전 | `icn1` (서울) — 한국 사용자 최적화 |
| 함수 타임아웃 | 기본 60초 (Hobby), Cron 수집은 최대 시간 활용 |

**Vercel 무료 플랜 제약:**
- Serverless Function 실행 시간: 최대 60초 (Hobby) / 300초 (Pro)
- Cron Jobs: 최대 2개 (Hobby) / 무제한 (Pro)
- 대역폭: 100GB/월

**제약 대응:**
- 수집 파이프라인이 60초를 초과할 경우, 채널별로 분리하여 개별 Cron으로 실행
- Pro 플랜 전환 시 300초로 여유 확보
- 또는 수집을 2단계로 분리: (1) 06:25 채널별 수집, (2) 06:30 요약/스코어링

### 7.2 Vercel Cron Jobs 설정

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/collect",
      "schedule": "30 21 * * *"
    },
    {
      "path": "/api/cron/send-briefing",
      "schedule": "0 22 * * *"
    },
    {
      "path": "/api/cron/alerts/check",
      "schedule": "0 * * * *"
    }
  ]
}
```

> **참고**: Vercel Cron은 UTC 기준이다. KST 06:30 = UTC 21:30, KST 07:00 = UTC 22:00.
> 주말 브리핑 시간 변경(09:00)은 send-briefing route 내부에서 요일 체크 후 처리한다.
> Vercel Hobby 플랜은 Cron 2개까지 지원하므로, `collect`와 `send-briefing`을 하나로 합치거나 Pro 플랜 전환을 검토한다. alerts/check는 Phase 2에서 추가 시 Pro 플랜이 필요할 수 있다.

### 7.3 환경 변수 관리

**Vercel 환경 변수 설정 위치**: Vercel Dashboard > Project Settings > Environment Variables

| 환경 변수 | 용도 | 환경 |
|-----------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 (RLS 적용) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 (RLS 우회) | Production만 |
| `ANTHROPIC_API_KEY` | Claude API 키 | Production만 |
| `TELEGRAM_BOT_TOKEN` | 텔레그램 봇 토큰 | Production만 |
| `TELEGRAM_CHAT_ID` | jsong1230 텔레그램 채팅 ID | Production만 |
| `TELEGRAM_WEBHOOK_SECRET` | 웹훅 검증 시크릿 | Production만 |
| `CRON_SECRET` | Cron 엔드포인트 인증 키 | Production만 |
| `OPENWEATHER_API_KEY` | 날씨 API 키 | Production만 |
| `YOUTUBE_DATA_API_KEY` | YouTube API 키 | Production만 |
| `NAVER_CLIENT_ID` | 네이버 API 클라이언트 ID | Production만 |
| `NAVER_CLIENT_SECRET` | 네이버 API 시크릿 | Production만 |
| `MYLIFEOS_INTEGRATION_ENABLED` | My Life OS 연동 활성화 여부 | Production, Development |

### 7.4 모니터링 및 로깅

| 항목 | 도구 | 비고 |
|------|------|------|
| 함수 실행 로그 | Vercel Logs | 기본 제공, 실시간 로그 확인 |
| 함수 성능 | Vercel Analytics | 응답 시간, 에러율 |
| 수집 결과 추적 | 자체 로깅 (console.log) | Cron 실행 결과를 구조화된 JSON으로 출력 |
| Claude API 비용 | 자체 로깅 | 호출 횟수, 토큰 수를 console.log로 기록 |
| 브리핑 발송 확인 | briefings 테이블 | telegram_sent_at 값으로 발송 성공 확인 |
| 에러 알림 | 텔레그램 봇 자체 | Cron 실패 시 자신에게 에러 메시지 발송 |

**에러 처리 원칙:**
- 개별 채널 수집 실패가 전체 파이프라인을 중단시키지 않는다 (채널별 try/catch)
- Cron 실패 시 텔레그램으로 에러 알림을 자신에게 발송한다
- Claude API 호출 실패 시 해당 아이템의 summary_ai를 null로 두고 제목만으로 브리핑에 포함한다

---

## 8. 보안 고려사항

### 8.1 인증 및 인가 전략

Cortex는 1인 사용자(jsong1230) 전용이지만, 공개 인터넷에 배포되므로 인증이 필수다.

| 접근 경로 | 인증 방식 | 상세 |
|-----------|----------|------|
| 웹 대시보드 | Supabase Auth | 텔레그램 로그인 위젯 또는 이메일/비밀번호 |
| Cron 엔드포인트 | Bearer Token | `Authorization: Bearer {CRON_SECRET}` |
| 텔레그램 웹훅 | Secret Token | `X-Telegram-Bot-Api-Secret-Token: {TELEGRAM_WEBHOOK_SECRET}` |
| My Life OS 연동 | 내부 전용 | 동일 Supabase 인스턴스, Service Role Key |

**Cron 인증 구현:**
```typescript
// app/api/cron/collect/route.ts
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // ... 수집 로직
}
```

**텔레그램 웹훅 인증 구현:**
```typescript
// app/api/telegram/webhook/route.ts
export async function POST(request: Request) {
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
  if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // ... 메시지 처리 로직
}
```

### 8.2 환경 변수 보안

- 모든 시크릿은 Vercel Environment Variables에 저장 (코드에 하드코딩 금지)
- `NEXT_PUBLIC_` 접두사가 붙은 변수만 클라이언트에 노출
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 측 코드에서만 사용
- `.env.local`은 `.gitignore`에 포함 (이미 설정됨)

### 8.3 CORS 정책

- Next.js API Routes는 기본적으로 동일 출처 정책을 따른다
- 텔레그램 웹훅은 텔레그램 서버에서 POST로 호출하므로 CORS 무관
- 외부에서의 직접 API 호출을 차단하기 위해 추가 CORS 헤더 설정 불필요 (1인 사용)

### 8.4 데이터 프라이버시

- My Life OS 일기 원문은 Cortex에 저장하지 않는다
- `keyword_contexts` 테이블에는 추출된 키워드만 저장 (원문 미포함)
- 키워드 컨텍스트는 7일 TTL로 자동 만료
- Claude API에 일기 원문 전체를 전송하지 않고 키워드 목록만 전송

---

*Cortex System Design v1.0 | 2026-02-27*
