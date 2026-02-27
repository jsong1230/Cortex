# F-10 웹 브리핑 히스토리 -- 기능 설계서

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**참조**: `docs/system/erd.md`, `docs/system/api-conventions.md`, `docs/system/design-system.md`, `docs/system/navigation.md`

---

## 1. 기능 개요

### 1.1 목적

`/history` 라우트에서 날짜별 과거 브리핑 목록과 저장(북마크)한 아이템 목록을 조회할 수 있는 히스토리 페이지를 구현한다. 사용자는 탭 전환으로 두 가지 뷰를 오갈 수 있으며, 특정 날짜의 브리핑을 선택하면 해당 일자의 브리핑 카드를 바로 확인할 수 있다.

### 1.2 인수조건 (features.md #F-10)

| ID | 조건 |
|----|------|
| AC1 | `/history` 라우트에서 날짜별 과거 브리핑 목록을 조회할 수 있다 |
| AC2 | 날짜 선택 시 해당 일자 브리핑 아이템이 표시된다 |
| AC3 | 저장(북마크)한 아이템만 필터링하여 볼 수 있다 |
| AC4 | 페이지네이션 또는 무한 스크롤을 지원한다 |

---

## 2. 아키텍처 결정

### 결정 1: 날짜별 히스토리 vs 저장 목록 뷰 전환 방식

- **선택지**: A) 탭 UI (상단 탭) / B) query parameter 필터 (`?filter=saved`) / C) 별도 라우트
- **결정**: A + B 병용. 탭 UI로 전환하되 URL에 `?tab=saved`를 반영하여 딥링크 가능
- **근거**: navigation.md에서 `?filter=saved` 패턴이 이미 정의되어 있다. 탭 UI는 모바일에서 직관적이며, URL 반영으로 뒤로가기/공유 시 상태 유지가 가능하다.

### 결정 2: 페이지네이션 방식

- **선택지**: A) offset 기반 페이지네이션 / B) cursor 기반 / C) 무한 스크롤
- **결정**: A) offset 기반 + "더 보기" 버튼 (load more)
- **근거**: api-conventions.md에서 offset 기반 페이지네이션 구조(`PaginatedResponse<T>`)가 이미 정의되어 있다. 1인 사용자로 데이터 규모가 작으므로(수백 건 이하) offset이 충분하다. 무한 스크롤 대신 "더 보기" 버튼을 사용하여 사용자가 의도적으로 데이터를 로드하도록 한다.

### 결정 3: 날짜별 브리핑 상세 표시 방식

- **선택지**: A) 날짜 선택 시 같은 페이지 내 하단에 카드 표시 / B) `/?date=YYYY-MM-DD`로 메인 페이지 이동
- **결정**: A) 같은 페이지 내 인라인 표시
- **근거**: 히스토리 탐색 맥락을 유지하면서 빠른 전환이 가능하다. 날짜 목록과 카드를 동시에 보여주면 다른 날짜로의 전환이 용이하다. navigation.md에서 정의된 `/?date=YYYY-MM-DD` 패턴은 외부 링크 진입용으로 별도 지원한다.

### 결정 4: 저장 취소(unsave) 구현 방식

- **선택지**: A) 별도 DELETE API / B) 기존 POST /api/interactions 재활용 (토글)
- **결정**: A) `DELETE /api/saved/[contentId]` 별도 API
- **근거**: 저장 해제는 기존 interaction 레코드를 삭제(또는 비활성화)해야 하는 별도 동작이다. POST interactions는 새 레코드를 추가하는 용도이므로 의미적으로 DELETE가 적합하다.

---

## 3. API 설계

### 3.1 GET /api/briefings — 과거 브리핑 목록 (신규)

**목적**: 날짜 역순으로 과거 브리핑 목록 조회 (날짜, 아이템 수, 채널 요약)
**인증**: Supabase Auth 세션 (쿠키)
**파일**: `app/api/briefings/route.ts`

**Query Parameters**:

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | `number` | `1` | 페이지 번호 (1-based) |
| `limit` | `number` | `20` | 페이지당 아이템 수 (최대 50) |

**처리 순서**:
1. `getAuthUser()` 호출 -> 미인증 시 401
2. page, limit 쿼리 파라미터 파싱 및 검증
3. `briefings` 테이블에서 `briefing_date DESC` 정렬, offset/limit 페이지네이션
4. 전체 건수 카운트 (`count: 'exact'`)
5. 각 브리핑의 `items` JSONB에서 아이템 수와 채널 분포 계산
6. `PaginatedResponse` 형식으로 응답

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "briefing_date": "2026-02-27",
        "item_count": 8,
        "channels": ["tech", "world", "culture", "canada", "serendipity"]
      },
      {
        "id": "uuid",
        "briefing_date": "2026-02-26",
        "item_count": 7,
        "channels": ["tech", "world", "canada"]
      }
    ],
    "total": 45,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**응답 타입**:
