# F-08 웹 브리핑 뷰어 — API 스펙 확정본

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 구현 완료
**구현 파일**: `app/api/briefings/today/route.ts`, `app/api/interactions/route.ts`

---

## 1. GET /api/briefings/today

### 1.1 개요

오늘(KST 기준) 브리핑을 조회한다. 브리핑의 각 아이템에 content_items 상세 정보와 user_interactions 반응 정보를 포함하여 반환한다.

### 1.2 요청

```http
GET /api/briefings/today HTTP/1.1
Cookie: sb-access-token=...
```

**인증**: Supabase Auth 세션 쿠키 (`@supabase/ssr` 쿠키 기반)

### 1.3 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-02-28",
    "items": [
      {
        "content_id": "550e8400-e29b-41d4-a716-446655440000",
        "position": 1,
        "channel": "tech",
        "title": "OpenAI, GPT-5 출시 임박",
        "summary_ai": "OpenAI가 GPT-5 모델 출시를 앞두고 있으며, 멀티모달 성능이 대폭 향상될 것으로 알려졌다.",
        "source": "hackernews",
        "source_url": "https://news.ycombinator.com/item?id=12345",
        "reason": null,
        "user_interaction": null
      },
      {
        "content_id": "660e8400-e29b-41d4-a716-446655440001",
        "position": 2,
        "channel": "canada",
        "title": "토론토 폭설 경보",
        "summary_ai": "오늘 오후부터 내일 아침까지 20cm 이상의 폭설이 예상된다.",
        "source": "cbc",
        "source_url": "https://www.cbc.ca/news/toronto/...",
        "reason": "지난주 메모: 출퇴근 경로 관련 아티클 포함",
        "user_interaction": "좋아요"
      }
    ]
  }
}
```

### 1.4 에러 응답

**401 Unauthorized — 세션 없음**
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

**404 Not Found — 브리핑 없음**
```json
{
  "success": false,
  "error": "오늘(2026-02-28)의 브리핑이 아직 생성되지 않았습니다",
  "errorCode": "BRIEFING_NOT_FOUND"
}
```

**500 Internal Server Error — DB 오류**
```json
{
  "success": false,
  "error": "브리핑 조회 중 오류가 발생했습니다"
}
```

### 1.5 응답 타입 정의

```typescript
interface BriefingResponseItem {
  content_id: string;
  position: number;
  channel: 'tech' | 'world' | 'culture' | 'canada' | 'serendipity';
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  reason: string | null;         // My Life OS 연동 이유 (선택적)
  user_interaction: string | null; // 사용자 반응 (null이면 반응 없음)
}

interface BriefingResponse {
  success: true;
  data: {
    briefing_date: string; // YYYY-MM-DD
    items: BriefingResponseItem[];
  };
}
```

---

## 2. POST /api/interactions

### 2.1 개요

웹 대시보드에서 사용자 반응(좋아요/싫어요/저장/메모 등)을 저장한다.

### 2.2 요청

```http
POST /api/interactions HTTP/1.1
Cookie: sb-access-token=...
Content-Type: application/json

{
  "content_id": "550e8400-e29b-41d4-a716-446655440000",
  "briefing_id": "770e8400-e29b-41d4-a716-446655440002",
  "interaction": "좋아요",
  "source": "web"
}
```

**인증**: Supabase Auth 세션 쿠키

**요청 본문 필드**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `content_id` | `string (UUID)` | O | 콘텐츠 아이템 ID |
| `briefing_id` | `string (UUID)` | O | 브리핑 ID |
| `interaction` | `string` | O | 반응 타입 (아래 유효값 참조) |
| `memo_text` | `string` | X | 메모 텍스트 (interaction이 '메모'일 때만) |
| `source` | `'web'` | O | 반응 출처 (항상 'web') |

**유효한 interaction 값**: `좋아요`, `싫어요`, `저장`, `메모`, `웹열기`, `링크클릭`, `스킵`

**메모 반응 요청 예시**:
```json
{
  "content_id": "550e8400-e29b-41d4-a716-446655440000",
  "briefing_id": "770e8400-e29b-41d4-a716-446655440002",
  "interaction": "메모",
  "memo_text": "다음주 팀 미팅에서 논의해볼 것",
  "source": "web"
}
```

### 2.3 성공 응답 (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "interaction": "좋아요",
    "content_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 2.4 에러 응답

**401 Unauthorized**
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

**400 Bad Request — 유효성 검증 실패**
```json
{
  "success": false,
  "error": "interaction 필드는 '좋아요'|'싫어요'|'저장'|'메모'|'웹열기'|'링크클릭' 중 하나여야 합니다",
  "errorCode": "INTERACTION_INVALID_TYPE"
}
```

---

## 3. 구현 상세

### 3.1 GET /api/briefings/today 쿼리 전략

N+1 방지를 위해 3개 쿼리만 실행:

1. `briefings` 단건 조회 (`.maybeSingle()`)
2. `content_items` 배열 조회 (`IN` 조건)
3. `user_interactions` 배열 조회 (`IN` 조건)

items는 position 기준 오름차순 정렬 후 반환.

### 3.2 인증 유틸리티

`lib/supabase/auth.ts`의 `getAuthUser()` 함수:
- `@supabase/ssr`의 `createServerClient` 사용
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` + 쿠키로 인증
- 세션 없으면 `null` 반환

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-08 구현 완료 후 API 스펙 확정본 작성 |
