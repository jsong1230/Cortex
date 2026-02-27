# F-05 AI 요약/스코어링 -- 기술 설계서

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정

---

## 1. 참조

- 인수조건: `docs/project/features.md` #F-05
- 시스템 설계: `docs/system/system-design.md`
- API 컨벤션: `docs/system/api-conventions.md`
- DB ERD: `docs/system/erd.md`
- 원본 PRD: `docs/PRD_Cortex.md` (Claude API 비용/프롬프트 전략)
- 기존 스텁: `lib/summarizer.ts`, `lib/scoring.ts`
- 수집기 타입: `lib/collectors/types.ts` (`CollectedItem`)

## 2. 기능 개요

F-05는 F-01~F-04 수집기가 수집한 `CollectedItem[]`을 Claude API에 전달하여 다음 두 가지를 생성하는 기능이다.

1. **요약 생성 (AC1)**: 수집된 각 아이템에 대해 한국어 1~2줄 요약을 생성한다.
2. **채널별 스코어링 (AC2~AC5)**: 채널 특성에 맞는 관심도/중요도 점수를 산출한다.
3. **캐싱 (AC6)**: 동일 `source_url`에 대한 재요약을 방지한다.
4. **시간 제약 (AC7)**: 전체 수집-요약 파이프라인이 30분 이내에 완료된다.

### 2.1 데이터 흐름

```
[1] app/api/cron/collect/route.ts (Cron 06:30 트리거)
    |
    v
[2] lib/collectors/*-collector.ts  ->  CollectedItem[] (채널별 수집)
    |
    v
[3] content_items 테이블에 INSERT (source_url UNIQUE로 중복 방지)
    |
    v
[4] lib/summarizer.ts  ->  DB에서 summary_ai가 NULL인 아이템 조회
    |
    v
[5] Claude API 배치 호출 (채널별 5~10개 묶음)
    |                          |
    v                          v
[6] content_items.summary_ai   content_items.score_initial 업데이트
    + content_items.tags 업데이트
```

---

## 3. 아키텍처 결정

### 결정 1: 요약과 스코어링을 한 번의 Claude 호출로 통합할지

- **선택지**: A) 요약 호출과 스코어링 호출을 분리 / B) 하나의 프롬프트에서 요약 + 태그 + 점수를 동시 생성
- **결정**: B) 통합 호출
- **근거**: 비용 절감이 핵심이다. 동일한 아이템 컨텍스트를 두 번 보내는 것은 토큰 낭비다. 하나의 프롬프트에서 JSON 구조로 요약/태그/점수를 모두 반환받으면 API 호출 횟수가 절반으로 줄어든다.

### 결정 2: 배치 처리 단위

- **선택지**: A) 아이템 1개씩 개별 호출 / B) 채널별 묶어서 배치 호출 / C) 전체를 한 번에 보내기
- **결정**: B) 채널별 배치 호출 (5~10개씩)
- **근거**: A는 호출 횟수가 30~50회로 비용과 시간 모두 비효율적이다. C는 프롬프트 크기가 너무 커져 응답 품질이 떨어지고 토큰 제한에 걸릴 수 있다. B는 채널별 스코어링 기준이 다르므로 프롬프트를 채널에 맞게 특화할 수 있어 품질과 비용의 균형이 가장 좋다.

### 결정 3: WORLD 채널 선정 방식

- **선택지**: A) 수집 후 모든 아이템을 Claude에 보내서 선별 / B) 수집 단계에서 이미 필터링된 아이템만 요약
- **결정**: A) 수집된 WORLD 아이템 전체 헤드라인 목록을 Claude에 보내서 최대 2개를 선정
- **근거**: AC3의 "40~50대 직장인이 알아야 할 이슈" 기준은 사람의 판단에 가까워 AI 선별이 필요하다. 헤드라인 목록만 보내므로 토큰 비용도 최소화된다.

### 결정 4: TECH 채널 score_initial 계산 방식