```typescript
interface BriefingListItem {
  id: string;
  briefing_date: string;
  item_count: number;
  channels: string[];
}

interface BriefingListResponse {
  success: true;
  data: {
    items: BriefingListItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

**에러 케이스**:

| 코드 | 상황 | errorCode |
|------|------|-----------|
| 401 | 인증 없음 | `AUTH_REQUIRED` |
| 400 | page/limit 파라미터 유효하지 않음 | `INVALID_PARAMS` |
| 500 | DB 오류 | - |

---

### 3.2 GET /api/briefings/[date] — 특정 날짜 브리핑 (기존 stub 구현)

**목적**: 특정 날짜(YYYY-MM-DD)의 브리핑 상세 조회
**인증**: Supabase Auth 세션 (쿠키)
**파일**: `app/api/briefings/[date]/route.ts` (기존 stub 파일 수정)

**처리 순서**: `/api/briefings/today`와 동일한 패턴을 재사용하되, `getTodayKST()` 대신 URL 파라미터의 날짜를 사용한다.

1. `getAuthUser()` 호출 -> 미인증 시 401
2. 날짜 형식 검증 (YYYY-MM-DD, 이미 구현됨)
3. 날짜 유효성 검증 (미래 날짜 거부)
4. `briefings` 테이블에서 `briefing_date = date` 조회 (`.maybeSingle()`)
5. 브리핑 없으면 404 + `BRIEFING_NOT_FOUND`
6. `content_items` 일괄 조회 (IN)
7. `user_interactions` 일괄 조회 (IN)
8. 응답 조립 (today API와 동일한 `BriefingResponse` 형식)

**응답 형식**: `GET /api/briefings/today`와 100% 동일한 구조.

```typescript
// 기존 BriefingResponse 타입 그대로 재사용
interface BriefingResponse {
  success: true;
  data: {
    briefing_id: string;
    briefing_date: string;
    items: BriefingResponseItem[];
  };
}
```

**에러 케이스**:

| 코드 | 상황 | errorCode |
|------|------|-----------|
| 400 | 날짜 형식 잘못됨 | `INVALID_DATE_FORMAT` |
| 400 | 미래 날짜 요청 | `FUTURE_DATE_NOT_ALLOWED` |
| 401 | 인증 없음 | `AUTH_REQUIRED` |
| 404 | 해당 날짜 브리핑 없음 | `BRIEFING_NOT_FOUND` |
| 500 | DB 오류 | - |

---

### 3.3 GET /api/saved — 저장 아이템 목록 (신규)

**목적**: 사용자가 저장(북마크)한 콘텐츠 아이템 목록 조회
**인증**: Supabase Auth 세션 (쿠키)
**파일**: `app/api/saved/route.ts`

**Query Parameters**:

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | `number` | `1` | 페이지 번호 (1-based) |
| `limit` | `number` | `20` | 페이지당 아이템 수 (최대 50) |

**처리 순서**:
1. `getAuthUser()` 호출 -> 미인증 시 401
2. page, limit 쿼리 파라미터 파싱 및 검증
3. `user_interactions` 테이블에서 `interaction = '저장'` 필터, `created_at DESC` 정렬
4. 중복 제거: 동일 content_id에 대해 최신 저장만 포함 (DISTINCT ON)
5. 해당 content_id들로 `content_items` 일괄 조회
6. 각 아이템에 저장 시각 포함하여 응답

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "content_id": "uuid",
        "title": "OpenAI, GPT-5 출시 임박",
        "summary_ai": "OpenAI가 GPT-5 모델 출시를...",
        "source": "hackernews",
        "source_url": "https://...",
        "channel": "tech",
        "saved_at": "2026-02-27T07:15:00+09:00"
      }
    ],
    "total": 12,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

**응답 타입**:
```typescript
interface SavedItem {
  content_id: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  channel: string;
  saved_at: string;
}

