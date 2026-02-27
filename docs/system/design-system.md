# Cortex — 디자인 시스템

**버전**: 1.0 | **날짜**: 2026-02-27 | **상태**: 확정

---

## 1. 디자인 철학

### 1.1 핵심 원칙

**"매일 아침 읽는 개인 신문"**

Cortex 웹 대시보드는 텔레그램 링크를 탭했을 때 열리는 보조 인터페이스다. 사용자는 이미 텔레그램에서 브리핑을 받았으며, 웹에서는 더 깊이 읽거나 메모를 남기거나 과거 기록을 탐색하기 위해 방문한다. 따라서 다음 원칙을 따른다.

1. **정보 가독성 우선**: 50대 사용자를 위한 충분한 텍스트 크기(최소 16px), 넉넉한 줄 간격, 긴 텍스트도 피로 없이 읽히는 배경색
2. **모바일 우선**: 텔레그램 링크 탭 → 모바일 브라우저로 이동하는 주요 진입 경로에 최적화
3. **채널 아이덴티티**: 5개 채널(TECH/WORLD/CULTURE/TORONTO/세렌디피티)이 색상으로 즉시 구분됨
4. **피드백 접근성**: 좋아요/싫어요/저장/메모 버튼은 터치 타겟 44px 이상, 손가락으로 편하게 탭 가능
5. **최소주의**: 콘텐츠를 방해하는 장식 요소 없음. 기사 읽기와 피드백이 핵심이므로 UI는 조용하게

### 1.2 무드 및 레퍼런스

- **무드**: 프로페셔널하고 조용한 뉴스 읽기 환경. 모던하지만 차갑지 않게.
- **레퍼런스**: Readwise Reader의 집중 읽기 환경, Notion 읽기 모드의 여백감, Matter 앱의 채널 구분 방식
- **피해야 할 방향**: 테크 스타트업 스타일의 과도한 그라디언트, 카드 3열 균등 그리드, backdrop-filter 남용

### 1.3 다크 모드

**라이트 모드 전용**으로 설계한다. 이유:
- 50대 사용자 기준 아침 출근 전 밝은 환경에서 주로 사용
- 다크 모드 지원은 Phase 4 이후 검토

---

## 2. 색상 팔레트

### 2.1 기본 색상

| 역할 | 이름 | HEX | Tailwind 커스텀 토큰 | 용도 |
|------|------|-----|---------------------|------|
| 배경 (기본) | off-white | `#F8F7F4` | `bg-canvas` | 페이지 전체 배경 (순수 흰색 대신 따뜻한 오프화이트) |
| 배경 (카드) | white | `#FFFFFF` | `bg-card` | 브리핑 카드 배경 |
| 배경 (보조) | warm-gray-50 | `#F3F2EF` | `bg-surface` | 섹션 구분, 인풋 배경 |
| 텍스트 (주) | near-black | `#1A1A1A` | `text-primary` | 기사 제목, 본문 |
| 텍스트 (보조) | warm-gray-600 | `#5C5C5C` | `text-secondary` | 소스명, 날짜, 캡션 |
| 텍스트 (연) | warm-gray-400 | `#9E9E9E` | `text-muted` | 플레이스홀더, 비활성 |
| 구분선 | warm-gray-200 | `#E5E3DF` | `border-default` | 카드 경계, 섹션 구분 |
| 구분선 (연) | warm-gray-100 | `#F0EFEC` | `border-subtle` | 내부 요소 구분 |

### 2.2 채널 시그니처 색상

채널 뱃지 배경색, 강조 색상, 텍스트색으로 구성.

| 채널 | 이름 | 뱃지 배경 | 뱃지 텍스트 | 포인트색 | Tailwind 토큰 |
|------|------|----------|------------|---------|--------------|
| 🖥️ TECH | 테크 블루 | `#EBF2FF` | `#1D4ED8` | `#2563EB` | `channel-tech` |
| 🌍 WORLD | 월드 그린 | `#ECFDF5` | `#065F46` | `#059669` | `channel-world` |
| 🎬 CULTURE | 컬처 퍼플 | `#F5F3FF` | `#5B21B6` | `#7C3AED` | `channel-culture` |
| 🍁 TORONTO | 토론토 오렌지 | `#FFF7ED` | `#C2410C` | `#EA580C` | `channel-toronto` |
| 🎲 세렌디피티 | 앰버 골드 | `#FFFBEB` | `#92400E` | `#D97706` | `channel-serendipity` |

