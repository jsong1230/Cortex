# F-10 웹 브리핑 히스토리 -- API 스펙

**버전**: 1.1 | **날짜**: 2026-02-28 | **상태**: 구현 완료
**구현 파일**: `app/api/briefings/route.ts`, `app/api/briefings/[date]/route.ts`, `app/api/saved/route.ts`, `app/api/saved/[contentId]/route.ts`

---

## 1. GET /api/briefings -- 브리핑 목록

### 1.1 개요

과거 브리핑 날짜 목록을 역순으로 조회한다. 각 항목에 날짜, 아이템 수, 포함 채널 정보를 반환한다.

### 1.2 요청

```http
GET /api/briefings?page=1&limit=20 HTTP/1.1
Cookie: sb-access-token=...
```

**인증**: Supabase Auth 세션 쿠키

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 기본값 | 제약 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 1 이상 정수 |
| `limit` | `number` | X | `20` | 1 이상 50 이하 |

### 1.3 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440010",
        "briefing_date": "2026-02-27",
        "item_count": 8,
        "channels": ["tech", "world", "culture", "canada", "serendipity"]
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440011",
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

### 1.4 에러 응답

**401 Unauthorized**
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

**400 Bad Request -- 파라미터 오류**
```json
{
  "success": false,
  "error": "page는 1 이상, limit는 1~50 범위의 정수여야 합니다",
  "errorCode": "INVALID_PARAMS"
}
```

### 1.5 응답 타입 정의

```typescript
interface BriefingListItem {
  id: string;
  briefing_date: string;   // YYYY-MM-DD
  item_count: number;
  channels: string[];       // 포함된 채널 목록 (중복 없음)
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

---

## 2. GET /api/briefings/[date] -- 날짜별 브리핑 상세

### 2.1 개요

특정 날짜(YYYY-MM-DD)의 브리핑을 조회한다. 응답 구조는 `GET /api/briefings/today`와 100% 동일하다.

### 2.2 요청

```http
GET /api/briefings/2026-02-27 HTTP/1.1
Cookie: sb-access-token=...
```

**인증**: Supabase Auth 세션 쿠키

### 2.3 성공 응답 (200)

`GET /api/briefings/today`와 동일한 구조:

```json
{
  "success": true,
  "data": {
    "briefing_id": "770e8400-e29b-41d4-a716-446655440010",
    "briefing_date": "2026-02-27",
    "items": [
      {
        "content_id": "550e8400-e29b-41d4-a716-446655440000",
        "position": 1,
        "channel": "tech",
        "title": "OpenAI, GPT-5 출시 임박",
        "summary_ai": "OpenAI가 GPT-5 모델 출시를 앞두고 있으며...",
        "source": "hackernews",
        "source_url": "https://news.ycombinator.com/item?id=12345",
        "reason": null,
        "user_interaction": "좋아요"
      }
    ]
  }
}
```

### 2.4 에러 응답

**400 Bad Request -- 날짜 형식 오류**
```json
{
  "success": false,
  "error": "날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 사용하세요",
  "errorCode": "INVALID_DATE_FORMAT"
}
```

**400 Bad Request -- 미래 날짜**
```json
{
  "success": false,
  "error": "미래 날짜의 브리핑은 조회할 수 없습니다",
  "errorCode": "FUTURE_DATE_NOT_ALLOWED"
}
```

**401 Unauthorized**
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

**404 Not Found**
```json
{
  "success": false,
  "error": "해당 날짜(2026-02-27)의 브리핑이 존재하지 않습니다",
  "errorCode": "BRIEFING_NOT_FOUND"
}
```

### 2.5 응답 타입 정의

```typescript
// F-08에서 정의된 기존 타입을 그대로 재사용
interface BriefingResponseItem {
  content_id: string;
  position: number;
  channel: 'tech' | 'world' | 'culture' | 'canada' | 'serendipity';
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  reason: string | null;
  user_interaction: string | null;
}

