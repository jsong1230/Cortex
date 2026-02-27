# F-13 학습 엔진 EMA 스코어링 — API 스펙 확정본

작성일: 2026-02-28
구현 상태: 완료

---

## 1. GET /api/profile/interests

관심사 프로필 전체 조회. 보관(archived_at IS NOT NULL) 항목 제외, score DESC 정렬.

### 인증
- Supabase Auth 세션 필수

### 요청
```
GET /api/profile/interests
```

### 응답 200 OK
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": "uuid",
        "topic": "AI",
        "score": 0.9,
        "interaction_count": 15,
        "last_updated": "2026-02-28T00:00:00Z",
        "archived_at": null
      }
    ],
    "total": 1
  }
}
```

### 응답 401 Unauthorized
```json
{
  "success": false,
  "error": "인증이 필요합니다",
  "errorCode": "AUTH_REQUIRED"
}
```

### 응답 500 Internal Server Error
```json
{
  "success": false,
  "error": "관심사 프로필 조회 중 오류가 발생했습니다"
}
```

---

## 2. POST /api/cron/archive-topics

저점수 토픽 자동 보관 cron (주 1회, 매주 일요일 03:00 UTC).
score <= 0.2 AND last_updated <= 3개월 전 AND archived_at IS NULL 조건에 해당하는 토픽에 archived_at을 설정한다.

### 인증
- Authorization: Bearer {CRON_SECRET}

### 요청
```
POST /api/cron/archive-topics
Authorization: Bearer {CRON_SECRET}
```

### 응답 200 OK — 보관 성공
```json
{
  "success": true,
  "data": {
    "archived_count": 3,
    "archived_topics": [
      { "topic": "OldTopic", "score": 0.1 },
      { "topic": "StaleTag", "score": 0.15 }
    ]
  }
}
```

### 응답 200 OK — 보관 대상 없음
```json
{
  "success": true,
  "data": {
    "archived_count": 0,
    "archived_topics": []
  }
}
```

### 응답 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## 3. POST /api/interactions (F-11 기존, F-13에서 학습 루프 추가)

기존 반응 저장 API에 학습 루프가 연결됨.
반응 저장 성공 후 비동기(fire-and-forget)로 아래 흐름 실행:
1. `content_items.tags` 조회
2. `extractTopicsFromTags()` → 유효 토픽 추출
3. `registerTopicsToProfile()` → 신규 토픽 등록
4. `updateInterestScore()` → EMA 점수 업데이트

학습 루프 실패는 반응 저장 응답에 영향을 주지 않음 (non-fatal, console.warn 로깅).

---

## 4. 내부 모듈 API

### `lib/scoring.ts`

#### `updateInterestScore(event: InteractionEvent): Promise<void>`
```typescript
interface InteractionEvent {
  contentId: string;
  interaction: string;  // InteractionType
  tags: string[];       // content_items.tags
}
```
- EMA 공식: `newScore = 0.3 * weight + 0.7 * currentScore`
- 점수 범위: 0.0 ~ 1.0 (클램핑)
- tags 빈 배열 시 즉시 반환 (no-op)

#### `calculateContentScore(tags, interestProfile): number`
- 태그별 관심도 점수 평균
- 프로필에 없는 태그: 기본값 0.5
- 태그 없음: 0.5 반환

#### `calculateTechScore(scoreInitial, interestScore?, contextScore?, recencyScore?): number`
- Phase 1 (interestScore 미제공): scoreInitial 그대로 반환
- Phase 2 (세 값 모두 제공): `interest*0.6 + context*0.3 + recency*0.1`

#### 상수
```typescript
EMA_ALPHA = 0.3
INTERACTION_WEIGHTS = {
  '좋아요': 1.0,
  '저장': 0.8,
  '메모': 0.8,
  '웹열기': 0.5,
  '링크클릭': 0.4,
  '스킵': -0.3,
  '싫어요': -0.8,
}
```

---

### `lib/embedding.ts`

#### `generateEmbedding(text: string): Promise<EmbeddingResult>`
```typescript
interface EmbeddingResult {
  embedding: number[];  // 1536 차원 (text-embedding-3-small)
  tokensUsed: number;
}
```
- OPENAI_API_KEY 미설정: `{ embedding: [], tokensUsed: 0 }` 반환 (graceful degradation)
- API 오류 / 네트워크 오류: 동일하게 빈 벡터 반환 (throw 금지)

#### `searchSimilar(embedding, tableName, limit?): Promise<string[]>`
```typescript
tableName: 'content_items' | 'interest_profile' | 'keyword_contexts'
```
- 빈 임베딩: 빈 배열 반환 (RPC 미호출)
- DB 오류: 빈 배열 반환 (graceful degradation)
- RPC 함수명: `search_content_by_embedding`, `search_interests_by_embedding`, `search_contexts_by_embedding`

---

### `lib/topic-extractor.ts`

#### `extractTopicsFromTags(tags: string[]): string[]`
- 빈 문자열 / 공백 제거
- 중복 제거 (Set 기반)
- trim 적용

#### `registerTopicsToProfile(topics: string[]): Promise<void>`
- 기존 토픽: 변경 없음 (score 유지)
- 신규 토픽: score=0.5, interaction_count=0 으로 등록
- 빈 배열: 즉시 반환 (no-op)
- DB 오류: throw