- **선택지**: A) Claude API가 관심도 점수를 직접 반환 / B) Claude는 태그/토픽만 추출하고, 기존 interest_profile과 매칭하여 점수 계산
- **결정**: Phase 1 (현재) = A) Claude가 직접 점수 반환 / Phase 2 (향후) = B로 전환
- **근거**: AC2의 "관심도x0.6 + 컨텍스트x0.3 + 최신성x0.1" 가중치 공식은 Phase 2에서 EMA 학습 엔진(F-13)이 구현된 이후 본격적으로 적용된다. Phase 1에서는 interest_profile이 초기 상태이므로, Claude에게 사용자 관심 프로필 텍스트를 제공하고 관심도를 0.0~1.0으로 판단하게 한다. Phase 2에서는 Claude가 추출한 태그를 interest_profile의 EMA 점수와 매칭하여 정밀한 점수를 산출한다.

### 결정 5: 에러 폴백 전략

- **선택지**: A) Claude 실패 시 해당 아이템을 브리핑에서 제외 / B) 원본 title을 summary로, 기본 점수 0.5를 적용
- **결정**: B) 폴백 적용
- **근거**: 브리핑 품질이 다소 떨어지더라도 누락되는 것보다는 낫다. 1인 사용자이므로 폴백 아이템이 있어도 큰 문제가 되지 않는다.

---

## 4. 핵심 모듈 상세 설계

### 4.1 `lib/summarizer.ts` -- Claude API 통합 모듈

기존 스텁을 구현으로 전환한다. 이 파일이 Cortex에서 Claude API를 호출하는 유일한 진입점이다.

#### 4.1.1 타입 정의

```typescript
import type { Channel, CollectedItem } from './collectors/types';

/** 요약 + 스코어링 입력 (DB에서 조회한 아이템) */
export interface SummarizeInput {
  id: string;              // content_items.id (DB 업데이트용)
  title: string;
  fullText?: string;       // 처음 500자만 사용 (토큰 절약)
  source: string;
  channel: Channel;
  publishedAt?: Date;
}

/** 요약 + 스코어링 출력 (Claude 응답을 파싱한 결과) */
export interface SummarizeResult {
  id: string;              // content_items.id
  summaryAi: string;       // 1~2줄 한국어 요약
  tags: string[];          // AI 추출 토픽 태그 (최대 5개)
  scoreInitial: number;    // 초기 관심도 점수 (0.0~1.0)
  tokensUsed: number;      // 비용 추적용
}

/** Claude API 호출 통계 (로깅용) */
export interface SummarizeStats {
  totalItems: number;
  summarized: number;
  cached: number;          // 이미 요약이 있어 스킵한 수
  failed: number;
  totalTokensUsed: number;
  durationMs: number;
}

/** WORLD 채널 선정 결과 */
export interface WorldSelectionResult {
  selectedIndices: number[];  // 선정된 아이템의 인덱스 (원본 배열 기준)
  reason: string;             // 선정 이유 (로깅용)
  tokensUsed: number;
}
```

#### 4.1.2 공개 함수

| 함수 | 설명 | 호출 시점 |
|------|------|----------|
| `summarizeAndScore(items: SummarizeInput[])` | 채널별 배치 요약 + 스코어링 (메인 함수) | `cron/collect` 내부 |
| `selectWorldItems(headlines: {index: number; title: string}[])` | WORLD 채널 중요도 선정 | `cron/collect` 내부 (WORLD 수집 후) |

#### 4.1.3 `summarizeAndScore` 상세 흐름

```
1. 입력 아이템을 채널별로 그룹화
2. 채널별로 배치 프롬프트 생성 (채널 특화 스코어링 기준 포함)
3. Promise.allSettled로 채널별 Claude API 병렬 호출
4. 응답 JSON 파싱 → SummarizeResult[] 생성
5. 실패한 아이템은 폴백 적용 (title → summaryAi, scoreInitial = 0.5)
6. SummarizeStats 로깅 반환
```

#### 4.1.4 내부 함수 (private)

| 함수 | 설명 |
|------|------|
| `callClaudeAPI(prompt: string, systemPrompt: string)` | Claude Sonnet API 호출 래퍼 (재시도 1회 포함) |
| `buildBatchPrompt(items: SummarizeInput[], channel: Channel)` | 채널별 배치 프롬프트 텍스트 생성 |
| `parseClaudeResponse(response: string, items: SummarizeInput[])` | JSON 응답 파싱 + 유효성 검증 |
| `applyFallback(item: SummarizeInput)` | 에러 시 폴백 결과 생성 |
| `logUsage(stats: SummarizeStats)` | 토큰/비용 사용량 구조화 로깅 |

