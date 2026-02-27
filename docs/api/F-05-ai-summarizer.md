# F-05 AI 요약/스코어링 — API 스펙 확정본

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정

---

## 개요

F-05는 수집된 콘텐츠 아이템에 대해 Claude API를 통해 한국어 요약과 관심도 점수를 생성하는 내부 라이브러리 모듈이다. HTTP API 엔드포인트는 없으며, `lib/summarizer.ts`를 통해 `app/api/cron/collect/route.ts`에서 호출된다.

---

## 공개 함수 인터페이스

### `summarizeAndScore(items: SummarizeInput[]): Promise<SummarizeResult[]>`

채널별 배치 요약 + 스코어링 메인 함수. 입력 아이템을 채널별로 그룹핑하여 Claude API에 병렬 호출한다.

#### 입력 타입: `SummarizeInput`

```typescript
interface SummarizeInput {
  id: string;          // content_items.id (DB 업데이트용)
  title: string;
  fullText?: string;   // 처음 500자만 사용 (토큰 절약)
  source: string;
  channel: Channel;    // 'tech' | 'world' | 'culture' | 'canada'
  publishedAt?: Date;
}
```

#### 출력 타입: `SummarizeResult`

```typescript
interface SummarizeResult {
  id: string;            // content_items.id
  summaryAi: string;     // 1~2줄 한국어 요약
  tags: string[];        // AI 추출 토픽 태그 (최대 5개)
  scoreInitial: number;  // 초기 관심도 점수 (0.0~1.0)
  tokensUsed: number;    // 비용 추적용 (성공 시 > 0, 폴백 시 = 0)
}
```

#### 동작 규칙

| 조건 | 동작 |
|------|------|
| 빈 배열 입력 | 즉시 `[]` 반환, Claude API 미호출 |
| `ANTHROPIC_API_KEY` 미설정 | `Error` throw |
| Claude API 실패 (재시도 1회 후) | 폴백: `summaryAi=title`, `scoreInitial=0.5`, `tags=[]` |
| Claude 응답 JSON 파싱 실패 | 해당 채널 배치 전체 폴백 |
| 응답에서 아이템 누락 | 누락 아이템만 폴백, 나머지 정상 처리 |
| `scoreInitial` 범위 초과 | `[0.0, 1.0]`으로 클램핑 |
| `fullText` 500자 초과 | 500자로 잘라서 Claude에 전달 |

---

### `selectWorldItems(headlines: {index: number; title: string}[]): Promise<WorldSelectionResult>`

WORLD 채널 헤드라인 목록에서 "40~50대 직장인이 알아야 할" 이슈 최대 2개를 선정한다.

#### 입력

```typescript
headlines: Array<{ index: number; title: string }>
```

#### 출력 타입: `WorldSelectionResult`

```typescript
interface WorldSelectionResult {
  selectedIndices: number[];  // 선정된 아이템의 원본 배열 인덱스 (최대 2개)
  reason: string;             // 선정 이유 (로깅용)
  tokensUsed: number;
}
```

#### 동작 규칙

| 조건 | 동작 |
|------|------|
| 빈 배열 입력 | `{ selectedIndices: [], reason: '헤드라인 없음', tokensUsed: 0 }` 반환 |
| Claude API 실패 | 수집 순서 기반 상위 2개 `[0, 1]` 폴백 반환 |

---

### `buildBatchPrompt(items: SummarizeInput[], channel: Channel): string`

채널별 배치 프롬프트 텍스트 생성 (테스트 가능하도록 공개 export).

#### 채널별 프롬프트 기준

| 채널 | 점수 기준 키워드 |
|------|----------------|
| `tech` | 관심도(0.6), 실무 적용(0.3), 최신성(0.1) |
| `world` | 40~50대 직장인 중요도, 화제성, 구조적 변화 |
| `culture` | 순위(0.5), 검색량(0.3), 화제성(0.2) |
| `canada` | 가족/토론토 일상 영향(0.6), 뉴스 중요도(0.3), 날씨 고정 0.9+(0.1) |

---

## 타입 정의

### `SummarizeStats` (내부 로깅용)

```typescript
interface SummarizeStats {
  totalItems: number;
  summarized: number;       // Claude 응답으로 요약된 아이템 수
  cached: number;           // DB에서 기존 요약이 있어 스킵된 수
  failed: number;           // 폴백 처리된 아이템 수
  totalTokensUsed: number;
  durationMs: number;
}
```

로깅 이벤트명: `cortex_summarize_complete` (Vercel Logs에서 검색 가능)

---

## Claude API 설정

| 항목 | 값 |
|------|-----|
| 모델 | `claude-sonnet-4-20250514` |
| max_tokens | 4096 |
| 재시도 횟수 | 최대 1회 |
| 재시도 대기 | 2초 (테스트 환경: 0초) |
| fullText 제한 | 500자 |

---

## 비용 추정

| 호출 유형 | 일 횟수 | 예상 비용/일 |
|-----------|--------|------------|
| TECH 배치 | 1~2회 | ~$0.03 |
| WORLD 선정 | 1회 | ~$0.01 |
| WORLD 요약 | 1회 | ~$0.01 |
| CULTURE 배치 | 1~2회 | ~$0.02 |
| TORONTO 배치 | 1회 | ~$0.02 |
| **합계** | **5~7회** | **~$0.09** |

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/summarizer.ts` | Claude API 호출 + 요약/스코어링 구현 |
| `lib/scoring.ts` | `calculateTechScore()` (Phase 1: pass-through) |
| `app/api/cron/collect/route.ts` | Cron 트리거 + 파이프라인 연결 |
| `lib/collectors/types.ts` | `Channel`, `CollectedItem` 타입 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-05 구현 완료 후 초기 확정본 작성 |
