# F-08 웹 브리핑 뷰어 — 기능 설계서

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**참조**: `docs/system/erd.md`, `docs/system/api-conventions.md`, `docs/system/design-system.md`, `docs/system/navigation.md`

---

## 1. 기능 개요

### 1.1 목적

텔레그램 브리핑의 웹 뷰어 인터페이스를 구현한다. 사용자가 `/` 라우트에 접근하면 오늘의 브리핑을 채널별 카드 형태로 조회하고, 피드백(좋아요/싫어요/저장/메모)을 즉시 남길 수 있다.

### 1.2 인수조건 (features.md #F-08)

| ID | 조건 |
|----|------|
| AC1 | `/` 라우트에서 오늘 브리핑을 채널별 카드 형태로 표시 |
| AC2 | 모바일 우선 1열 레이아웃으로 구현 |
| AC3 | 각 카드에 [채널 뱃지][소스][제목][1~2줄 AI 요약][피드백 버튼 행] 표시 |
| AC4 | 피드백 버튼(좋아요/싫어요/저장/메모) 탭 시 즉시 색상 변경(낙관적 업데이트) |
| AC5 | My Life OS 연동 시 이유 표시 아이콘이 카드에 포함 (선택적, reason 필드 있을 때만) |

---

## 2. 아키텍처 설계

### 2.1 데이터 흐름

```
브라우저(/) → BriefingCardList → GET /api/briefings/today
                                        ↓
                                Supabase Auth 검증
                                        ↓
                                briefings 테이블 (KST 오늘)
                                        ↓
                                items[].content_id → content_items JOIN
                                        ↓
                                user_interactions LEFT JOIN
                                        ↓
                                BriefingResponse 반환
```

### 2.2 컴포넌트 구조

```
app/(web)/layout.tsx         — AppShell (모바일 헤더 + 하단 탭 바 + 데스크톱 사이드바)
  components/layout/MobileHeader.tsx — 56px sticky 헤더
  components/layout/BottomNav.tsx    — 56px + safe-area 하단 탭
  components/layout/Sidebar.tsx      — 220px 데스크톱 사이드바

app/(web)/page.tsx            — 홈 페이지 (서버 컴포넌트)
  components/briefing/BriefingCardList.tsx — 데이터 페칭 + 상태 관리
    components/briefing/BriefingCard.tsx   — 개별 브리핑 카드
      components/briefing/ChannelBadge.tsx — 채널 뱃지
      components/briefing/FeedbackButtons.tsx — 피드백 버튼 행
```

### 2.3 인증 전략

- `lib/supabase/auth.ts` — 웹 API용 세션 검증 유틸리티
- `@supabase/ssr`의 `createServerClient` 사용 (쿠키 기반)
- 세션 없으면 401 반환

---

## 3. API 설계

### 3.1 GET /api/briefings/today

**인증**: Supabase Auth 세션 (쿠키)

**처리 순서**:
1. `createServerClient` (쿠키 기반)로 `supabase.auth.getUser()` 호출
2. 세션 없으면 401 반환
3. `getTodayKST()` (또는 `getKSTToday()`)로 오늘 날짜 계산
4. `briefings` 테이블에서 `briefing_date = today` 조회 (`.maybeSingle()`)
5. 브리핑 없으면 404 + `BRIEFING_NOT_FOUND` 반환
6. `items` JSONB에서 `content_id` 배열 추출
7. `content_items` 테이블에서 해당 아이템들 SELECT (필요 필드만)
8. `user_interactions` 테이블에서 해당 콘텐츠에 대한 반응 조회 (LEFT JOIN 효과)
9. 응답 조립 후 200 반환

**쿼리 최적화**:
- `content_items`: `id`, `title`, `summary_ai`, `source`, `source_url`, `tags` 만 SELECT
- `user_interactions`: `content_id`, `interaction` 만 SELECT (최신 1개)
- N+1 방지: content_id 배열로 `in(...)` 한 번에 조회

**응답 형식**:
```typescript
interface BriefingResponse {
  success: true;
  data: {
    briefing_date: string; // YYYY-MM-DD
    items: Array<{
      content_id: string;
      position: number;
      channel: 'tech' | 'world' | 'culture' | 'canada' | 'serendipity';
      title: string;
      summary_ai: string | null;
      source: string;
      source_url: string;
      reason: string | null;
      user_interaction: string | null;
    }>;
  };
}
```

---

## 4. 컴포넌트 설계

### 4.1 BriefingCard

| 속성 | 타입 | 설명 |
|------|------|------|
| `contentId` | `string` | 콘텐츠 UUID |
| `briefingId` | `string` | 브리핑 UUID |
| `channel` | `string` | 채널명 |
| `title` | `string` | 기사 제목 |
| `summaryAi` | `string \| null` | AI 요약 |
| `source` | `string` | 소스명 |
| `sourceUrl` | `string` | 원본 URL |
| `reason` | `string \| null` | My Life OS 연동 이유 |
| `userInteraction` | `string \| null` | 현재 반응 |

