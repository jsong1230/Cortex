# F-18 API 스펙 — My Life OS 컨텍스트 연동

## 개요
My Life OS의 diary_entries / todos / notes에서 키워드를 추출해 keyword_contexts 테이블에 저장하고,
브리핑 아이템 큐레이션에 반영하는 컨텍스트 연동 기능.

---

## POST /api/context/sync

My Life OS 컨텍스트 동기화 (Cron 전용, CRON_SECRET 인증)

### 인증
```
Authorization: Bearer {CRON_SECRET}
```

### 요청
- Method: `POST`
- Body: 없음

### 응답 (200 OK — 동기화 성공)
```json
{
  "success": true,
  "data": {
    "synced": 3,
    "expired": 0
  }
}
```

### 응답 (200 OK — mylifeos_enabled=false로 스킵)
```json
{
  "success": true,
  "data": {
    "synced": 0,
    "expired": 0,
    "skipped_reason": "mylifeos_disabled"
  }
}
```

### 응답 (401 Unauthorized)
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 응답 (500 Internal Server Error)
```json
{
  "success": false,
  "error": "diary_entries 조회 실패: ..."
}
```

### 처리 흐름
1. `CRON_SECRET` Bearer 토큰 인증
2. `user_settings.mylifeos_enabled` 확인 → false이면 즉시 반환 (synced=0)
3. `syncKeywordContexts(supabase)` 호출:
   - diary_entries (최근 7일): Claude API로 키워드 추출 (AC1, AC6)
   - todos (미완료): 제목 토큰화 (AC2)
   - notes (최근 7일): 제목 토큰화 (AC2)
4. keyword_contexts 테이블에 upsert (source+source_id 기준, expires_at = +7일, AC3)
5. 만료된 키워드 컨텍스트 삭제 (expires_at < now)

### Cron 스케줄
- 매일 UTC 21:00 (KST 06:00) — 수집 cron 30분 전

---

## 내부 라이브러리 API (`lib/mylifeos.ts`)

### `extractDiaryKeywords(supabase)`
최근 7일 diary_entries에서 키워드 추출 (Claude API 사용, 원문 미저장 — AC6)

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| supabase | SupabaseClient | Supabase 클라이언트 (DI) |

반환: `Promise<KeywordExtractionResult[]>`

```typescript
interface KeywordExtractionResult {
  source: 'diary' | 'todo' | 'note';
  sourceId: string;
  keywords: string[];
}
```

특이사항:
- `ANTHROPIC_API_KEY` 미설정 시 빈 배열 반환 (graceful degradation)
- DB 오류 시 Error throw

### `extractTodoKeywords(supabase)`
미완료 todos에서 제목 키워드 추출 (AI 불필요, 단순 토큰화)

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| supabase | SupabaseClient | Supabase 클라이언트 (DI) |

반환: `Promise<KeywordExtractionResult[]>`

### `extractNoteKeywords(supabase)`
최근 7일 notes에서 제목 키워드 추출 (AI 불필요, 단순 토큰화)

### `syncKeywordContexts(supabase)`
메인 동기화 함수. diary + todo + note 추출 후 keyword_contexts upsert

반환:
```typescript
interface SyncResult {
  synced: number;  // upsert된 레코드 수
  expired: number; // 삭제된 만료 레코드 수 (현재 항상 0)
}
```

### `matchContentToKeywords(contentTags, keywordContexts)`
콘텐츠 태그와 키워드 컨텍스트 매칭. 매칭 이유 반환 (AC4)

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| contentTags | string[] | 콘텐츠 토픽 태그 |
| keywordContexts | KeywordContext[] | 활성 키워드 컨텍스트 목록 |

반환: `string | null`
- 매칭 시: `"지난주 메모: {키워드} 관련 아티클 포함"` 형식
- 미매칭 시: `null`
- 대소문자 무시 비교

### `calculateContextScore(contentTags, keywordContexts)`
컨텍스트 점수 계산 (0.0~1.0)

공식: `매칭된 태그 수 / 전체 태그 수`

### `getActiveKeywords(supabase)`
만료되지 않은 keyword_contexts 전체 조회
- DB 오류 시 빈 배열 반환 (graceful degradation)

---

## 브리핑 연동 (AC4)

`app/api/cron/send-briefing/route.ts`에서:

1. `getActiveKeywords(supabase)` 로 활성 컨텍스트 로드
2. tech 채널 아이템의 score_initial을 `calculateTechScore(initial, interest, context, recency)` 재계산
3. 아이템별 `matchContentToKeywords(tags, contexts)` 실행 → 이유 추가
4. 텔레그램 포맷에 `💡 {reason}` 줄 추가

### 포맷 예시 (평일 브리핑)
```
🖥️ TECH

1. <a href="...">LLM 인프라 최적화</a> — LLM 비용 절감 전략 (★8.5)
   💡 지난주 메모: LLM, cloud-cost 관련 아티클 포함
```
