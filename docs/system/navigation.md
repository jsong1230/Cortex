# Cortex — 네비게이션 설계서

**버전**: 1.0 | **날짜**: 2026-02-27 | **상태**: 확정

---

## 1. 전체 화면 목록

| 라우트 | 페이지명 | 접근 조건 | 주요 기능 | 마일스톤 |
|--------|---------|----------|---------|---------|
| `/` | 오늘의 브리핑 | 인증 필요 | 오늘 브리핑 카드 목록 + 피드백 버튼 | M2 (F-08) |
| `/item/[id]` | 아이템 상세 | 인증 필요 | AI 요약 전문 + 원문 링크 + 메모 입력 + 관련 아이템 | M2 (F-09) |
| `/history` | 브리핑 히스토리 | 인증 필요 | 날짜별 과거 브리핑 + 저장 목록 필터 | M2 (F-10) |
| `/profile` | 관심사 프로필 | 인증 필요 | 토픽 스코어 시각화 + 수동 추가/삭제/조정 | M3 (F-14) |
| `/settings` | 설정 | 인증 필요 | 채널 ON/OFF, RSS 관리, 알림 설정, My Life OS 연동 | M3 (F-20) |
| `/insights` | 인사이트 | 인증 필요 | 관심사 지형도 (버블 차트) + 월간 리포트 | M5 (F-21, F-22) |
| `/login` | 로그인 | 인증 불필요 | 텔레그램 로그인 위젯 + Supabase Auth | M2 (F-12) |

> **비고**: 모든 웹 페이지는 1인 사용자(jsong1230) 전용이다. 인증되지 않은 접근은 `/login`으로 리다이렉트한다.

---

## 2. URL 구조

```
/ (루트)
├── /                         오늘의 브리핑 — 기본 랜딩 페이지
│   └── ?date=YYYY-MM-DD      특정 날짜 브리핑 쿼리 (history에서 링크 연결)
│
├── /item/[id]                아이템 상세
│   └── ?from=briefing        이전 페이지 백 버튼 제어용
│
├── /history                  브리핑 히스토리
│   └── ?filter=saved         저장 목록만 필터링
│
├── /profile                  관심사 프로필
│
├── /settings                 설정
│   ├── ?tab=channels         채널 설정 탭
│   ├── ?tab=alerts           알림 설정 탭
│   ├── ?tab=rss              RSS 소스 관리 탭
│   └── ?tab=integrations     My Life OS 연동 탭
│
├── /insights                 인사이트 (Phase 4)
│   └── ?month=YYYY-MM        특정 월 리포트
│
└── /login                    로그인
```

---

## 3. 네비게이션 흐름도

```mermaid
flowchart TD
    START([앱 진입]) --> AUTH{인증 상태?}

    AUTH -->|비인증| LOGIN[/login\n로그인 페이지]
    AUTH -->|인증 완료| HOME

    LOGIN -->|텔레그램 로그인 성공| HOME

    subgraph TELEGRAM [텔레그램 진입점]
        TG_BRIEFING[매일 07:00 브리핑 메시지]
        TG_MORELINK[👉 자세히 보기 링크]
        TG_ITEMLINK[인라인 버튼: 웹열기]
    end

    TG_BRIEFING --> TG_MORELINK
    TG_MORELINK -->|클릭| HOME
    TG_ITEMLINK -->|클릭| DETAIL

    subgraph WEB [웹 대시보드]
        HOME[/ 오늘의 브리핑]
        DETAIL[/item/:id 아이템 상세]
        HISTORY[/history 브리핑 히스토리]
        PROFILE[/profile 관심사 프로필]
        SETTINGS[/settings 설정]
        INSIGHTS[/insights 인사이트]
    end

    HOME -->|카드 탭| DETAIL
    HOME -->|하단 탭: 히스토리| HISTORY
    HOME -->|하단 탭: 프로필| PROFILE
    HOME -->|하단 탭: 설정| SETTINGS

    DETAIL -->|뒤로가기| HOME
    DETAIL -->|원문 링크| EXTERNAL[외부 원문 페이지\n새 탭]
    DETAIL -->|관련 아이템| DETAIL

    HISTORY -->|날짜 탭| HOME
    HISTORY -->|저장 아이템 탭| DETAIL

    PROFILE -->|아이템 이력 탭| DETAIL

    SETTINGS -->|저장| SETTINGS

    HOME -->|네비 링크: 인사이트| INSIGHTS
    INSIGHTS -->|월간 아이템 탭| DETAIL
```