interface BriefingResponse {
  success: true;
  data: {
    briefing_id: string;
    briefing_date: string;
    items: BriefingResponseItem[];
  };
}
```

---

## 3. GET /api/saved -- 저장 아이템 목록

### 3.1 개요

사용자가 저장(북마크)한 콘텐츠 아이템을 저장일 역순으로 조회한다.

### 3.2 요청

```http
GET /api/saved?page=1&limit=20 HTTP/1.1
Cookie: sb-access-token=...
```

**인증**: Supabase Auth 세션 쿠키

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 기본값 | 제약 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 1 이상 정수 |
| `limit` | `number` | X | `20` | 1 이상 50 이하 |

### 3.3 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "content_id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "OpenAI, GPT-5 출시 임박",
        "summary_ai": "OpenAI가 GPT-5 모델 출시를 앞두고 있으며...",
        "source": "hackernews",
        "source_url": "https://news.ycombinator.com/item?id=12345",
        "channel": "tech",
        "saved_at": "2026-02-27T07:15:00+09:00"
      },
      {
        "content_id": "660e8400-e29b-41d4-a716-446655440001",
        "title": "토론토 폭설 경보",
        "summary_ai": "오늘 오후부터 내일 아침까지 20cm 이상의 폭설이 예상된다.",
        "source": "cbc",
        "source_url": "https://www.cbc.ca/news/toronto/...",
        "channel": "canada",
        "saved_at": "2026-02-26T08:30:00+09:00"
      }
    ],
    "total": 12,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### 3.4 에러 응답

**401 Unauthorized**
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

### 3.5 응답 타입 정의

```typescript
interface SavedItem {
  content_id: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  channel: string;
  saved_at: string;          // ISO 8601
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

---

## 4. DELETE /api/saved/[contentId] -- 저장 해제

### 4.1 개요

특정 콘텐츠 아이템의 저장(북마크)을 해제한다. user_interactions 테이블에서 해당 content_id의 `interaction='저장'` 레코드를 삭제한다.

### 4.2 요청

```http
DELETE /api/saved/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Cookie: sb-access-token=...
```

**인증**: Supabase Auth 세션 쿠키

### 4.3 성공 응답 (200)

```json
{
  "success": true
}
```

### 4.4 에러 응답

**401 Unauthorized**
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

**400 Bad Request -- UUID 형식 오류**
```json
{
  "success": false,
  "error": "contentId는 유효한 UUID여야 합니다",
  "errorCode": "INVALID_CONTENT_ID"
}
```

**404 Not Found -- 저장 기록 없음**
```json
{
  "success": false,
  "error": "해당 콘텐츠의 저장 기록이 없습니다",
  "errorCode": "SAVED_NOT_FOUND"
}
```

---

## 5. 구현 상세

### 5.1 브리핑 목록 쿼리 전략

단일 쿼리로 briefings 테이블 조회. items JSONB에서 채널 분포와 아이템 수는 서버 측 JavaScript에서 계산한다 (PostgreSQL JSONB 함수 사용보다 간단하고 데이터 규모가 작으므로 충분).

```typescript
const { data, count, error } = await supabase
  .from('briefings')
  .select('id, briefing_date, items', { count: 'exact' })
  .order('briefing_date', { ascending: false })
  .range(offset, offset + limit - 1);
```

### 5.2 저장 아이템 쿼리 전략

2-쿼리 패턴으로 N+1을 방지한다.

1단계: 저장 interaction 조회 (최신 기준, 중복 content_id 제거)
```typescript
const { data: savedInteractions, count } = await supabase
  .from('user_interactions')
  .select('content_id, created_at', { count: 'exact' })
  .eq('interaction', '저장')
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

2단계: content_items 일괄 조회
```typescript
const { data: contents } = await supabase
  .from('content_items')
  .select('id, title, summary_ai, source, source_url, channel')
  .in('id', contentIds);
```

### 5.3 공통 로직 (briefing-query.ts)

`app/api/briefings/today/route.ts`의 핵심 로직을 추출하여 [date] API와 공유한다.

```typescript
export async function getBriefingByDate(
  supabase: SupabaseClient,
  date: string
): Promise<{
  briefing_id: string;
  briefing_date: string;
  items: BriefingResponseItem[];
} | null>
```

### 5.4 인증 유틸리티

기존 `lib/supabase/auth.ts`의 `getAuthUser()` 함수를 모든 API에서 재사용한다.

---

## 6. 실제 구현 상세 (확정본)

### 6.1 GET /api/briefings 파라미터 검증 구현
- `Number.isInteger()` + `isNaN()` 조합으로 문자열 파라미터도 정확히 거부
- 기본값: page=1, limit=20

### 6.2 GET /api/briefings/[date] 날짜 검증 구현
- YYYY-MM-DD 정규식 검증 후 `new Date()` 생성으로 실제 유효성 확인 (2026-02-30 등 걸러냄)
- 미래 날짜 비교: `date > getTodayKST()` (문자열 비교, YYYY-MM-DD 형식이므로 정확)

### 6.3 GET /api/saved 중복 제거 구현
- Supabase `.range()` 쿼리로 페이지네이션 + 전체 카운트 동시 조회
- JavaScript 레벨에서 `Map`으로 content_id 중복 제거 (1인 사용자, 데이터 규모 작음)

### 6.4 DELETE /api/saved/[contentId] 구현
- UUID 정규식: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- `.delete().eq().eq().select('content_id')` 체인으로 삭제 후 deleted 건수 확인

### 6.5 공유 함수 (lib/queries/briefing-query.ts)
- `getBriefingByDate(supabase, date)` 함수로 today API + [date] API 코드 공유
- 반환 타입: `{ data: BriefingData; error: null } | { data: null; error: { code, message } }`

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-10 API 스펙 초안 작성 (설계 확정) |
| 2026-02-28 | F-10 API 구현 완료, 확정본으로 업데이트 |
