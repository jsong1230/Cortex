# F-05 AI 요약/스코어링 -- 테스트 명세

**버전**: 1.0 | **날짜**: 2026-02-28

---

## 참조

- 설계서: `docs/specs/F-05-ai-summarizer/design.md`
- 인수조건: `docs/project/features.md` #F-05
- 테스트 프레임워크: vitest (단위), playwright (E2E)

---

## 단위 테스트

### 대상: `lib/summarizer.ts`

| # | 시나리오 | 입력 | 예상 결과 |
|---|----------|------|-----------|
| U-01 | TECH 아이템 배치 요약 성공 | `SummarizeInput[]` 3개 (channel='tech') | `SummarizeResult[]` 3개 반환, 각각 summaryAi(한국어), tags(배열), scoreInitial(0.0~1.0) |
| U-02 | WORLD 아이템 배치 요약 성공 | `SummarizeInput[]` 2개 (channel='world') | `SummarizeResult[]` 2개 반환, scoreInitial >= 0.7 |
| U-03 | CULTURE 아이템 배치 요약 성공 | `SummarizeInput[]` 5개 (channel='culture') | `SummarizeResult[]` 5개 반환, 각각 유효한 요약 |
| U-04 | TORONTO 아이템 배치 요약 성공 (날씨 포함) | `SummarizeInput[]` 3개 (channel='canada', 1개는 source='weather') | 날씨 아이템의 scoreInitial >= 0.9 |
| U-05 | 빈 배열 입력 | `SummarizeInput[]` 빈 배열 | 빈 `SummarizeResult[]` 반환, Claude API 호출 없음 |
| U-06 | fullText가 500자 초과인 아이템 | fullText 2000자 아이템 | Claude에 전달되는 텍스트가 500자로 잘림 |
| U-07 | fullText가 없는 아이템 (undefined) | fullText 없는 아이템 | title만으로 요약 생성 성공 |
| U-08 | Claude API 호출 실패 시 폴백 | Claude API mock이 에러 throw | summaryAi = title, scoreInitial = 0.5, tags = [] |
| U-09 | Claude API 1회 실패 후 재시도 성공 | 첫 호출 실패, 두 번째 성공 mock | 정상 SummarizeResult 반환 |
| U-10 | Claude 응답 JSON 파싱 실패 | 잘못된 JSON 문자열 반환 mock | 해당 배치 전체 폴백 적용 |
| U-11 | Claude 응답에서 일부 아이템 누락 | 5개 입력, 3개만 응답 mock | 누락된 2개만 폴백, 나머지 3개 정상 |
| U-12 | scoreInitial이 범위 밖인 경우 | Claude가 score: 1.5 반환 mock | 1.0으로 클램핑 |
| U-13 | scoreInitial이 음수인 경우 | Claude가 score: -0.3 반환 mock | 0.0으로 클램핑 |
| U-14 | 토큰 사용량 추적 | 정상 응답 mock | tokensUsed가 0보다 큰 값으로 기록됨 |
| U-15 | SummarizeStats 로깅 검증 | 10개 입력, 7개 성공, 3개 실패 | stats.summarized=7, stats.failed=3, stats.totalItems=10 |

### 대상: `lib/summarizer.ts` -- `selectWorldItems`

| # | 시나리오 | 입력 | 예상 결과 |
|---|----------|------|-----------|
| U-16 | WORLD 헤드라인에서 최대 2개 선정 | 10개 헤드라인 | selectedIndices 길이 <= 2 |
| U-17 | 헤드라인이 2개 이하인 경우 | 2개 헤드라인 | 최대 2개 선정 (입력 이하) |
| U-18 | 빈 헤드라인 목록 | 빈 배열 | selectedIndices = [], Claude 호출 없음 |
| U-19 | Claude 선정 실패 시 폴백 | Claude API 에러 mock | 상위 2개 인덱스 [0, 1] 반환 (수집 순서 기반 폴백) |

### 대상: `lib/scoring.ts`

| # | 시나리오 | 입력 | 예상 결과 |
|---|----------|------|-----------|
| U-20 | Phase 1 calculateTechScore pass-through | scoreInitial=0.7 | 0.7 그대로 반환 |
| U-21 | calculateTechScore 범위 검증 | scoreInitial=0.0 | 0.0 반환 |
| U-22 | calculateTechScore 범위 검증 | scoreInitial=1.0 | 1.0 반환 |

### 대상: `lib/summarizer.ts` -- 프롬프트 생성 (내부 함수)

| # | 시나리오 | 입력 | 예상 결과 |
|---|----------|------|-----------|
| U-23 | TECH 채널 프롬프트에 관심도 기준 포함 | channel='tech' | 프롬프트에 "관심도", "실무 적용", "최신성" 키워드 포함 |
| U-24 | CULTURE 채널 프롬프트에 트렌드 기준 포함 | channel='culture' | 프롬프트에 "순위", "검색량" 키워드 포함 |
| U-25 | TORONTO 채널 프롬프트에 가족 맥락 포함 | channel='canada' | 프롬프트에 "가족", "토론토" 키워드 포함 |
| U-26 | fullText 500자 잘림 확인 | 1000자 fullText | 프롬프트 내 텍스트가 500자로 제한됨 |