---

## 4. 모바일/데스크톱 네비게이션 패턴

### 4.1 모바일 (375px ~ 1023px): 하단 탭 바

```
┌─────────────────────────────────────────┐
│ [헤더] Cortex          2026.02.27 목    │
├─────────────────────────────────────────┤
│                                         │
│          [메인 콘텐츠 영역]              │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ [🏠홈]  [📚히스토리] [👤프로필] [⚙️설정] │
└─────────────────────────────────────────┘
```

| 탭 | 아이콘 | 라우트 | 설명 |
|----|--------|--------|------|
| 홈 | 🏠 | `/` | 오늘의 브리핑 |
| 히스토리 | 📚 | `/history` | 과거 브리핑 + 저장 목록 |
| 프로필 | 👤 | `/profile` | 관심사 프로필 |
| 설정 | ⚙️ | `/settings` | 앱 설정 |

> `/insights`는 Phase 4 구현 전까지 하단 탭 미표시. 구현 후 5번째 탭으로 추가하거나 프로필 탭 내 링크로 연결.

**모바일 헤더 구성:**
- 좌측: 앱 이름 "Cortex" (Noto Serif KR, 20px)
- 우측: 오늘 날짜 ("2026.02.27 목")

### 4.2 데스크톱 (1024px 이상): 좌측 사이드바

```
┌──────────────┬─────────────────────────────────┐
│              │                                  │
│  CORTEX      │    [메인 콘텐츠 영역]            │
│              │    max-width: 640px              │
│  🏠 홈       │    margin: 0 auto                │
│  📚 히스토리  │                                  │
│  👤 프로필   │                                  │
│  ⚙️ 설정    │                                  │
│  📊 인사이트 │                                  │
│              │                                  │
│  ─────────── │                                  │
│  jsong1230   │                                  │
│  [로그아웃]  │                                  │
└──────────────┴─────────────────────────────────┘
```

| 메뉴 항목 | 아이콘 | 라우트 |
|-----------|--------|--------|
| 홈 | 🏠 | `/` |
| 히스토리 | 📚 | `/history` |
| 프로필 | 👤 | `/profile` |
| 설정 | ⚙️ | `/settings` |
| 인사이트 | 📊 | `/insights` |

**사이드바 하단:**
- 사용자 이름 (jsong1230)
- 로그아웃 버튼

---

## 5. 인증 흐름

### 5.1 인증 방식

Supabase Auth를 사용하며 텔레그램 로그인 위젯으로 인증한다.

```
텔레그램 로그인 위젯 클릭
  → 텔레그램 앱에서 승인
  → 콜백 URL로 리다이렉트
  → Supabase Auth 세션 생성
  → `/` (오늘의 브리핑)으로 이동
```

### 5.2 미인증 접근 처리

```typescript
// Next.js 14 미들웨어 (middleware.ts)
// 인증 없이 웹 페이지 접근 시 /login으로 리다이렉트
// 단, /login 자체는 제외

const protectedRoutes = ['/', '/item', '/history', '/profile', '/settings', '/insights']
```

### 5.3 세션 만료 처리

- Supabase 세션 만료 시 자동 갱신 시도
- 갱신 실패 시 `/login?redirect={현재URL}` 리다이렉트
- 로그인 성공 후 `redirect` 파라미터 URL로 복귀

### 5.4 로그인 페이지 구성