### 2.3 피드백 버튼 색상

| 버튼 | 기본 상태 | 활성 상태 (탭 후) | 텍스트 |
|------|----------|-----------------|--------|
| 👍 좋아요 | 배경 `#F3F2EF`, 아이콘 `#5C5C5C` | 배경 `#DBEAFE`, 아이콘 `#2563EB` | 좋아요 |
| 👎 싫어요 | 배경 `#F3F2EF`, 아이콘 `#5C5C5C` | 배경 `#FEE2E2`, 아이콘 `#DC2626` | 싫어요 |
| 🔖 저장 | 배경 `#F3F2EF`, 아이콘 `#5C5C5C` | 배경 `#FEF3C7`, 아이콘 `#D97706` | 저장 |
| 💬 메모 | 배경 `#F3F2EF`, 아이콘 `#5C5C5C` | 배경 `#F5F3FF`, 아이콘 `#7C3AED` | 메모 |

### 2.4 시맨틱 색상

| 역할 | HEX | 용도 |
|------|-----|------|
| 성공 (success) | `#059669` | 저장 완료, 동기화 성공 |
| 경고 (warning) | `#D97706` | 만료 예정, 미완독 리마인더 |
| 오류 (error) | `#DC2626` | API 에러, 로딩 실패 |
| 정보 (info) | `#2563EB` | 시스템 안내, My Life OS 연동 힌트 |

---

## 3. 타이포그래피

### 3.1 폰트 패밀리

한국어 콘텐츠가 주이므로 한국어 최적화 폰트를 우선한다.

| 역할 | 폰트 | 로드 방법 | 용도 |
|------|------|----------|------|
| 디스플레이 (제목) | Noto Serif KR | Google Fonts | 기사 제목, 날짜 헤더 — 신문 느낌의 세리프 폰트 |
| 본문 | Pretendard (또는 SUIT) | CDN or local | 요약 본문, UI 레이블, 버튼 — 가독성 우수한 고딕 |
| 영문 보조 | Inter | Google Fonts | 숫자, 영문 URL, 코드 |
| 시스템 폴백 | -apple-system, BlinkMacSystemFont, sans-serif | 시스템 | 폰트 로드 전 폴백 |

```css
/* Google Fonts 임포트 */
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Inter:wght@400;500;600&display=swap');

/* Pretendard CDN */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
```

### 3.2 타이포그래피 스케일

| 이름 | 크기 | 굵기 | 줄간격 | 자간 | 용도 |
|------|------|------|--------|------|------|
| `text-display` | 24px (1.5rem) | 700 | 1.3 | -0.02em | 페이지 제목, 날짜 헤더 |
| `text-headline` | 20px (1.25rem) | 700 | 1.4 | -0.01em | 기사 제목 (카드 내) |
| `text-title` | 18px (1.125rem) | 600 | 1.4 | -0.01em | 섹션 제목, 채널명 |
| `text-body` | 16px (1rem) | 400 | 1.7 | 0 | 본문, AI 요약 |
| `text-body-medium` | 16px (1rem) | 500 | 1.7 | 0 | 강조 본문, 소스명 |
| `text-small` | 14px (0.875rem) | 400 | 1.6 | 0 | 날짜, 캡션, 부가 정보 |
| `text-caption` | 12px (0.75rem) | 400 | 1.5 | 0.01em | 최소 단위 레이블 (최소 크기 — 이하 금지) |
| `text-button` | 14px (0.875rem) | 500 | 1 | 0 | 피드백 버튼, 탭 메뉴 |

> **50대 가독성 규칙**: 본문 최소 16px 유지. 12px 미만 절대 사용 금지.

---

## 4. 스페이싱 및 레이아웃