interface SavedItemListResponse {
  success: true;
  data: {
    items: SavedItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

**에러 케이스**:

| 코드 | 상황 | errorCode |
|------|------|-----------|
| 401 | 인증 없음 | `AUTH_REQUIRED` |
| 500 | DB 오류 | - |

---

### 3.4 DELETE /api/saved/[contentId] — 저장 해제 (신규)

**목적**: 특정 콘텐츠의 저장(북마크)을 해제한다
**인증**: Supabase Auth 세션 (쿠키)
**파일**: `app/api/saved/[contentId]/route.ts`

**처리 순서**:
1. `getAuthUser()` 호출 -> 미인증 시 401
2. contentId UUID 형식 검증
3. `user_interactions` 테이블에서 `content_id = contentId AND interaction = '저장'` 조건으로 삭제
4. 삭제된 행이 없으면 404

**성공 응답 (200)**:
```json
{
  "success": true
}
```

**에러 케이스**:

| 코드 | 상황 | errorCode |
|------|------|-----------|
| 401 | 인증 없음 | `AUTH_REQUIRED` |
| 400 | contentId 형식 오류 | `INVALID_CONTENT_ID` |
| 404 | 저장 기록 없음 | `SAVED_NOT_FOUND` |
| 500 | DB 오류 | - |

---

## 4. 컴포넌트 설계

### 4.1 HistoryPage (라우트 컴포넌트)

**파일**: `app/(web)/history/page.tsx`

서버 컴포넌트로, metadata를 정의하고 `HistoryView` 클라이언트 컴포넌트를 렌더링한다.

```typescript
// 기존 placeholder 교체
export const metadata: Metadata = {
  title: 'Cortex -- 히스토리',
  description: '과거 브리핑과 저장 아이템 조회',
};

export default function HistoryPage() {
  return (
    <>
      <h1 style={{ /* display 폰트 스타일 */ }}>히스토리</h1>
      <HistoryView />
    </>
  );
}
```

### 4.2 HistoryView (탭 컨테이너)

**파일**: `components/history/HistoryView.tsx`
**타입**: 클라이언트 컴포넌트 (`'use client'`)

두 탭을 관리하는 컨테이너 컴포넌트.

| 속성 | 타입 | 설명 |
|------|------|------|
| (없음) | - | URL searchParams에서 초기 탭 결정 |

**내부 상태**:
- `activeTab`: `'history' | 'saved'` -- 현재 활성 탭
- URL의 `?tab=saved` 파라미터로 초기 탭 결정

**탭 스타일**:
- 탭 바: `border-bottom: 2px solid #E5E3DF`
- 활성 탭: 텍스트 `#1A1A1A`, 하단 `2px solid #2563EB`, 폰트 600
- 비활성 탭: 텍스트 `#9E9E9E`, 하단 보더 없음
- 각 탭 높이: 44px (터치 타겟)

**렌더링**:
```
[브리핑 히스토리] [저장 목록]
─────────────────────────────
{activeTab === 'history' ? <BriefingDateList /> : <SavedItemList />}
```

### 4.3 BriefingDateList (날짜별 히스토리)

**파일**: `components/history/BriefingDateList.tsx`
**타입**: 클라이언트 컴포넌트

과거 브리핑 날짜 목록을 표시하고, 날짜 선택 시 해당 브리핑 카드를 인라인으로 표시한다.

**내부 상태**:
- `briefings`: `BriefingListItem[]` -- 날짜 목록 데이터
- `loading`: `boolean` -- 목록 로딩 상태
- `error`: `string | null` -- 에러 메시지
- `hasMore`: `boolean` -- 추가 데이터 존재 여부
- `page`: `number` -- 현재 페이지
- `selectedDate`: `string | null` -- 선택된 날짜 (YYYY-MM-DD)
- `selectedBriefing`: `BriefingData | null` -- 선택된 날짜의 브리핑 상세
- `detailLoading`: `boolean` -- 상세 로딩 상태

**날짜 아이템 스타일**:
```
┌─────────────────────────────────────────┐
│ 2026.02.27 (목)                    8개   │
│ [TECH] [WORLD] [CULTURE] [TORONTO]      │
└─────────────────────────────────────────┘
```
- 배경: `#FFFFFF`, 테두리: `1px solid #E5E3DF`, 모서리: `12px`
- 선택된 날짜: 배경 `#EBF2FF`, 테두리 `1px solid #93C5FD`
- 날짜: 16px, weight 600, `#1A1A1A`
- 아이템 수: 14px, `#5C5C5C`
- 채널 뱃지: ChannelBadge 컴포넌트 재사용 (축소 버전)
- 아이템 간격: 8px
- 패딩: 12px 16px

**날짜 선택 시 동작**:
1. 선택된 날짜 상태 업데이트 (토글 가능)
2. `GET /api/briefings/[date]` 호출
3. 응답 데이터로 BriefingCard 목록 표시 (날짜 아이템 바로 아래)

**"더 보기" 버튼**:
- hasMore가 true일 때 목록 하단에 표시
- 높이 44px, 전체 너비, 배경 `#F3F2EF`, 텍스트 `#5C5C5C`
- 클릭 시 다음 페이지 로드 후 기존 목록에 append

### 4.4 SavedItemList (저장 목록)

**파일**: `components/history/SavedItemList.tsx`
**타입**: 클라이언트 컴포넌트

저장(북마크)한 아이템 목록을 표시하고 저장 해제 기능을 제공한다.

**내부 상태**:
- `savedItems`: `SavedItem[]` -- 저장 아이템 데이터
- `loading`: `boolean` -- 로딩 상태
- `error`: `string | null` -- 에러 메시지
- `hasMore`: `boolean` -- 추가 데이터 존재 여부
- `page`: `number` -- 현재 페이지

**저장 아이템 카드 스타일**:
```
┌─────────────────────────────────────────┐
│ [채널 뱃지]  소스명              [X 해제] │
│                                         │
│ 기사 제목 (2줄까지)                      │
│                                         │
│ AI 요약 텍스트 (1줄)                     │
│                                         │
│ 저장일: 2026.02.27                      │
└─────────────────────────────────────────┘
```
- BriefingCard 스타일 기반이지만 피드백 버튼 대신 저장 해제 버튼
- 저장 해제 버튼: 우측 상단, 44x44 터치 타겟, 아이콘 `X` 또는 `🔖` 활성 상태
- 저장일: 14px, `#9E9E9E`

**저장 해제 동작**:
1. 낙관적 업데이트: 즉시 목록에서 제거 (fade-out)
2. `DELETE /api/saved/[contentId]` 호출
3. 성공: 유지 / 실패: 목록에 복원 + 에러 메시지

**빈 상태**:
- "아직 저장한 아이템이 없습니다"
- "브리핑에서 🔖 저장 버튼을 눌러보세요"

---

## 5. 시퀀스 흐름

### 5.1 브리핑 히스토리 탭 -- 날짜 목록 조회

```
사용자 -> HistoryPage -> BriefingDateList -> GET /api/briefings?page=1&limit=20
                                                      |
                                              getAuthUser() 인증 검증
                                                      |
                                              briefings 테이블 조회
                                              (briefing_date DESC, offset/limit)
                                                      |
                                              BriefingListResponse 반환
                                                      |
                                          <- 날짜 목록 렌더링
```

### 5.2 날짜 선택 -- 브리핑 상세 조회

```
사용자 -> 날짜 카드 클릭 -> BriefingDateList -> GET /api/briefings/2026-02-27
                                                        |
                                                getAuthUser() 인증 검증
                                                        |
                                                briefings 조회 (maybeSingle)
                                                        |
                                                content_items IN 조회
                                                user_interactions IN 조회
                                                        |
                                                BriefingResponse 반환
                                                        |
                                            <- 선택 날짜 아래에 BriefingCard 목록 렌더링
```

### 5.3 저장 목록 탭 -- 저장 아이템 조회

```
사용자 -> 저장 목록 탭 -> SavedItemList -> GET /api/saved?page=1&limit=20
                                                  |
                                          getAuthUser() 인증 검증
                                                  |
                                          user_interactions (interaction='저장')
                                          DISTINCT ON (content_id) 조회
                                                  |
                                          content_items IN 조회
                                                  |
                                          SavedItemListResponse 반환
                                                  |
                                      <- 저장 아이템 카드 목록 렌더링
```

### 5.4 저장 해제

```
사용자 -> 해제 버튼 클릭 -> SavedItemList -> 낙관적으로 목록에서 제거
                                            |
                                    DELETE /api/saved/{contentId}
                                            |
                                    getAuthUser() 인증 검증
                                            |
                                    user_interactions DELETE
                                    (content_id, interaction='저장')
                                            |
                                    성공: 유지 / 실패: 복원
```

---

## 6. DB 쿼리 설계

### 6.1 브리핑 목록 조회 (날짜 역순, 페이지네이션)

```sql
SELECT id, briefing_date, items
FROM briefings
ORDER BY briefing_date DESC
LIMIT 20 OFFSET 0;
```

전체 건수:
```sql
SELECT COUNT(*) FROM briefings;
```

기존 인덱스 `idx_briefings_date` (briefing_date DESC)를 활용한다.

### 6.2 특정 날짜 브리핑 조회

```sql
-- today API와 동일한 쿼리 3종 (briefings -> content_items -> user_interactions)
SELECT id, briefing_date, items
FROM briefings
WHERE briefing_date = '2026-02-27'
LIMIT 1;
```

### 6.3 저장 아이템 조회 (중복 제거, 페이지네이션)

```sql
SELECT DISTINCT ON (content_id) content_id, created_at AS saved_at
FROM user_interactions
WHERE interaction = '저장'
ORDER BY content_id, created_at DESC;
```

위 결과에서 content_id 배열을 추출한 후:

```sql
SELECT id, title, summary_ai, source, source_url, channel
FROM content_items
WHERE id IN ('{content_id_1}', '{content_id_2}', ...);
```

기존 인덱스 `idx_interactions_type` (interaction)과 `idx_interactions_content` (content_id)를 활용한다.

### 6.4 저장 해제

```sql
DELETE FROM user_interactions
WHERE content_id = '{content_id}'
  AND interaction = '저장';
```

---

## 7. 영향 범위

### 수정 필요 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/api/briefings/[date]/route.ts` | 기존 stub(501)을 실제 구현으로 교체. today/route.ts 로직 재사용 |
| `app/(web)/history/page.tsx` | 기존 placeholder를 HistoryPage 구현으로 교체 |

### 신규 생성 파일

| 파일 | 설명 |
|------|------|
| `app/api/briefings/route.ts` | GET -- 브리핑 목록 API |
| `app/api/saved/route.ts` | GET -- 저장 아이템 목록 API |
| `app/api/saved/[contentId]/route.ts` | DELETE -- 저장 해제 API |
| `components/history/HistoryView.tsx` | 탭 컨테이너 컴포넌트 |
| `components/history/BriefingDateList.tsx` | 날짜별 히스토리 목록 |
| `components/history/SavedItemList.tsx` | 저장 아이템 목록 |

---

## 8. 성능 설계

### 8.1 인덱스 활용

기존 인덱스로 충분하며 새 인덱스 추가가 불필요하다.

| 쿼리 | 활용 인덱스 |
|------|------------|
| 브리핑 목록 (날짜 역순) | `idx_briefings_date` (briefing_date DESC) |
| 특정 날짜 브리핑 | `idx_briefings_date` + UNIQUE(briefing_date) |
| 저장 아이템 필터 | `idx_interactions_type` (interaction) |
| 콘텐츠 일괄 조회 | `content_items(id)` PK |

### 8.2 캐싱 전략

| 대상 | 캐싱 방식 | stale-time |
|------|----------|------------|
| 브리핑 목록 | 클라이언트 메모리 (state 유지) | 탭 전환 시 재요청 안함 |
| 특정 날짜 브리핑 | 클라이언트 메모리 (selectedBriefing) | 동일 날짜 재클릭 시 캐시 사용 |
| 저장 목록 | 클라이언트 메모리 | 탭 전환 시 재요청 (저장/해제 반영) |

### 8.3 N+1 방지

- 브리핑 목록: 단일 쿼리로 전체 조회
- 특정 날짜 브리핑: today API와 동일한 3-쿼리 패턴 (briefings -> content_items IN -> user_interactions IN)
- 저장 아이템: 2-쿼리 패턴 (user_interactions -> content_items IN)

---

## 9. 공유 로직 추출

### 9.1 briefing-query.ts (신규)

`app/api/briefings/today/route.ts`와 `app/api/briefings/[date]/route.ts`가 동일한 로직을 사용하므로, 공통 함수를 `lib/queries/briefing-query.ts`로 추출한다.

```typescript
// lib/queries/briefing-query.ts
// 브리핑 조회 공통 로직 (today + [date] API 공유)

/**
 * 특정 날짜의 브리핑 데이터를 조회하여 BriefingResponse 형태로 반환한다.
 * 브리핑이 없으면 null 반환.
 */
export async function getBriefingByDate(
  supabase: SupabaseClient,
  date: string
): Promise<BriefingData | null> {
  // 1. briefings 조회
  // 2. content_items IN 조회
  // 3. user_interactions IN 조회
  // 4. 응답 조립
}
```

이렇게 추출하면 today/route.ts도 리팩터링하여 `getBriefingByDate(supabase, getTodayKST())`를 호출하도록 변경할 수 있다.

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-28 | F-10 기능 설계서 초안 작성 | 히스토리 페이지 설계 |