### 4.2 `lib/scoring.ts` -- 관심도 점수 계산 모듈

현재 Phase 1에서는 Claude가 직접 반환한 `scoreInitial` 값을 그대로 사용한다. Phase 2에서 EMA 학습 엔진(F-13)이 구현되면, 이 모듈이 `interest_profile` 기반 정밀 스코어링을 담당하게 된다.

#### 4.2.1 Phase 1 (현재): 기존 스텁 유지 + TECH 가중치 공식 준비

```typescript
/**
 * TECH 채널 최종 점수 계산 (Phase 2에서 활성화)
 * 공식: 관심도 x 0.6 + 컨텍스트 x 0.3 + 최신성 x 0.1
 *
 * Phase 1에서는 Claude가 반환한 scoreInitial을 그대로 사용하므로,
 * 이 함수는 scoreInitial을 그대로 반환한다.
 */
export function calculateTechScore(
  scoreInitial: number,
  _interestScore?: number,  // Phase 2: interest_profile 매칭 점수
  _contextScore?: number,   // Phase 3: keyword_contexts 매칭 점수
  _recencyScore?: number,   // published_at 기반 최신성 점수
): number {
  // Phase 1: Claude 직접 반환 점수 사용
  return scoreInitial;

  // Phase 2 활성화 시:
  // const interest = interestScore ?? scoreInitial;
  // const context = contextScore ?? 0;
  // const recency = recencyScore ?? 0.5;
  // return interest * 0.6 + context * 0.3 + recency * 0.1;
}
```

---

## 5. Claude API 프롬프트 설계

### 5.1 시스템 프롬프트 (공통)

```
당신은 Cortex라는 개인 AI 브리핑 서비스의 콘텐츠 분석 엔진입니다.
사용자는 50대 초반 CTO로, LLM 인프라/클라우드 비용 최적화/MSA/팀 빌딩/스타트업 전략에 관심이 있습니다.
개인 생활: 등산(주 2-3회), 골프(주 1회), 한국-캐나다 원격 가족 생활.

입력된 콘텐츠 아이템들을 분석하여, 각 아이템에 대해:
1. 한국어 1~2줄 요약 (핵심만 간결하게)
2. 토픽 태그 (영어, 최대 5개)
3. 관심도 점수 (0.0~1.0)
를 JSON 배열로 반환하세요.

규칙:
- 요약은 반드시 한국어로 작성
- 요약은 1~2문장, 80자 이내 권장
- 태그는 소문자 영어, 공백 대신 하이픈 사용 (예: "cloud-cost", "team-building")
- 점수는 소수점 1자리까지 (예: 0.7)
- 응답은 순수 JSON만 반환 (마크다운 코드블록 없이)
```

### 5.2 TECH 채널 배치 프롬프트

```
아래 기술 콘텐츠들을 분석하세요.

관심도 점수 기준:
- 사용자의 관심 분야(LLM, 클라우드, MSA, 팀빌딩, 스타트업)와의 관련성을 가장 높게 반영 (0.6)
- 실무 적용 가능성 (0.3)
- 최신성과 화제성 (0.1)

콘텐츠 목록:
[
  {"index": 0, "title": "...", "text": "..."},
  {"index": 1, "title": "...", "text": "..."},
  ...
]

응답 형식:
[
  {"index": 0, "summary": "...", "tags": ["llm", "cost-optimization"], "score": 0.8},
  ...
]
```

### 5.3 WORLD 채널 선정 프롬프트

```
아래 뉴스 헤드라인 목록에서, 오늘 한국의 40~50대 직장인이 "이건 알아야 한다"고 느낄 이슈 최대 2개를 선정하세요.

선정 기준:
- 일시적 가십이 아닌 중요한 구조적 변화
- 현재 대부분의 사람이 알고 있는 화제
- 정치 편향 없이 팩트 중심
- 동일 이슈가 여러 소스에서 반복 등장할수록 가중치 부여

헤드라인 목록:
[
  {"index": 0, "title": "...", "source": "naver_news"},
  {"index": 1, "title": "...", "source": "daum_news"},
  ...
]

응답 형식:
{"selected": [0, 5], "reason": "선정 이유 한 줄"}
```