### 4.1 스페이싱 시스템 (4px 단위)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `space-1` | 4px | 최소 내부 간격 (아이콘 + 텍스트) |
| `space-2` | 8px | 컴포넌트 내부 간격 |
| `space-3` | 12px | 채널 뱃지 패딩, 버튼 수직 패딩 |
| `space-4` | 16px | 카드 내부 패딩 (모바일 기본 여백) |
| `space-5` | 20px | 카드 간격 |
| `space-6` | 24px | 섹션 상단 제목 여백 |
| `space-8` | 32px | 섹션 간격 |
| `space-10` | 40px | 페이지 상단 여백 |
| `space-16` | 64px | 하단 탭 바 높이 보정 여백 |

### 4.2 레이아웃 시스템

| 항목 | 모바일 (375px~) | 데스크톱 (1024px~) |
|------|----------------|-------------------|
| 최대 콘텐츠 너비 | 100% | 640px (읽기 모드) |
| 페이지 좌우 여백 | 16px | auto (중앙 정렬) |
| 카드 레이아웃 | 1열 풀 너비 | 1열, max-width 640px 중앙 정렬 |
| 네비게이션 | 하단 탭 바 (높이 56px) | 좌측 사이드바 (너비 220px) |
| 헤더 높이 | 56px | 사이드바 내 앱 이름으로 대체 |

> **설계 근거**: 웹 대시보드는 뉴스레터/아티클 읽기 용도이므로 max-width 640px의 단일 컬럼 읽기 레이아웃이 적합하다. 3열 그리드는 사용하지 않는다.

### 4.3 브레이크포인트

| 이름 | 값 | 용도 |
|------|-----|------|
| `sm` | 375px | 모바일 기본 (iPhone SE 기준) |
| `md` | 640px | 태블릿, 넓은 폰 |
| `lg` | 1024px | 데스크톱 — 사이드바 레이아웃 전환 |
| `xl` | 1280px | 넓은 데스크톱 |

### 4.4 터치 타겟 규칙

- 모든 인터랙티브 요소: 최소 44px × 44px
- 피드백 버튼 행: 높이 44px 이상, 버튼 간격 8px
- 하단 탭 아이콘: 탭 영역 전체가 터치 타겟 (56px 높이)

---

## 5. 컴포넌트 스타일 가이드

### 5.1 브리핑 카드 (BriefingCard)

```
┌─────────────────────────────────────────┐
│ [채널 뱃지]  소스명                    날짜 │
│                                         │
│ 기사 제목 (2줄까지, 이후 말줄임)          │
│                                         │
│ AI 요약 텍스트 (1~2줄, body 폰트)        │
│                                         │
│ 💡 지난주 메모: "MSA" 관련 (선택적)       │
│                                         │
│ [👍 좋아요] [👎 싫어요] [🔖 저장] [💬 메모] │
└─────────────────────────────────────────┘
```

**스타일 규칙:**
- 배경: `#FFFFFF`, 테두리: `1px solid #E5E3DF`
- 모서리: `border-radius: 12px` (적당한 둥근 모서리, 16px 미만)
- 그림자: `box-shadow: 0 1px 4px rgba(0,0,0,0.06)` — 과도한 그림자 금지
- 카드 패딩: 16px (모바일), 20px (데스크톱)
- 카드 간격: 12px
- 호버 효과 (데스크톱): `box-shadow: 0 4px 12px rgba(0,0,0,0.10)` + 0.15s transition
- 채널별 왼쪽 보더: `4px solid {채널 포인트색}` — 채널 구분을 위한 액센트

### 5.2 채널 뱃지 (ChannelBadge)

```
[🖥️ TECH]  — 이모지 + 채널명
```

**스타일 규칙:**
- 패딩: `4px 10px`
- 모서리: `border-radius: 6px`
- 폰트: 12px, weight 600
- 배경/텍스트: 채널별 시그니처 색상 사용 (§2.2 참조)
- 이모지와 텍스트 사이: 4px 간격

### 5.3 피드백 버튼 행 (FeedbackButtons)

```
[👍 좋아요] [👎 싫어요] [🔖 저장] [💬 메모]
```