**스타일**:
- 배경: `#FFFFFF`, 테두리: `1px solid #E5E3DF`, 모서리: `12px`
- 그림자: `0 1px 4px rgba(0,0,0,0.06)`
- 채널별 왼쪽 보더: `4px solid {채널 포인트색}`
- 패딩: `16px` (모바일), `20px` (데스크톱)
- 카드 간격: `12px`

### 4.2 ChannelBadge

| 채널 | 뱃지 배경 | 뱃지 텍스트 | 포인트색 |
|------|----------|------------|---------|
| tech | `#EBF2FF` | `#1D4ED8` | `#2563EB` |
| world | `#ECFDF5` | `#065F46` | `#059669` |
| culture | `#F5F3FF` | `#5B21B6` | `#7C3AED` |
| canada | `#FFF7ED` | `#C2410C` | `#EA580C` |
| serendipity | `#FFFBEB` | `#92400E` | `#D97706` |

**스타일**: 패딩 `4px 10px`, 모서리 `6px`, 폰트 `12px 600`

### 4.3 FeedbackButtons

| 버튼 | interaction 값 | 활성 배경 | 활성 아이콘 |
|------|---------------|----------|------------|
| 좋아요 | `좋아요` | `#DBEAFE` | `#2563EB` |
| 싫어요 | `싫어요` | `#FEE2E2` | `#DC2626` |
| 저장 | `저장` | `#FEF3C7` | `#D97706` |
| 메모 | `메모` | `#F5F3FF` | `#7C3AED` |

**낙관적 업데이트 흐름**:
1. 탭 즉시(0ms) 상태 업데이트
2. `POST /api/interactions` 비동기 호출
3. 성공: 유지 / 실패: 원상 복구

**API 페이로드**:
```json
{ "content_id": "uuid", "briefing_id": "uuid", "interaction": "좋아요", "source": "web" }
```

### 4.4 BriefingCardList

**상태**:
- `loading`: 스켈레톤 3개 (animate-pulse)
- `error`: 에러 배너 + 재시도 버튼
- `empty`: "아직 오늘의 브리핑이 없습니다" 메시지
- `success`: BriefingCard 목록

### 4.5 MobileHeader

- 높이: `56px`, `sticky top-0`
- 좌: "Cortex" (Noto Serif KR, 20px, 700)
- 우: 오늘 날짜 (14px, `#5C5C5C`)

### 4.6 BottomNav

- 높이: `56px` + `env(safe-area-inset-bottom)`
- 4개 탭: 홈(`/`), 히스토리(`/history`), 프로필(`/profile`), 설정(`/settings`)
- 현재 탭: `#2563EB`, 비활성: `#9E9E9E`

### 4.7 Sidebar (데스크톱)

- 너비: `220px`, `lg` 이상에서만 표시
- 메뉴 항목 높이: `44px`
- 현재 페이지: `bg #EBF2FF`, `text #1D4ED8`, `border-left 3px solid #2563EB`
- 비활성: `text #5C5C5C`, 호버 `bg #F3F2EF`

---

## 5. DB 쿼리 설계

### 5.1 오늘 브리핑 조회

```sql
SELECT id, briefing_date, items
FROM briefings
WHERE briefing_date = '{today_kst}'
LIMIT 1;
```

### 5.2 콘텐츠 아이템 일괄 조회 (N+1 방지)

```sql
SELECT id, title, summary_ai, source, source_url, tags
FROM content_items
WHERE id IN ('{content_id_1}', '{content_id_2}', ...);
```

### 5.3 사용자 반응 일괄 조회

```sql
SELECT DISTINCT ON (content_id) content_id, interaction
FROM user_interactions
WHERE content_id IN ('{content_id_1}', ...)
  AND source = 'web'
ORDER BY content_id, created_at DESC;
```

---

## 6. 인증 유틸리티 설계 (lib/supabase/auth.ts)

```typescript
// @supabase/ssr의 createServerClient를 쿠키 기반으로 초기화
// getAuthUser(): 세션 검증 후 User 반환, 실패 시 null
```

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` 사용
- `cookies()` (next/headers)로 쿠키 읽기/쓰기

---

## 7. 성능 고려사항

| 항목 | 대책 |
|------|------|
| N+1 쿼리 | content_id 배열로 `in(...)` 한 번에 조회 |
| 불필요한 컬럼 | `SELECT *` 대신 필요 필드만 명시 |
| 캐싱 | 브리핑은 하루 1번 생성되므로 클라이언트 stale-time 5분 적용 |
| 초기 로딩 | 스켈레톤 UI로 CLS 방지 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-08 기능 설계서 초안 작성 |
