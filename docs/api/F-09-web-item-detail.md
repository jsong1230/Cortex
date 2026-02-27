# F-09 웹 아이템 상세 -- API 스펙

**버전**: 1.1 | **날짜**: 2026-02-28 | **상태**: 구현 완료
**구현 파일**: `app/api/content/[id]/route.ts`

---

## 1. GET /api/content/[id]

### 1.1 개요

개별 콘텐츠 아이템의 상세 정보를 반환한다. AI 요약 전문, 소스/원문 링크, 태그, 수집 시간, 사용자 반응, 기존 메모, 브리핑 선정 이유, 관련 아이템(같은 토픽)을 포함한다.

### 1.2 요청

```http
GET /api/content/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Cookie: sb-access-token=...
```

**인증**: Supabase Auth 세션 쿠키 (`@supabase/ssr` 쿠키 기반)

**URL 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | `string (UUID)` | O | 콘텐츠 아이템 ID |

### 1.3 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "content_id": "550e8400-e29b-41d4-a716-446655440000",
    "channel": "tech",
    "title": "OpenAI, GPT-5 출시 임박",
    "summary_ai": "OpenAI가 GPT-5 모델 출시를 앞두고 있으며, 멀티모달 성능이 대폭 향상될 것으로 알려졌다. 특히 코드 생성, 수학적 추론, 장문 분석 능력에서 큰 폭의 개선이 예상된다.",
    "source": "hackernews",
    "source_url": "https://news.ycombinator.com/item?id=12345",
    "tags": ["LLM", "GPT-5", "OpenAI", "AI"],
    "collected_at": "2026-02-28T06:30:00+09:00",
    "reason": "지난주 메모: LLM 관련 아티클 포함",
    "briefing_id": "770e8400-e29b-41d4-a716-446655440002",
    "user_interaction": "좋아요",
    "memo_text": "다음주 팀 미팅에서 논의해볼 것",
    "related_items": [
      {
        "content_id": "660e8400-e29b-41d4-a716-446655440001",
        "channel": "tech",
        "title": "Claude 3.5 Sonnet 벤치마크 결과",
        "summary_ai": "Anthropic의 Claude 3.5 Sonnet이 주요 벤치마크에서 GPT-4o를 상회하는 성능을 기록했다.",
        "source": "hackernews",
        "source_url": "https://news.ycombinator.com/item?id=67890"
      },
      {
        "content_id": "770e8400-e29b-41d4-a716-446655440003",
        "channel": "tech",
        "title": "Google Gemini 2.0 발표",
        "summary_ai": "Google이 Gemini 2.0을 발표하며 멀티모달 AI 경쟁이 가속화되고 있다.",
        "source": "hackernews",
        "source_url": "https://news.ycombinator.com/item?id=11111"
      }
    ]
  }
}
```

### 1.4 에러 응답

**401 Unauthorized -- 세션 없음**
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

**400 Bad Request -- 잘못된 ID 형식**
```json
{
  "success": false,
  "error": "유효하지 않은 콘텐츠 ID 형식입니다",
  "errorCode": "INVALID_CONTENT_ID"
}
```

**404 Not Found -- 콘텐츠 없음**
```json
{
  "success": false,
  "error": "해당 콘텐츠를 찾을 수 없습니다",
  "errorCode": "CONTENT_NOT_FOUND"
}
```

**500 Internal Server Error -- DB 오류**
```json
{
  "success": false,
  "error": "콘텐츠 조회 중 오류가 발생했습니다"
}
```

### 1.5 응답 타입 정의

```typescript
interface RelatedItem {
  content_id: string;
  channel: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
}

interface ContentDetailData {
  content_id: string;
  channel: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  tags: string[] | null;
  collected_at: string;           // ISO 8601
  reason: string | null;          // briefings.items[].reason
  briefing_id: string | null;     // FeedbackButtons 전달용
  user_interaction: string | null;
  memo_text: string | null;       // 기존 메모 텍스트
  related_items: RelatedItem[];
}

interface ContentDetailResponse {
  success: true;
  data: ContentDetailData;
}
```

---

## 2. 메모 저장 (기존 API 재사용)

### 2.1 POST /api/interactions

F-08에서 구현된 기존 `/api/interactions` API를 그대로 사용한다.

**메모 저장 요청 예시**:
```http
POST /api/interactions HTTP/1.1
Cookie: sb-access-token=...
Content-Type: application/json

{
  "content_id": "550e8400-e29b-41d4-a716-446655440000",
  "briefing_id": "770e8400-e29b-41d4-a716-446655440002",
  "interaction": "메모",
  "memo_text": "다음주 팀 미팅에서 논의해볼 것",
  "source": "web"
}
```

**원문 링크 클릭 기록 요청 예시**:
```http
POST /api/interactions HTTP/1.1
Cookie: sb-access-token=...
Content-Type: application/json

{
  "content_id": "550e8400-e29b-41d4-a716-446655440000",
  "briefing_id": "770e8400-e29b-41d4-a716-446655440002",
  "interaction": "웹열기",
  "source": "web"
}
```

응답 형식은 F-08 API 스펙(`docs/api/F-08-web-briefing-viewer.md` 2장)과 동일하다.

---

## 3. 구현 상세

### 3.1 GET /api/content/[id] 쿼리 전략

4개 쿼리로 고정:

1. `content_items` 단건 조회 (PK)
2. `user_interactions` 반응 + 메모 조회 (content_id 기준)
3. `briefings` 최근 7일 조회 후 JS 필터 (reason 추출)
4. `content_items` 관련 아이템 조회 (tags overlap, LIMIT 5)

### 3.2 UUID 유효성 검증

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!UUID_REGEX.test(id)) {
  return NextResponse.json(
    { success: false, error: '유효하지 않은 콘텐츠 ID 형식입니다', errorCode: 'INVALID_CONTENT_ID' },
    { status: 400 }
  );
}
```

### 3.3 인증 유틸리티

`lib/supabase/auth.ts`의 `getAuthUser()` 함수를 F-08과 동일하게 사용한다.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-09 API 스펙 설계 확정본 작성 |