**스타일 규칙:**
- 버튼 높이: 44px (터치 타겟 보장)
- 버튼 너비: flex-1 (균등 분배)
- 버튼 내부: 이모지(16px) + 텍스트(12px) 세로 중앙 정렬
- 버튼 간격: 6px
- 기본 배경: `#F3F2EF`, 모서리: `8px`
- 활성 상태: 채널/역할별 색상 (§2.3 참조)
- 트랜지션: `background-color 0.15s ease`
- 낙관적 업데이트: 탭 즉시 색상 변경

### 5.4 하단 탭 바 (BottomNav, 모바일)

```
[🏠 홈] [📚 히스토리] [👤 프로필] [⚙️ 설정]
```

**스타일 규칙:**
- 높이: 56px + 하단 safe area (env(safe-area-inset-bottom))
- 배경: `#FFFFFF`, 상단 테두리: `1px solid #E5E3DF`
- 아이콘 크기: 22px
- 레이블 크기: 11px
- 현재 탭: 포인트색(`#2563EB`)으로 아이콘 + 레이블 강조
- 비활성 탭: `#9E9E9E`
- position: fixed, bottom: 0, width: 100%
- 콘텐츠 하단에 `padding-bottom: 72px` 보정

### 5.5 좌측 사이드바 (Sidebar, 데스크톱)

**스타일 규칙:**
- 너비: 220px
- 배경: `#FFFFFF`, 오른쪽 테두리: `1px solid #E5E3DF`
- 상단: 앱 로고 + 이름 ("Cortex")
- 메뉴 항목: 높이 44px, 좌측 패딩 20px
- 현재 페이지: 배경 `#EBF2FF`, 텍스트 `#1D4ED8`, 좌측 `3px solid #2563EB`
- 비활성: 텍스트 `#5C5C5C`, 호버 시 배경 `#F3F2EF`

### 5.6 페이지 헤더 (모바일)

```
Cortex                         2026년 2월 27일 목요일
```

**스타일 규칙:**
- 높이: 56px
- 배경: `#FFFFFF`, 하단 테두리: `1px solid #E5E3DF`
- 앱명 "Cortex": Noto Serif KR, 20px, weight 700, `#1A1A1A`
- 날짜: 14px, `#5C5C5C`
- position: sticky, top: 0 (스크롤 시 고정)

### 5.7 날씨 인라인 카드 (TORONTO 채널 전용)

```
☁️ 현재 -3°C  최고 2°C / 최저 -8°C  흐리고 가끔 눈
```

**스타일 규칙:**
- 카드 내부 인라인 배너로 표시
- 배경: `#FFF7ED` (토론토 채널색)
- 아이콘 + 날씨 정보 가로 배치
- 폰트: 14px, weight 500

### 5.8 My Life OS 컨텍스트 힌트

```
💡 지난주 메모: "MSA 전환" 관련 아티클
```

**스타일 규칙:**
- 카드 내 AI 요약 아래 표시
- 배경: `#FFFBEB`, 보더: `1px solid #FDE68A`
- 폰트: 13px, `#92400E`
- 모서리: 6px
- 패딩: 6px 10px

### 5.9 로딩 스켈레톤

- 카드 높이와 동일한 뼈대 박스
- 배경: `#F3F2EF`, 애니메이션: `pulse` (Tailwind animate-pulse)
- 제목 영역: 너비 80%, 높이 20px
- 본문 영역: 너비 100%, 높이 40px
- 버튼 영역: 4개 균등 분배, 높이 36px

---

## 6. Tailwind CSS 설정

