# F-05: AI 요약/스코어링 — 구현 계획

## 참조
- 설계서: docs/specs/F-05-ai-summarizer/design.md
- 인수조건: docs/project/features.md #F-05
- 테스트 명세: docs/specs/F-05-ai-summarizer/test-spec.md

## 태스크

### [backend] Phase 1: lib/summarizer.ts 핵심 구현

- [x] `lib/summarizer.ts` — 타입 정의: `SummarizeInput`, `SummarizeResult`, `SummarizeStats`, `WorldSelectionResult` 인터페이스 선언
- [x] `lib/summarizer.ts` — 내부 함수 `callClaudeAPI()`: claude-sonnet-4-20250514 호출 래퍼, 최대 1회 재시도 (2초 대기), 429 시 5초 대기 후 재시도
- [x] `lib/summarizer.ts` — 내부 함수 `buildBatchPrompt()`: 채널별(tech/world/culture/canada) 스코어링 기준이 포함된 배치 프롬프트 생성, fullText 500자 잘림 적용
- [x] `lib/summarizer.ts` — 내부 함수 `parseClaudeResponse()`: JSON 파싱 + scoreInitial 범위 클램핑(0.0~1.0) + 응답 누락 아이템 감지
- [x] `lib/summarizer.ts` — 내부 함수 `applyFallback()`: 실패 아이템에 `summaryAi=title`, `scoreInitial=0.5`, `tags=[]` 적용 (title 빈 문자열 시 "(제목 없음)" 처리)
- [x] `lib/summarizer.ts` — 내부 함수 `logUsage()`: `SummarizeStats`를 구조화 JSON으로 출력 (`event: 'cortex_summarize_complete'`, 토큰/비용/소요시간 포함)
- [x] `lib/summarizer.ts` — 공개 함수 `summarizeAndScore()`: 채널별 그룹화 → `Promise.allSettled` 병렬 호출 → 파싱 → 폴백 적용 → stats 반환
- [x] `lib/summarizer.ts` — 공개 함수 `selectWorldItems()`: WORLD 헤드라인 목록을 Claude에 전달하여 최대 2개 선정, 빈 배열 입력 시 API 미호출, 실패 시 상위 2개 인덱스([0, 1]) 폴백

### [backend] Phase 2: lib/scoring.ts 구현

- [x] `lib/scoring.ts` — `calculateTechScore()` 함수 구현: Phase 1은 `scoreInitial` pass-through 반환, Phase 2 전환용 주석 코드(가중치 공식 0.6/0.3/0.1) 포함

### [backend] Phase 3: app/api/cron/collect/route.ts 파이프라인 연결

- [x] `app/api/cron/collect/route.ts` — DB 조회 함수: `summary_ai IS NULL AND collected_at >= NOW() - INTERVAL '24 hours'` 조건으로 미요약 아이템 조회
- [x] `app/api/cron/collect/route.ts` — DB 업데이트 함수: `summary_ai`, `tags`, `score_initial` 개별 UPDATE, 실패 시 에러 로깅 후 계속 진행
- [x] `app/api/cron/collect/route.ts` — 수집 완료 후 파이프라인 연결: `selectWorldItems()` 호출 (WORLD 선정) → `summarizeAndScore()` 호출 → DB UPDATE → 응답 반환(`collected`, `summarized`, `cached`, `duplicatesSkipped`, `errors`)

### [backend] Phase 4: 테스트 작성

- [x] `tests/unit/summarizer.test.ts` — U-01~U-26: `summarizeAndScore` + `selectWorldItems` + 프롬프트 생성 단위 테스트 (Claude API + Supabase mock 사용)
- [x] `tests/unit/scoring.test.ts` — U-20~U-22: `calculateTechScore` 단위 테스트
- [x] `tests/integration/cron-collect.test.ts` — I-01~I-10: Cron 엔드포인트 통합 테스트

## 태스크 의존성

```
Phase 1 (summarizer.ts 구현)
  |
  +-- Phase 2 (scoring.ts 구현, 독립 실행 가능)
  |
  v
Phase 3 (cron collect 파이프라인 연결)
  |
  v
Phase 4 (테스트 작성 및 검증)
```

- Phase 1 내부 순서: 타입 정의 → 내부 함수 → 공개 함수 순으로 구현 (의존 관계)
- Phase 2는 Phase 1과 독립적으로 진행 가능 (scoring.ts는 summarizer.ts를 import하지 않음)
- Phase 3은 Phase 1 완료 후 진행 (summarizeAndScore, selectWorldItems 사용)
- Phase 4는 Phase 1~3 완료 후 검증 실행

## 병렬 실행 판단
- Agent Team 권장: No (프론트엔드 변경 없음)
- 근거: F-05는 백엔드 전용 구현이다. lib/summarizer.ts, lib/scoring.ts, app/api/cron/collect/route.ts 3개 파일이 순차 의존성을 가지므로 단일 에이전트가 처리하는 것이 효율적이다.