### 5.4 WORLD 채널 요약 프롬프트

WORLD 채널은 선정된 아이템만 요약한다. 시스템 프롬프트는 공통과 동일하되, 점수는 고정 0.8 (선정된 아이템이므로 높은 점수).

### 5.5 CULTURE 채널 배치 프롬프트

```
아래 한국 문화/트렌드 콘텐츠들을 분석하세요.

관심도 점수 기준:
- 플랫폼 내 순위가 높을수록 높은 점수
- 검색량/조회수가 높을수록 높은 점수
- 세대를 아우르는 화제성 가중

콘텐츠 목록:
[...]

응답 형식: (TECH와 동일)
```

### 5.6 TORONTO 채널 배치 프롬프트

```
아래 토론토/캐나다 콘텐츠들을 분석하세요.

관심도 점수 기준:
- 토론토 거주 가족의 일상에 직접 영향을 미치는 정도
- 뉴스 중요도 (지역 사회 영향)
- 날씨 아이템은 항상 점수 0.9 (고정 포함 대상)

콘텐츠 목록:
[...]

응답 형식: (TECH와 동일)
```

---

## 6. 캐싱 전략

### 6.1 캐싱 로직 (AC6)

```
1. 수집기가 content_items에 INSERT 시도
2. source_url UNIQUE 제약으로 중복 INSERT 자동 방지
3. 요약 전 DB 조회: SELECT id, title, full_text, channel, source, published_at
                     FROM content_items
                     WHERE summary_ai IS NULL
                     AND collected_at >= NOW() - INTERVAL '24 hours'
4. summary_ai가 이미 있는 아이템은 Claude 호출에서 제외
```

### 6.2 캐싱 효과

- 같은 URL이 여러 수집 주기에 걸쳐 수집되어도 최초 1회만 요약한다.
- 이미 요약된 아이템은 `summarized` 통계에서 제외하고, `cached`로 카운트한다.
- 예상 일일 캐시 히트율: 약 10~15% (전날 수집된 아이템이 오늘도 존재하는 경우).

---

## 7. 에러 처리

### 7.1 Claude API 호출 실패 시 폴백

```typescript
// 폴백 로직 (callClaudeAPI 실패 시)
function applyFallback(item: SummarizeInput): SummarizeResult {
  return {
    id: item.id,
    summaryAi: item.title,       // 원본 제목을 요약으로 사용
    tags: [],                    // 태그 없음
    scoreInitial: 0.5,           // 기본 중간값
    tokensUsed: 0,
  };
}
```

### 7.2 에러 유형별 처리

| 에러 유형 | HTTP 상태 | 처리 방법 |
|-----------|----------|----------|
| Claude API 네트워크 에러 | - | 1회 재시도 (2초 대기) 후 폴백 |
| Claude API 429 (Rate Limit) | 429 | 5초 대기 후 1회 재시도, 실패 시 폴백 |
| Claude API 500/502 | 500/502 | 즉시 폴백 (서버 문제) |
| Claude 응답 JSON 파싱 실패 | - | 해당 배치 전체 폴백 |
| Claude 응답 일부 아이템 누락 | - | 누락된 아이템만 폴백, 나머지는 정상 처리 |
| DB 업데이트 실패 | - | 에러 로깅 후 계속 진행 (다음 Cron에서 재시도 가능) |

### 7.3 Claude API 재시도 전략

```typescript
async function callClaudeAPI(
  prompt: string,
  systemPrompt: string,
  retryCount = 0
): Promise<string> {
  const MAX_RETRIES = 1;
  const RETRY_DELAY_MS = 2000;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    // 텍스트 블록에서 응답 추출
    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude 응답에 텍스트 블록이 없습니다');
    }

    return textBlock.text;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return callClaudeAPI(prompt, systemPrompt, retryCount + 1);
    }
    throw error;
  }
}
```

---

## 8. 비용 관리

### 8.1 일일 Claude API 호출 예산