### 6.1 tailwind.config.ts 추가 설정

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 기본 색상
        canvas: '#F8F7F4',
        card: '#FFFFFF',
        surface: '#F3F2EF',
        'border-default': '#E5E3DF',
        'border-subtle': '#F0EFEC',

        // 텍스트 색상
        primary: '#1A1A1A',
        secondary: '#5C5C5C',
        muted: '#9E9E9E',

        // 채널 색상 (뱃지 배경)
        tech: {
          bg: '#EBF2FF',
          text: '#1D4ED8',
          accent: '#2563EB',
        },
        world: {
          bg: '#ECFDF5',
          text: '#065F46',
          accent: '#059669',
        },
        culture: {
          bg: '#F5F3FF',
          text: '#5B21B6',
          accent: '#7C3AED',
        },
        toronto: {
          bg: '#FFF7ED',
          text: '#C2410C',
          accent: '#EA580C',
        },
        serendipity: {
          bg: '#FFFBEB',
          text: '#92400E',
          accent: '#D97706',
        },

        // 시맨틱 색상
        success: '#059669',
        warning: '#D97706',
        error: '#DC2626',
        info: '#2563EB',
      },

      fontFamily: {
        display: ['Noto Serif KR', 'Georgia', 'serif'],
        body: ['Pretendard', 'SUIT', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Inter', 'Menlo', 'monospace'],
      },

      fontSize: {
        'display': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '700' }],
        'title': ['1.125rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.7' }],
        'body-md': ['1rem', { lineHeight: '1.7', fontWeight: '500' }],
        'small': ['0.875rem', { lineHeight: '1.6' }],
        'caption': ['0.75rem', { lineHeight: '1.5' }],
        'button': ['0.875rem', { lineHeight: '1', fontWeight: '500' }],
      },

      spacing: {
        '18': '4.5rem',   // 72px — 하단 탭 바 보정
        '14': '3.5rem',   // 56px — 헤더/탭 바 높이
      },

      maxWidth: {
        'reading': '640px',  // 읽기 모드 최대 너비
      },

      borderRadius: {
        'card': '12px',
        'badge': '6px',
        'button': '8px',
      },

      boxShadow: {
        'card': '0 1px 4px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.10)',
        'nav': '0 -1px 0 #E5E3DF',
      },
    },
  },
  plugins: [],
}

export default config
```

### 6.2 전역 CSS 기본 설정

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: 'Pretendard', 'SUIT', -apple-system, BlinkMacSystemFont, sans-serif;
    background-color: #F8F7F4;
    color: #1A1A1A;
    -webkit-text-size-adjust: 100%;
  }

  h1, h2, h3 {
    font-family: 'Noto Serif KR', Georgia, serif;
  }

  * {
    -webkit-tap-highlight-color: transparent;
  }
}

@layer utilities {
  .safe-bottom {
    padding-bottom: calc(72px + env(safe-area-inset-bottom));
  }
}
```

---

## 7. 인터랙션 패턴

### 7.1 피드백 버튼 낙관적 업데이트

1. 사용자가 버튼 탭
2. 즉시(0ms) 버튼 색상 변경 (활성 상태)
3. 비동기로 `/api/interactions` 호출
4. 성공: 유지 / 실패: 원상 복구 + 토스트 에러 메시지

### 7.2 카드 확장 (아이템 상세)

- 카드 탭 → `/item/[id]` 페이지 이동 (풀 페이지)
- 모바일: 슬라이드 업 애니메이션
- 데스크톱: 즉시 전환

### 7.3 스와이프 지원 (모바일, 히스토리 페이지)

- 날짜 카드 좌우 스와이프로 이전/다음 날짜 이동
- `touch-action: pan-y`로 수직 스크롤과 충돌 방지

### 7.4 로딩 상태

- 초기 로딩: 카드 3개 스켈레톤 (animate-pulse)
- 새로 고침: 기존 카드 유지 + 상단 로딩 인디케이터
- 피드백 저장 중: 버튼 불투명도 0.7 + 로딩 스피너 미표시 (낙관적 업데이트)

### 7.5 에러 상태

- 브리핑 없음: 빈 상태 메시지 + "어제 브리핑 보기" 링크
- API 오류: 카드 대신 에러 배너 (재시도 버튼 포함)

---

## 8. 접근성 기준

| 항목 | 기준 |
|------|------|
| 색상 대비 | WCAG AA — 일반 텍스트 4.5:1, 큰 텍스트 3:1 이상 |
| 터치 타겟 | 최소 44px × 44px |
| 포커스 표시 | 키보드 포커스 시 `outline: 2px solid #2563EB` |
| 이미지 대체 | 아이콘에 `aria-label` 또는 `title` 제공 |
| 폰트 크기 | 최소 12px (캡션), 본문 16px 이상 |
| 색상만으로 상태 구분 금지 | 피드백 버튼 활성 상태에 아이콘 변화 + 색상 동시 변화 |

---

*Cortex Design System v1.0 | 2026-02-27*
