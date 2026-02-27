# Cortex — 개인 AI 브리핑 봇
## 제품 요구사항 정의서 (PRD)

**버전**: 1.6 | **날짜**: 2026-02-27 | **상태**: 초안  
**작성자**: jsong1230 | **기술 스택**: Next.js + Supabase + 텔레그램 봇 + Claude API

---

## 목차
1. [비전 및 문제 정의](#1-비전-및-문제-정의)
2. [사용자 페르소나](#2-사용자-페르소나)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [기능 명세](#5-기능-명세)
6. [API 설계](#6-api-설계)
7. [개발 단계별 계획](#7-개발-단계별-계획)
8. [환경 설정 및 초기 세팅](#8-환경-설정-및-초기-세팅)
9. [리스크 및 제약사항](#9-리스크-및-제약사항)
10. [미결 사항](#10-미결-사항-개발-착수-전-결정-필요)

---

## 1. 비전 및 문제 정의

### 1.1 핵심 문제

CTO가 하루에 정보를 얻는 방법에는 구조적 비효율이 있다. Hacker News를 직접 들어가서 훑고, 뉴스레터가 inbox를 폭탄처럼 쌓이고, LinkedIn 피드는 노이즈가 80%이며, 트위터/X는 시간 블랙홀이다. 기존 큐레이션 툴(Feedly, Pocket, Readwise)은 저장 기능은 있지만 나의 컨텍스트를 아는 연결은 없다.

**핵심 문제는 세 가지다:**
- 내가 정보를 찾아가야 한다 — 정보가 나를 찾아오지 않는다
- 도구가 내 컨텍스트를 모른다 — 지금 고민 중인 아키텍처 문제, 어제 일기에 적은 고민을 앱이 모른다
- 반응이 학습으로 이어지지 않는다 — 어떤 글을 끝까지 읽었는지, 저장했는지가 다음 큐레이션에 반영되지 않는다

### 1.2 제품 비전

> 매일 아침 7시, 나의 관심사·고민·컨텍스트를 아는 AI가 "오늘 꼭 읽어야 할 것"을 텔레그램으로 보내준다. 내가 반응할수록 더 정확해지고, My Life OS의 메모/일기와 연동해 "지난달 고민하던 그 문제 관련 아티클이 나왔어요"를 알려주는 두 번째 뇌.

### 1.3 성공 지표

| 지표 | 정의 | MVP 목표 | 6개월 목표 |
|------|------|----------|-----------|
| 일일 브리핑 오픈율 | 매일 아침 브리핑을 열어본 비율 | 70%+ | 85%+ |
| 피드백 반응률 | 브리핑 아이템에 좋아요/싫어요 반응 비율 | 40%+ | 65%+ |
| 웹 전환율 | 텔레그램 봇에서 웹 상세보기로 이동하는 비율 | 30%+ | 50%+ |
| 추천 체감 정확도 | 사용자 만족도 피드백 기준 | 기준선 측정 시작 | 75%+ |
| My Life OS 연동 활성화율 | 메모/일기 연동 활성화 비율 | 해당 없음 | 60%+ |

---

## 2. 사용자 페르소나

Cortex는 1인 사용자(jsong1230) 전용으로 설계된 개인화 도구다. 가족/지인 공유가 목적이 아니며, 완전한 개인 컨텍스트 최적화가 핵심이다.

| 항목 | 내용 |
|------|------|
| **프로필** | 50대 초반 · CTO · 서울 거주 · 한국-캐나다 원격 가족 생활 12년 |
| **기술 관심사** | LLM 인프라, 클라우드 비용 최적화, MSA, 팀 빌딩, 스타트업 전략 |
| **개인 생활** | 등산(주 2-3회), 골프(주 1회), 매주 가족 화상통화 |
| **정보 습관** | 아침 출근 전 텔레그램 확인, Hacker News 주 3회, 뉴스레터 구독 중이지만 안 읽힘 |
| **연동 프로젝트** | My Life OS (Next.js + Supabase), Family Async Journal |

---

## 3. 시스템 아키텍처

### 3.1 데이터 전체 흐름

```
[콘텐츠 수집 레이어] RSS + HN API + GitHub Trending + 네이버/다음 + 유튜브 + 날씨 API
  → [AI 처리 레이어] Claude API: 요약 + 관심도 스코어링 + 컨텍스트 매칭
  → [발송 레이어] 텔레그램 Bot API sendMessage (매일 07:00)
  → [반응 레이어] 텔레그램 인라인 버튼 반응 + 웹페이지 상세 피드백
  → [학습 레이어] Supabase pgvector: 관심사 임베딩 업데이트
  → [연동 레이어] My Life OS DB: 메모/일기 키워드 컨텍스트 주입
```

### 3.2 기술 스택 상세

| 구성 레이어 | 기술 | 선택 이유 |
|------------|------|----------|
| 프론트엔드 | Next.js 14 (앱 라우터) | My Life OS와 동일 스택, 코드 재사용 가능 |
| 데이터베이스 | Supabase (PostgreSQL + 벡터 검색) | My Life OS와 DB 공유, 벡터 검색 내장 |
| 인증 | Supabase 인증 (텔레그램 로그인 위젯) | 텔레그램 봇과 동일 계정 자동 연동 |
| AI 요약/큐레이션 | Claude API (최신 소네트 모델) | 콘텐츠 요약 + 관심도 분석 |
| 텔레그램 봇 | 텔레그램 Bot API | 무료 공개 API, 심사 없이 즉시 사용 가능 |
| 스케줄러 | 버셀 크론 작업 | 매일 오전 6시 30분 수집, 7시 발송 |
| 콘텐츠 수집 | RSS 파서 + HN 파이어베이스 API + GitHub API | 공식 API 우선 사용, 크롤링 최소화 |
| 배포 | Vercel | Next.js 최적화, 무료 플랜 |

### 3.3 My Life OS 연동 설계

Cortex와 My Life OS는 Supabase DB를 공유한다. 별도 API 호출 없이 같은 PostgreSQL 인스턴스에서 직접 쿼리한다.

| My Life OS 테이블 | Cortex에서 읽는 데이터 | 활용 방식 |
|------------------|----------------------|----------|
| `diary_entries` | 최근 7일 일기 텍스트 | 키워드 추출 → 브리핑 가중치 조정 |
| `todos / notes` | 미완료 태스크, 메모 제목 | 관련 아티클 서페이싱 |
| `health_logs` | 수면 점수, 컨디션 | (향후) 컨디션 기반 콘텐츠 밀도 조정 |
| `cortex_interactions` | Cortex 전용 반응 로그 | My Life OS에서 "이번 달 읽은 아티클" 표시 |

---

## 4. 데이터베이스 스키마

### 4.1 핵심 테이블 정의

#### content_items — 수집된 콘텐츠
```sql
CREATE TABLE content_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       TEXT NOT NULL,  -- 'tech' | 'world' | 'culture' | 'canada'
  source        TEXT NOT NULL,  -- 'hackernews' | 'naver_news' | 'daum_news' | 'melon' | 'netflix' 등
  source_url    TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  summary_ai    TEXT,           -- Claude가 생성한 1~2줄 요약
  full_text     TEXT,
  embedding     VECTOR(1536),
  published_at  TIMESTAMPTZ,
  collected_at  TIMESTAMPTZ DEFAULT NOW(),
  tags          TEXT[],
  score_initial FLOAT DEFAULT 0.5
);
```

#### briefings — 매일 발송된 브리핑
```sql
CREATE TABLE briefings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date     DATE NOT NULL UNIQUE,
  items             JSONB NOT NULL,  -- [{content_id, position, channel, reason}]
  telegram_sent_at  TIMESTAMPTZ,
  telegram_opened   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

#### user_interactions — 반응 로그 (핵심 학습 데이터)
```sql
CREATE TABLE user_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   UUID REFERENCES content_items(id),
  briefing_id  UUID REFERENCES briefings(id),
  interaction  TEXT NOT NULL,  -- '좋아요' | '싫어요' | '저장' | '메모' | '웹열기' | '링크클릭' | '스킵'
  memo_text    TEXT,
  source       TEXT,           -- 'telegram_bot' | 'web'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

#### interest_profile — 학습된 관심사 프로필
```sql
CREATE TABLE interest_profile (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             TEXT NOT NULL UNIQUE,
  score             FLOAT DEFAULT 0.5,  -- 0.0 ~ 1.0
  interaction_count INT DEFAULT 0,
  last_updated      TIMESTAMPTZ DEFAULT NOW(),
  embedding         VECTOR(1536)
);
```

#### alert_settings — 긴급 알림 설정
```sql
CREATE TABLE alert_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type         TEXT NOT NULL,
  -- 'toronto_weather' | 'keyword_breaking' | 'world_emergency' | 'culture_trend' | 'mylifeos_match'
  is_enabled           BOOLEAN DEFAULT TRUE,
  quiet_hours_start    TIME DEFAULT '23:00',
  quiet_hours_end      TIME DEFAULT '07:00',
  last_triggered_at    TIMESTAMPTZ,
  daily_count          INT DEFAULT 0,
  daily_count_reset_at DATE DEFAULT CURRENT_DATE
);
```

#### keyword_contexts — My Life OS 연동 컨텍스트
```sql
CREATE TABLE keyword_contexts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source     TEXT,       -- '일기' | '할일' | '메모'
  source_id  UUID,
  keywords   TEXT[],
  embedding  VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- 7일 TTL
);
```

---

## 5. 기능 명세

### 5.1 콘텐츠 수집 파이프라인 — 3채널 구조

매일 06:30 Vercel Cron이 트리거. 수집 → 중복 제거 → AI 요약 → 스코어링 → DB 저장 순으로 처리. 브리핑은 TECH / WORLD / CULTURE / TORONTO 4개 채널로 구성되며, 채널별로 독립적인 소스와 선정 로직을 갖는다.

#### 🖥️ TECH 채널 소스

| 소스 | 수집 방법 | 수집량/일 | 우선순위 |
|------|----------|----------|---------|
| Hacker News | Firebase REST API (Top Stories) | 50개 → 10개 | P0 |
| GitHub Trending | github.com/trending 파싱 | 트렌딩 20개 | P0 |
| 사용자 정의 RSS | 사용자 설정 RSS URL 목록 | 피드당 최신 5개 | P0 |
| arXiv | arXiv API (cs.AI, cs.DC) | 10개 → 3개 | P1 |
| Tech 블로그 | engineering.fb.com, netflixtechblog.com 등 | 주 3회 | P1 |

#### 🌍 WORLD 채널 소스

오늘 이것만 알면 대화가 된다 수준의 핵심 이슈 1~2개만 선정. 정치적 중립을 유지하며 팩트 중심 요약.

| 소스 | 수집 방법 | 수집량/일 | 우선순위 |
|------|----------|----------|---------|
| 네이버 뉴스 RSS | news.naver.com 정치/경제/사회/IT 섹션별 RSS | 섹션당 20개 → 3개 | P0 |
| 다음 뉴스 RSS | news.daum.net RSS (주요뉴스) | 50개 → 2개 | P0 |
| 연합뉴스 RSS | rssnews.yonhapnews.co.kr 주요뉴스 | 100개 → 2개 | P0 |
| BBC Korea RSS | feeds.bbci.co.uk/korean/rss.xml | 30개 → 1개 | P1 |
| NYT Top Stories API | developer.nytimes.com (글로벌 이슈) | 20개 → 1개 | P1 |
| Google Trends KR | trends.google.com/trends/trendingsearches/daily | 상위 10개 확인 | P2 |

> **WORLD 채널 선정 기준 (Claude API 프롬프트)**  
> 네이버/다음/연합뉴스/BBC Korea에서 수집한 헤드라인들 중 오늘 한국의 40~50대 직장인이 "이건 알아야 한다"고 느낄 이슈 최대 2개를 선정. 조건: 일시적 가십이 아닌 중요한 구조적 변화, 또는 현재 대부분의 사람이 알고 있는 화제. 정치 편향 없이 팩트만. 동일 이슈가 여러 소스에서 반복 등장할수록 가중치 부여.

#### 🎬 CULTURE 채널 소스

요즘 사람들이 뭘 보고 듣는지 파악. 아들들과의 대화 소재, 사회적 맥락 이해가 목적. 취향 학습이 아닌 트렌드 트래킹.

| 소스 | 수집 방법 | 수집량/일 | 우선순위 |
|------|----------|----------|---------|
| 네이버 실시간 급상승 검색어 | naver.com 실검 파싱 | TOP 20 → 5개 | P0 |
| 네이버 데이터랩 API | datalab.naver.com 검색어/쇼핑 트렌드 (공식 API) | TOP 10 | P0 |
| 다음 카카오 이슈 트렌드 | search.daum.net 이슈 키워드 파싱 | TOP 10 | P0 |
| 넷플릭스 한국 TOP 10 | netflix.com/kr 파싱 | TOP 10 → 1위 | P0 |
| 멜론 실시간 차트 | melon.com/chart 파싱 | TOP 5 | P0 |
| 유튜브 트렌딩 KR | YouTube Data API v3 (regionCode=KR) | TOP 10 → 2개 | P0 |
| 왓챠/티빙 인기작 | 각 플랫폼 인기 페이지 파싱 | 주 2회 | P1 |
| 박스오피스 (KOBIS) | kobis.or.kr 오픈 API | 주 1회 (주말) | P1 |
| 네이버 웹툰 인기 순위 | webtoon.naver.com 파싱 | 주 2회 | P2 |

> **CULTURE 채널 설계 원칙**  
> 개인 취향 학습이 아닌 "지금 세상이 뭘 소비하는가" 채널. 트렌드 순위 기반으로만 선정. 단, "이미 알아" 반응 시 다음날 브리핑에서 제외. 특히 네이버 실검 + 다음 이슈 트렌드는 실시간 한국 관심사를 반영하는 핵심 소스.

#### 🍁 TORONTO 채널 소스

토론토 가족의 일상 맥락 파악. 주 1회 화상통화 대화 소재, 아들들이 경험하는 환경 이해가 목적.

| 소스 | 수집 방법 | 수집량/일 | 우선순위 |
|------|----------|----------|---------|
| Toronto Star RSS | thestar.com/feeds 주요뉴스 | 30개 → 2개 | P0 |
| CBC News Canada RSS | cbc.ca/cmlink/rss-canada | 30개 → 2개 | P0 |
| 토론토 날씨 | 날씨 API (토론토, 캐나다) | 매일 1회 (고정) | P0 |
| Globe and Mail RSS | theglobeandmail.com RSS | 20개 → 1개 | P1 |
| Reddit r/toronto | reddit.com/r/toronto/.rss (Hot) | TOP 10 → 1개 | P1 |
| 캐나다 환율 (CAD/KRW) | 환율 API 또는 한국은행 공개 API | 매일 1회 | P2 |

> **TORONTO 채널 설계 의도**  
> 단순 캐나다 뉴스가 아니라 "토론토에 사는 가족의 일상 맥락"에 집중. 토론토 폭설 → "오늘 아이들 출퇴근 힘들겠다", 캐나다 금리 인상 → "아이들 생활비 영향 있겠다". 날씨는 매일 고정 포함 (서울 아침 7시 브리핑 = 토론토 전날 저녁 날씨).

#### 채널별 AI 스코어링 로직

| 채널 | 선정 기준 | 개인화 학습 | 일 선정 수 |
|------|----------|-----------|----------|
| 🖥️ TECH | 관심도 ×0.6 + 컨텍스트 ×0.3 + 최신성 ×0.1 | O (EMA 업데이트) | 2~3개 |
| 🌍 WORLD | Claude 중요도 판단 (팩트 기반) | X (고정 로직) | 1~2개 |
| 🎬 CULTURE | 플랫폼 순위 + 검색량 기반 | X (트렌드 순위) | 1~2개 |
| 🍁 TORONTO | 뉴스 중요도 + 날씨 고정 포함 | X (고정 로직) | 2~3개 |
| 🎲 세렌디피티 | 전체 채널 랜덤 + 관심사 인접 영역 | 약한 역가중치 | 1개 |

---

### 5.2 텔레그램 봇 — 브리핑 발송

#### 메시지 포맷 (매일 오전 7시) — 5채널 구성

```
🌅 Cortex 브리핑 — {날짜} ({요일})

🖥️ TECH
① {기술 아이템1} [{소스}]
② {기술 아이템2} [{소스}]

🌍 WORLD
③ {오늘의 핵심 이슈 1줄 요약}

🎬 CULTURE
④ 넷플릭스 1위: {드라마/영화명}
⑤ 실검: {네이버 급상승 키워드 Top 3}

🍁 TORONTO
☁️ {날씨: 현재기온/최고/최저, 날씨상태}
⑥ {토론토/캐나다 주요 이슈 1줄}

🎲 {세렌디피티 — 예상 밖 한 가지}
━━━━━━━━━━━━━━━
👉 자세히 보기  |  ⚙️ 설정

{My Life OS 연동 시}
💡 지난주 메모: "{키워드}" 관련 아티클 포함
```

> **텔레그램 봇 초기 설정**  
> BotFather(@BotFather)에서 `/newbot` 명령어로 봇 생성 → 토큰 발급 → `TELEGRAM_BOT_TOKEN` 환경 변수 설정. 이후 `setWebhook`으로 서버 URL 등록. 심사 없이 당일 개발 시작 가능. 인라인 키보드로 👍 👎 🔖 버튼을 메시지에 바로 붙일 수 있어 웹 없이도 피드백 수집 가능.

#### 텔레그램 봇 명령어

| 명령어 | 동작 | 응답 |
|--------|------|------|
| 👍 또는 `/good` | 마지막 브리핑 전체 긍정 | "오늘 방향 맞군요! 내일도 비슷하게 드릴게요" |
| 👎 또는 `/bad` | 마지막 브리핑 전체 부정 | "어떤 주제가 별로였나요? (키워드 입력)" |
| `/save N` | N번째 아이템 저장 | "저장됐어요. 웹에서 메모 남길 수 있어요" |
| `/more` | 웹 상세페이지 링크 발송 | 오늘 브리핑 웹 URL |
| `/keyword XXX` | 관심 키워드 즉시 추가 | "XXX를 관심 키워드에 추가했어요" |
| `/stats` | 이번 달 관심사 요약 | 관심 토픽 Top 5 + 읽은 아티클 수 |
| `/mute N` | N일간 브리핑 중단 (방학 모드) | "N일 후 다시 시작할게요" |

---

### 5.3 웹 대시보드

#### 페이지 구조

| 라우트 | 페이지 | 핵심 기능 |
|--------|--------|----------|
| `/` | 오늘의 브리핑 | 채널별 아이템 카드 + 피드백 버튼 |
| `/item/[id]` | 아이템 상세 | AI 요약 + 원문 링크 + 메모 입력 |
| `/history` | 브리핑 히스토리 | 날짜별 과거 브리핑 + 저장 목록 |
| `/profile` | 관심사 프로필 | 토픽별 스코어 시각화 + 수동 조정 |
| `/settings` | 설정 | RSS 소스 관리, 알림 설정, My Life OS 연동 ON/OFF |
| `/insights` | 인사이트 (Phase 4) | 관심사 지형도, 월간 리포트 |

#### 브리핑 카드 UI 스펙
- 모바일 우선, 1열 레이아웃
- 카드 구성: [채널 뱃지] [소스] [제목] [1~2줄 AI 요약] [피드백 버튼 행]
- 피드백 버튼: 👍 흥미롭다 / 👎 관심없다 / 🔖 저장 / 💬 메모
- 버튼 탭 시 즉시 색상 변경 (낙관적 업데이트), 서버 저장은 비동기
- 💡 아이콘 + 이유 표시: "지난주 MSA 메모 관련"

---

### 5.4 학습 엔진

#### 반응 → 점수 업데이트 로직

| 반응 타입 | 점수 변화 | 가중치 이유 |
|----------|----------|-----------|
| 👍 좋아요 | +0.15 | 명시적 긍정 신호 |
| 🔖 저장 | +0.12 | 나중에 읽겠다 = 관심 있음 |
| 💬 메모 | +0.20 | 메모까지 남김 = 강한 관심 |
| 링크 클릭 | +0.08 | 클릭했지만 반응 미기록 |
| 웹 페이지 열기 | +0.05 | 웹으로 넘어가 확인 |
| 👎 싫어요 | -0.20 | 명시적 부정 신호 |
| 무반응 (스킵) | -0.03 | 브리핑에 있었지만 무반응 |

#### 관심사 토픽 관리
- AI가 아티클에서 토픽 자동 추출 (LLM inference, Kubernetes, Startup 등)
- 토픽별 `interest_profile` 스코어를 지수이동평균(EMA)으로 업데이트 (α=0.3)
- 스코어 0.2 이하 토픽은 3개월 후 자동 보관 처리
- 웹 `/profile`에서 수동 추가/삭제/조정 가능

---

### 5.5 브리핑 포맷 전략 — 평일 vs 주말

매일 동일한 포맷은 2~3주 후 피로도를 유발한다. 평일은 속도감 있는 요약, 주말은 깊이 있는 회고 형식으로 분리.

| 구분 | 평일 (월~금) | 주말 (토~일) |
|------|------------|------------|
| 목적 | 오늘 하루 준비, 빠른 파악 | 이번 주 돌아보기 + 깊이 읽기 |
| 아이템 수 | 7~8개 | 5개 엄선 + 주간 베스트 3개 |
| 포맷 | 제목 + 1줄 요약 + 피드백 버튼 | 제목 + 3줄 요약 + 왜 중요한가 |
| TORONTO 날씨 | 오늘 날씨 한 줄 | 주간 날씨 요약 |
| 특별 섹션 | 없음 | 이번 주 저장 중 미읽은 것 리마인더 |
| 발송 시간 | 07:00 | 09:00 |

#### 피로도 방지 장치

| 장치 | 구현 방법 | 트리거 조건 |
|------|----------|-----------|
| 채널 일시 중단 | 웹 /settings에서 채널별 ON/OFF | 사용자 수동 |
| 방학 모드 | `/mute N` 명령어 → N일간 중단 | 텔레그램 명령어 |
| 아이템 수 자동 조절 | 7일 연속 무반응 시 아이템 수 -2개 | 자동 감지 |
| 중복 이슈 필터 | 3일 연속 같은 이슈 → "계속 팔로우 중" 축약 | 자동 |

#### 주말 Weekly Digest 섹션
토요일 브리핑에만 포함:
- 이번 주 좋아요 한 아이템 Top 3 요약
- 이번 주 저장했지만 아직 안 읽은 것 (최대 3개)
- 이번 주 토론토 날씨 흐름 요약
- AI 한줄 코멘트: "이번 주 당신의 관심은 {토픽}에 집중됐어요"

---

### 5.6 알림 전략 — 정기 브리핑 + 긴급 알림

#### 알림 2-Tier 구조

| Tier | 종류 | 채널 | 조건 | 하루 최대 |
|------|------|------|------|---------|
| Tier 1 | 정기 브리핑 | 텔레그램 | 매일 07:00 (주말 09:00) | 1회 |
| Tier 2 | 긴급 알림 | 텔레그램 | 아래 트리거 조건 충족 시 | 3회 |

#### 긴급 알림 트리거 조건

| 트리거 | 조건 | 예시 메시지 | 기본값 |
|--------|------|-----------|--------|
| 🍁 토론토 날씨 경보 | 폭설 15cm+, 한파 -20도 이하, 폭풍 경보 | 🚨 토론토 오늘 폭설 예보 (22cm). 가족 이동 주의 | ON |
| 🖥️ 관심 키워드 속보 | interest_profile 상위 3개 토픽에서 HN 500+ 포인트 | 🔥 LLM 관련 빅뉴스: OpenAI GPT-5 발표 | ON |
| 🌍 세계 긴급 이슈 | BBC/연합뉴스 breaking 태그 + Google Trends 급상승 | 🌍 긴급: {이슈 한줄} | OFF |
| 🎬 문화 폭발 트렌드 | 24시간 내 네이버 실검 1위 + 유튜브 트렌딩 동시 진입 | 🎬 지금 난리난 것: {키워드} | OFF |
| 💡 My Life OS 연동 | 일기/메모 키워드와 정확히 매칭되는 아티클 발견 | 💡 어제 메모하신 {키워드} 관련 아티클이 나왔어요 | ON |

> **알림 중복 방지 로직**  
> 같은 이슈로 당일 이미 긴급 알림을 보낸 경우 재발송 하지 않는다. Tier 2 알림은 하루 최대 3회로 하드 캡. 방해 금지 시간대 설정 가능 (기본: 23:00~07:00). 긴급 알림이 정기 브리핑 30분 이내에 발송될 경우 브리핑에 합산.

---

### 5.7 읽기 루프 — 저장에서 인사이트까지

정보를 받고 끝내는 것이 아니라 저장한 것을 실제로 활용하고 나의 생각으로 만드는 완결된 루프.

```
1단계 수집 → 2단계 반응 → 3단계 축적 → 4단계 소화 → 5단계 인사이트
```

#### 저장 아이템 상태 관리

| 상태 | 의미 | UI 표시 | 자동 전환 조건 |
|------|------|--------|-------------|
| 저장 완료 | 나중에 읽겠다고 표시 | 주황 뱃지 | 수동 저장 |
| 읽는 중 | 원문 링크 클릭한 적 있음 | 파란 뱃지 | link_clicked 이벤트 |
| 완독 | 사용자가 완료 표시 | 초록 뱃지 | 수동 체크 |
| 보관 | 오래됐지만 지우기 싫음 | 회색 뱃지 | 30일 경과 + 미완독 |

#### 리마인더 시스템

| 리마인더 종류 | 트리거 | 메시지 예시 | 채널 |
|-------------|--------|-----------|------|
| 주말 미완독 알림 | 토요일 Weekly Digest에 포함 | 저번 주 저장했지만 못 읽은 것 3개 있어요 | 브리핑 |
| 관련 아이템 연결 | 새 아이템이 저장된 것과 유사 주제 | 지난주 저장한 K8s 글과 연관된 새 글이 왔어요 | 브리핑 내 표시 |
| 30일 보관 예정 알림 | 저장 후 25일 경과 + 미완독 | 이 글 곧 보관 처리돼요. 읽으실 건가요? | 텔레그램 |
| 월말 미완독 요약 | 매월 마지막 날 | 이번 달 저장 12개 중 완독 4개. 나머지 8개 목록 | 텔레그램 |

#### AI 월간 생각 정리 (매월 1일)
지난달 완독 아이템 + My Life OS 일기를 교차 분석해 Claude API가 정리.

**예시 출력:**
```
지난달 핵심 관심사: LLM 추론 비용 최적화 (완독 8건), 엔지니어링 조직 문화 (완독 5건)

눈에 띄는 변화: 쿠버네티스 관련 읽기 40% 감소, AI 에이전트 관련 3배 증가

My Life OS 연동 인사이트: 11월 일기에서 MSA 전환 고민을 자주 언급하셨는데,
관련 아티클 완독률이 92%로 가장 높았어요.

추천 후속 질문: 지금 가장 깊이 파고들고 싶은 주제가 LLM 비용과 조직 문화 중 무엇인가요?
```

> **설계 원칙 — 강요하지 않는 소화**  
> 모든 리마인더는 무시하거나 끌 수 있고, "다음에 알려줘" (3일 연장) 응답이 가능. 읽기 루프의 목적은 완독률이 아니라 나에게 의미있는 정보가 생각으로 연결되는 경험.

---

## 6. API 설계

### 6.1 내부 API 라우트

| 메서드 | 엔드포인트 | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/api/cron/collect` | 콘텐츠 수집 트리거 (버셀 크론) | 크론 전용 키 |
| POST | `/api/cron/send-briefing` | 텔레그램 브리핑 일괄 발송 | 크론 전용 키 |
| GET | `/api/briefings/today` | 오늘 브리핑 조회 | Supabase Auth |
| GET | `/api/briefings/[date]` | 특정 날짜 브리핑 | Supabase Auth |
| POST | `/api/interactions` | 반응 로그 저장 | Supabase Auth |
| GET | `/api/profile/interests` | 관심사 프로필 조회 | Supabase Auth |
| POST | `/api/telegram/webhook` | 텔레그램 봇 메시지 수신 | 텔레그램 시크릿 토큰 |
| POST | `/api/context/sync` | My Life OS 컨텍스트 동기화 | 내부 전용 |
| POST | `/api/alerts/check` | 긴급 알림 트리거 체크 (1시간마다) | 크론 전용 키 |
| PUT | `/api/alerts/settings` | 알림 트리거 ON/OFF 설정 | Supabase Auth |

### 6.2 텔레그램 봇 연동 방식

텔레그램 Bot API(무료)를 사용. `sendMessage`로 발송, 사용자 응답과 버튼 클릭은 웹훅(`setWebhook`)으로 수신. BotFather에서 봇 생성 후 토큰 발급으로 즉시 시작 가능.

---

## 7. 개발 단계별 계획

### Phase 0 — 뼈대 (1주차)
- Vercel Cron 설정 (06:30 수집, 07:00 발송)
- HN API + GitHub Trending RSS 파서 구현
- Claude API로 각 아이템 1~2줄 요약 생성
- BotFather에서 텔레그램 봇 생성 + 토큰 발급 (5분 소요)
- 텔레그램 Bot API `sendMessage`로 즉시 테스트 가능 (심사 불필요)
- Supabase `content_items`, `briefings` 테이블 생성
- **✅ 완료 기준**: 매일 아침 텔레그램으로 브리핑 수신

### Phase 1 — 피드백 루프 (2주차)
- Next.js 웹 라우트 `/` (오늘 브리핑 페이지) 구현
- 브리핑 카드 UI + 피드백 버튼 (👍 👎 🔖 💬)
- `user_interactions` 테이블 + `/api/interactions` API
- 텔레그램 봇 "더보기" 버튼 또는 인라인 버튼 → 웹 URL 발송
- Supabase Auth + 텔레그램 로그인 위젯 연동
- 웹 `/settings`: 긴급 알림 트리거 ON/OFF 설정 + 텔레그램 chat_id 연동 확인
- **✅ 완료 기준**: 웹에서 반응 남기면 DB에 저장됨

### Phase 2 — 학습 + 개인화 (3~4주차)
- pgvector 활성화 + 콘텐츠 벡터 임베딩 생성
- 관심사 프로필 테이블 + 지수이동평균 업데이트 로직
- 반응 기반 스코어링 → 다음날 브리핑 가중치 반영
- 웹 `/profile` 페이지: 관심사 시각화 (차트 라이브러리)
- 텔레그램 봇 `/stats` 명령어 구현
- 크론 1시간마다 긴급 알림 트리거 체크
- 날씨 API 토론토 날씨 경보 연동
- **✅ 완료 기준**: 1주 사용 후 브리핑 품질 체감 향상

### Phase 3 — My Life OS 연동 (5주차)
- My Life OS DB 일기/할일 테이블 읽기 쿼리
- 키워드 컨텍스트 테이블 + 7일 만료 키워드 추출
- 컨텍스트 매칭 아이템에 💡 이유 표시
- 웹 `/settings`: My Life OS 연동 켜기/끄기 토글
- My Life OS 대시보드에 "이번 달 읽은 아티클 N개" 위젯
- **✅ 완료 기준**: 일기 키워드가 다음날 브리핑에 반영됨

### Phase 4 — 인사이트 (7~8주차)
- 웹 `/insights`: 관심사 지형도 (버블 차트)
- 월간 리포트: 이번 달 가장 많이 읽은 주제 Top 5
- AI 주간 요약: 이번 주 기술 트렌드 3줄 요약
- 세렌디피티 효과 측정: 예상 밖 관심사 발견 추적
- **✅ 완료 기준**: 나를 나보다 잘 아는 브리핑 체감

---

## 8. 환경 설정 및 초기 세팅

### 8.1 환경 변수 목록

```bash
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
OPENWEATHER_API_KEY=
YOUTUBE_DATA_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=

# My Life OS 연동
MYLIFEOS_INTEGRATION_ENABLED=true
```

---

## 9. 리스크 및 제약사항

| 리스크 | 심각도 | 대응 방안 |
|--------|--------|---------|
| 텔레그램 봇 API 속도 제한 (초당 30메시지) | 낮음 | 1인 사용 기준 속도 제한 무관. 추후 다수 발송 시 queue 처리 |
| Claude API 비용 (수집 아이템 수 × 요약 호출 횟수) | 보통 | 캐싱 적극 활용, 동일 URL 재요약 방지. 일 예상 비용 $0.5~1 |
| 콘텐츠 소스 크롤링 차단 (넷플릭스, 멜론 등) | 보통 | 공식 API/RSS 우선. 크롤링 필요 시 User-Agent 설정. 대체 소스 준비 |
| pgvector 쿼리 성능 (임베딩 수 증가) | 낮음 | HNSW 인덱스 설정. 6개월 이후 고려 |
| My Life OS DB 스키마 변경 충돌 | 낮음 | 연동 쿼리를 별도 `lib/mylifeos.ts`에 격리 |
| 텔레그램 봇 명령어 오인식 | 낮음 | 명령어 목록 웹 `/settings`에서 확인 가능하도록 |

---

## 10. 미결 사항 (개발 착수 전 결정 필요)

1. **텔레그램 인라인 버튼 활용 범위**: 브리핑 메시지에 👍 👎 🔖 버튼을 바로 붙일 수 있어 웹 없이도 피드백 가능. 버튼만으로 충분한지, 웹 상세보기도 병행할지?

2. **텔레그램 봇 명령어 설계**: `/stats`, `/save`, `/mute` 등 슬래시 명령어와 자연어 명령어 중 어느 쪽을 우선할지? 텔레그램은 슬래시 명령어 자동완성을 지원하므로 슬래시가 UX상 유리.

3. **WORLD 채널 정치적 중립 기준**: 선거, 정치 이슈 등 민감한 경우 아예 제외할지, 팩트만 요약할지.

4. **CULTURE 채널 범위**: 한국 콘텐츠만 할지, 아들들 때문에 북미 트렌드(빌보드, 해외 넷플릭스)도 포함할지?

5. **넷플릭스/멜론 파싱 안정성**: UI 변경 시 파싱이 깨짐. 대체 소스(키노라이츠, 차트메트릭) 검토 필요.

6. **My Life OS 일기 프라이버시**: 일기 원문 전체를 임베딩하지 않고 키워드만 추출하는 것이 맞는가? 어디까지 컨텍스트로 사용할지 경계 설정 필요.

7. **주말 브리핑 발송 시간**: 09:00 고정인지, 골프 라운딩 등 일정에 따라 요일별 커스터마이징 여부.

8. **긴급 알림 Tier 2 하루 최대 3회 캡**: 적절한지? 토론토 날씨만 무제한으로 하는 옵션도 고려.

9. **콘텐츠 만료 정책**: `content_items` 테이블이 무한정 커지는 것을 방지하기 위해 90일 이상 아이템 아카이브 정책 필요.

---

*CORTEX PRD v1.6 | jsong1230 | 2026-02-27*