---

## 통합 테스트

### 대상: `app/api/cron/collect/route.ts` + `lib/summarizer.ts`

| # | API | 시나리오 | 입력 | 예상 결과 |
|---|-----|----------|------|-----------|
| I-01 | POST `/api/cron/collect` | 정상 수집 + 요약 흐름 (Claude 모킹) | Cron Secret 헤더 | 200, data.summarized > 0 |
| I-02 | POST `/api/cron/collect` | Cron Secret 미제공 | 인증 헤더 없음 | 401, error: 'Unauthorized' |
| I-03 | POST `/api/cron/collect` | 잘못된 Cron Secret | 틀린 Bearer 토큰 | 401 |
| I-04 | POST `/api/cron/collect` | 수집 성공 + 요약 전체 실패 | Claude API 전체 에러 mock | 200, data.summarized=0, data.errors에 CLAUDE_API_FAILED 포함 |
| I-05 | POST `/api/cron/collect` | 캐싱 동작 확인 | 이미 summary_ai가 있는 아이템 | data.cached > 0, 해당 아이템 Claude 미호출 |
| I-06 | POST `/api/cron/collect` | 중복 URL 스킵 | 이미 DB에 존재하는 source_url | data.duplicatesSkipped > 0 |
| I-07 | POST `/api/cron/collect` | 부분 채널 수집 실패 + 요약 | CULTURE 수집 실패 mock | 다른 채널 요약 정상 진행, errors에 culture 에러 포함 |

### 대상: DB 연동 흐름 (Supabase 모킹)

| # | 시나리오 | 동작 | 예상 결과 |
|---|----------|------|-----------|
| I-08 | 수집 -> DB INSERT -> 요약 -> DB UPDATE | 전체 파이프라인 (Supabase mock) | content_items에 summary_ai, tags, score_initial이 저장됨 |
| I-09 | summary_ai NULL 아이템만 요약 대상 | DB에 기존 요약된 아이템 + 새 아이템 | 새 아이템만 Claude API 호출 |
| I-10 | DB UPDATE 실패 시 에러 격리 | 특정 아이템 UPDATE 실패 mock | 나머지 아이템 UPDATE 정상 진행, 에러 로깅 |

---

## 경계 조건 / 에러 케이스

### Claude API 관련

- **대량 아이템**: 한 채널에서 20개 이상 아이템이 수집된 경우, 10개씩 2배치로 분할되는지 확인
- **토큰 제한 초과**: fullText가 매우 긴 아이템 여러 개가 한 배치에 포함된 경우, 프롬프트 총 크기가 적절히 제한되는지 확인
- **Claude 429 (Rate Limit)**: 5초 대기 후 재시도, 재실패 시 폴백 적용 확인
- **Claude 500 (Server Error)**: 즉시 폴백, 재시도 없음 확인
- **Claude 응답 지연**: 30초 이상 응답 지연 시 타임아웃 처리 확인

### 데이터 관련

- **title이 빈 문자열인 아이템**: 폴백 시 빈 summary 방지 (최소 "(제목 없음)" 처리)
- **한글/영어 혼합 제목**: 요약이 한국어로 생성되는지 확인
- **특수문자가 포함된 URL**: source_url의 특수문자가 DB UNIQUE 제약에 영향 없는지 확인
- **scoreInitial 범위 검증**: 모든 반환값이 0.0~1.0 범위 내인지 확인
- **tags 형식 검증**: 모든 태그가 소문자 영어 + 하이픈 형식인지 확인

### 성능 관련

- **전체 파이프라인 90초 이내 완료**: 수집(20초) + 요약(60초) + DB 작업(10초) 합산 시간 측정
- **Vercel 함수 타임아웃 (60초)**: 요약만 60초 초과하는 경우 대응 방안 검증

---

## 테스트 환경 설정

### Claude API 모킹 방법

```typescript
// vitest mock 설정
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// 성공 응답 mock
const mockClaudeResponse = {
  content: [{
    type: 'text' as const,
    text: JSON.stringify([
      { index: 0, summary: '테스트 요약입니다', tags: ['test'], score: 0.7 },
    ]),
  }],
  usage: { input_tokens: 500, output_tokens: 200 },
};
```

### Supabase 모킹 방법

```typescript
// Supabase 클라이언트 mock
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}));
```

---

## 테스트 파일 구조

```
tests/
  unit/
    summarizer.test.ts      # U-01 ~ U-26
    scoring.test.ts          # U-20 ~ U-22
  integration/
    cron-collect.test.ts     # I-01 ~ I-10
```

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-28 | 초기 테스트 명세 작성 | F-05 설계서 기반 |