```
┌─────────────────────────────────────────┐
│                                         │
│           Cortex                        │
│     나의 개인 AI 브리핑                   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  텔레그램으로 로그인                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  1인 전용 서비스 — jsong1230 전용         │
│                                         │
└─────────────────────────────────────────┘
```

---

## 6. 텔레그램 → 웹 진입점

웹 대시보드의 주요 진입 경로는 텔레그램 메시지 내 링크다.

| 진입 경로 | URL | 설명 |
|----------|-----|------|
| 브리핑 "자세히 보기" 버튼 | `{WEB_URL}/` | 오늘 브리핑 전체 목록 |
| 아이템별 "웹열기" 버튼 | `{WEB_URL}/item/{content_id}` | 특정 아이템 상세 페이지 |
| `/more` 명령어 응답 | `{WEB_URL}/` | 오늘 브리핑 웹 URL |
| 설정 링크 | `{WEB_URL}/settings` | 설정 페이지 직접 접근 |

---

## 7. 페이지별 주요 컴포넌트 구성

### 7.1 `/` — 오늘의 브리핑

```
AppShell
├── MobileHeader (모바일)
│   ├── AppLogo
│   └── TodayDate
├── Sidebar (데스크톱)
│   └── NavMenu
├── MainContent
│   ├── BriefingHeader ("오늘의 브리핑 | 2026.02.27")
│   ├── BriefingCardList
│   │   └── BriefingCard (반복)
│   │       ├── ChannelBadge
│   │       ├── SourceLabel
│   │       ├── ArticleTitle
│   │       ├── AISummary
│   │       ├── MyLifeOSHint (선택)
│   │       └── FeedbackButtons
│   └── EmptyState (브리핑 없을 때)
└── BottomNav (모바일)
```

### 7.2 `/item/[id]` — 아이템 상세

```
AppShell
├── MainContent
│   ├── BackButton
│   ├── ChannelBadge + SourceLabel
│   ├── ArticleTitle (display 폰트)
│   ├── MetaInfo (날짜, 수집 시간)
│   ├── AISummaryFull
│   ├── OriginalLink
│   ├── FeedbackButtons
│   ├── MemoInput
│   │   ├── TextArea
│   │   └── SaveButton
│   └── RelatedItems
│       └── BriefingCard (간략 버전, 반복)
└── BottomNav (모바일)
```

### 7.3 `/history` — 브리핑 히스토리

```
AppShell
├── MainContent
│   ├── FilterTabs
│   │   ├── Tab: 전체 히스토리
│   │   └── Tab: 저장 목록
│   ├── DatePicker (달력 또는 날짜 리스트)
│   ├── BriefingCardList
│   │   └── BriefingCard (반복)
│   └── Pagination (또는 무한 스크롤)
└── BottomNav (모바일)
```

### 7.4 `/profile` — 관심사 프로필

```
AppShell
├── MainContent
│   ├── ProfileHeader ("내 관심사 프로필")
│   ├── TopicChart (토픽별 스코어 바 차트)
│   ├── TopicList
│   │   └── TopicItem (점수 + 조정 컨트롤, 반복)
│   ├── AddTopicInput
│   └── ArchivedTopics (보관 목록 접기/펼치기)
└── BottomNav (모바일)
```

### 7.5 `/settings` — 설정

```
AppShell
├── MainContent
│   ├── SettingsTabs
│   │   ├── Tab: 채널
│   │   ├── Tab: 알림
│   │   ├── Tab: RSS 소스
│   │   └── Tab: 연동
│   └── SettingsContent (탭별)
│       ├── ChannelToggles (채널별 ON/OFF)
│       ├── AlertSettings (알림 트리거별 ON/OFF + 방해 금지)
│       ├── RSSManager (URL 추가/삭제)
│       └── IntegrationSettings (My Life OS, 텔레그램 연동 상태)
└── BottomNav (모바일)
```

---

*Cortex Navigation v1.0 | 2026-02-27*