| 호출 유형 | 호출 횟수/일 | 입력 토큰 | 출력 토큰 | 예상 비용/일 |
|-----------|------------|----------|----------|------------|
| TECH 배치 요약 (10~15개) | 1~2회 | ~3,000 | ~1,500 | ~$0.03 |
| WORLD 선정 | 1회 | ~1,500 | ~200 | ~$0.01 |
| WORLD 요약 (2개) | 1회 | ~1,000 | ~500 | ~$0.01 |
| CULTURE 배치 요약 (10~12개) | 1~2회 | ~2,000 | ~1,200 | ~$0.02 |
| TORONTO 배치 요약 (5~7개) | 1회 | ~1,500 | ~800 | ~$0.02 |
| **합계** | **5~7회** | **~9,000** | **~4,200** | **~$0.09** |

> Claude Sonnet 기준 입력 $3/M, 출력 $15/M 적용. 일일 $0.10 수준으로 월 $3 이내.
> 예산 상한 $0.5/일 대비 충분한 여유가 있다.

### 8.2 토큰 절약 전략

1. **full_text 제한**: 처음 500자만 사용. 대부분의 뉴스/기사는 처음 500자에 핵심 내용 포함.
2. **배치 처리**: 채널별 묶음 호출로 시스템 프롬프트 반복 전송 최소화.
3. **캐싱**: 동일 URL 재요약 방지 (DB summary_ai 체크).
4. **채널별 프롬프트 최적화**: 불필요한 지시문 제거, 간결한 프롬프트.

### 8.3 비용 추적 로깅

```typescript
function logUsage(stats: SummarizeStats): void {
  // 구조화된 JSON 로깅 (Vercel Logs에서 검색 가능)
  console.info(JSON.stringify({
    event: 'cortex_summarize_complete',
    totalItems: stats.totalItems,
    summarized: stats.summarized,
    cached: stats.cached,
    failed: stats.failed,
    totalTokensUsed: stats.totalTokensUsed,
    estimatedCostUsd: (stats.totalTokensUsed / 1_000_000) * 9,  // 대략적 추정
    durationMs: stats.durationMs,
    timestamp: new Date().toISOString(),
  }));
}
```

---

## 9. DB 연동

### 9.1 요약 대상 아이템 조회

```sql
-- summary_ai가 NULL인 최근 24시간 수집 아이템 조회
SELECT id, title, full_text, channel, source, source_url, published_at
FROM content_items
WHERE summary_ai IS NULL
  AND collected_at >= NOW() - INTERVAL '24 hours'
ORDER BY channel, collected_at DESC;
```

### 9.2 요약 결과 업데이트

```sql
-- 개별 아이템 요약 결과 업데이트
UPDATE content_items
SET summary_ai = $1,
    tags = $2,
    score_initial = $3
WHERE id = $4;
```

### 9.3 DB 작업 단위

아이템별 개별 UPDATE를 사용한다. 배치 업데이트(VALUES + JOIN)도 가능하지만, 1인 사용자 규모(일 30~50건)에서는 개별 UPDATE가 코드 단순성과 에러 격리 면에서 유리하다.

---

## 10. `app/api/cron/collect/route.ts` 통합 흐름

기존 스텁을 아래 흐름으로 구현한다.

```typescript
export async function POST(request: NextRequest) {
  // 1. Cron Secret 인증
  if (!verifyCronSecret(request)) { ... }

  // 2. 채널별 수집기 병렬 실행 (기존 F-01~F-04 구현)
  const [techResult, worldResult, cultureResult, canadaResult] =
    await Promise.allSettled([
      techCollector.collect(),
      worldCollector.collect(),
      cultureCollector.collect(),
      torontoCollector.collect(),
    ]);

  // 3. 수집된 아이템을 content_items에 INSERT (중복 스킵)
  const insertedItems = await insertContentItems(allCollectedItems);

  // 4. WORLD 채널 선정 (Claude API)
  const worldSelection = await selectWorldItems(worldHeadlines);

  // 5. summary_ai가 NULL인 아이템 조회
  const unsummarizedItems = await getUnsummarizedItems();

  // 6. Claude API 배치 요약 + 스코어링 (F-05 핵심)
  const summarizeStats = await summarizeAndScore(unsummarizedItems);

  // 7. 결과 응답
  return NextResponse.json({ success: true, data: { ... } });
}
```

---

## 11. 성능 설계

### 11.1 30분 시간 제약 분석 (AC7)

| 단계 | 예상 소요 시간 | 비고 |
|------|-------------|------|
| 채널별 수집 (병렬) | 10~20초 | 외부 API/RSS 응답 시간 |
| DB INSERT | 2~5초 | 30~50건 개별 INSERT |
| Claude 배치 요약 (5~7회 호출, 병렬) | 30~60초 | 채널별 병렬 실행 |
| DB UPDATE | 2~5초 | 30~50건 개별 UPDATE |
| **합계** | **~90초** | 30분 이내 충분 |

### 11.2 Vercel 함수 타임아웃 대응

- Hobby 플랜: 60초 제한 -> 수집과 요약을 분리 필요 가능성
- **대응 방안**: `cron/collect` 내부에서 수집이 완료되면 즉시 DB에 저장하고, 요약은 별도 내부 호출 또는 동일 함수 후반부에서 처리. 타임아웃 위험 시 수집/요약을 2개 Cron으로 분리.
- Pro 플랜 전환 시: 300초 제한으로 여유 확보.

### 11.3 Claude API 병렬 호출 전략

채널별 배치를 `Promise.allSettled`로 병렬 실행하여 총 대기 시간을 최소화한다.

```typescript
// 4개 채널 배치를 병렬 호출 (가장 느린 채널 기준으로만 대기)
const [techBatch, worldBatch, cultureBatch, torontoBatch] =
  await Promise.allSettled([
    callClaudeAPI(buildBatchPrompt(techItems, 'tech'), systemPrompt),
    callClaudeAPI(buildBatchPrompt(worldItems, 'world'), systemPrompt),
    callClaudeAPI(buildBatchPrompt(cultureItems, 'culture'), systemPrompt),
    callClaudeAPI(buildBatchPrompt(torontoItems, 'canada'), systemPrompt),
  ]);
```

---

## 12. 시퀀스 흐름

### 12.1 정상 흐름 (Happy Path)

```
Vercel Cron (06:30)
  |
  v
POST /api/cron/collect
  |
  +---> [채널별 수집기 병렬 실행] ---> CollectedItem[][] 수집
  |
  +---> [Supabase INSERT] ---> content_items 저장 (중복 스킵)
  |
  +---> [WORLD 선정] ---> Claude API selectWorldItems()
  |
  +---> [Supabase SELECT] ---> summary_ai IS NULL인 아이템 조회
  |
  +---> [배치 요약] ---> Claude API summarizeAndScore() (채널별 병렬)
  |
  +---> [Supabase UPDATE] ---> summary_ai, tags, score_initial 저장
  |
  +---> Response: { collected, summarized, cached, errors }
```

### 12.2 Claude API 실패 흐름

```
Claude API 호출
  |
  +---> [에러 발생]
  |       |
  |       +---> 재시도 (1회, 2초 대기)
  |               |
  |               +---> [성공] ---> 정상 처리
  |               |
  |               +---> [재실패] ---> applyFallback()
  |                                    |
  |                                    +---> summary_ai = title
  |                                    +---> score_initial = 0.5
  |                                    +---> tags = []
  |
  +---> [나머지 채널 정상 계속 진행]
```

---

## 13. 영향 범위

### 수정 필요 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/summarizer.ts` | 스텁 -> 전체 구현 (배치 요약 + 스코어링 + WORLD 선정) |
| `lib/scoring.ts` | `calculateTechScore()` 함수 추가 (Phase 1은 pass-through) |
| `app/api/cron/collect/route.ts` | 수집 후 요약/스코어링 파이프라인 연결 |

### 신규 생성 파일

없음. 기존 스텁 파일에 구현을 채운다.

### 의존하는 기존 코드

| 파일 | 의존 방식 |
|------|----------|
| `lib/collectors/types.ts` | `Channel`, `CollectedItem` 타입 import |
| `lib/collectors/utils.ts` | `safeCollect` 패턴 참조 (에러 격리) |
| `lib/supabase/server.ts` | `createServerClient()` 사용 (DB 조회/업데이트) |

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-28 | 초기 설계서 작성 | F-05 기능 착수 |
