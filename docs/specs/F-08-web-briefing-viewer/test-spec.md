# F-08 웹 브리핑 뷰어 — 테스트 명세

**버전**: 1.0 | **날짜**: 2026-02-28 | **참조**: design.md, features.md #F-08

---

## 1. 테스트 범위

| 파일 | 타입 | 대상 |
|------|------|------|
| `tests/unit/components/briefing-card.test.tsx` | 단위 | BriefingCard, ChannelBadge 렌더링 |
| `tests/unit/components/feedback-buttons.test.tsx` | 단위 | FeedbackButtons 낙관적 업데이트 |
| `tests/unit/api/briefings-today.test.ts` | 단위 | GET /api/briefings/today |
| `tests/integration/web-briefing.test.ts` | 통합 | 전체 브리핑 조회 흐름 |

---

## 2. 단위 테스트: BriefingCard (briefing-card.test.tsx)

### U-08-01: BriefingCard 기본 렌더링 (AC3)

| ID | 테스트 케이스 | 기대 결과 |
|----|-------------|----------|
| U-08-01-1 | 제목이 렌더링된다 | `[data-testid="briefing-title"]` 내 제목 텍스트 존재 |
| U-08-01-2 | AI 요약이 렌더링된다 | `[data-testid="briefing-summary"]` 내 요약 텍스트 존재 |
| U-08-01-3 | 소스명이 렌더링된다 | 소스 텍스트가 DOM에 존재 |
| U-08-01-4 | sourceUrl이 링크로 렌더링된다 | `<a href={sourceUrl}>` 존재 |
| U-08-01-5 | summaryAi가 null이면 요약 영역이 렌더링되지 않는다 | `.summary` 요소 미존재 |

### U-08-02: ChannelBadge 채널별 색상 (AC3)

| ID | 테스트 케이스 | 기대 결과 |
|----|-------------|----------|
| U-08-02-1 | `tech` 채널 뱃지가 올바른 텍스트를 표시한다 | "TECH" 텍스트 존재 |
| U-08-02-2 | `world` 채널 뱃지가 올바른 텍스트를 표시한다 | "WORLD" 텍스트 존재 |
| U-08-02-3 | `culture` 채널 뱃지가 올바른 텍스트를 표시한다 | "CULTURE" 텍스트 존재 |
| U-08-02-4 | `canada` 채널 뱃지가 올바른 텍스트를 표시한다 | "TORONTO" 텍스트 존재 |
| U-08-02-5 | `serendipity` 채널 뱃지가 올바른 텍스트를 표시한다 | "세렌디피티" 텍스트 존재 |
| U-08-02-6 | 알 수 없는 채널은 fallback 스타일로 표시된다 | 채널명 대문자 존재 |

### U-08-03: reason 필드 (AC5)

| ID | 테스트 케이스 | 기대 결과 |
|----|-------------|----------|
| U-08-03-1 | reason이 있으면 💡 힌트가 표시된다 | `[data-testid="reason-hint"]` 존재 |
| U-08-03-2 | reason이 null이면 힌트 영역이 렌더링되지 않는다 | 힌트 요소 미존재 |

### U-08-04: FeedbackButtons (briefing-card.test.tsx에 포함)

| ID | 테스트 케이스 | 기대 결과 |
|----|-------------|----------|
| U-08-04-1 | 4개 피드백 버튼이 모두 렌더링된다 | 좋아요, 싫어요, 저장, 메모 버튼 존재 |
| U-08-04-2 | 터치 타겟이 44px 이상이다 | 버튼 높이 ≥ 44px (aria 속성으로 검증) |

---

## 3. 단위 테스트: FeedbackButtons (feedback-buttons.test.tsx)

### U-08-05: 낙관적 업데이트 (AC4)

| ID | 테스트 케이스 | 기대 결과 |
|----|-------------|----------|
| U-08-05-1 | 좋아요 버튼 클릭 시 즉시 활성 스타일로 변경된다 | 클릭 후 즉시 활성 클래스 적용 |
| U-08-05-2 | 싫어요 버튼 클릭 시 즉시 활성 스타일로 변경된다 | 클릭 후 즉시 활성 클래스 적용 |
| U-08-05-3 | 저장 버튼 클릭 시 즉시 활성 스타일로 변경된다 | 클릭 후 즉시 활성 클래스 적용 |
| U-08-05-4 | 메모 버튼 클릭 시 즉시 활성 스타일로 변경된다 | 클릭 후 즉시 활성 클래스 적용 |
| U-08-05-5 | 버튼 클릭 시 /api/interactions POST가 호출된다 | fetch가 올바른 payload로 호출됨 |
| U-08-05-6 | API 실패 시 원상 복구된다 | 에러 후 이전 상태로 복귀 |
| U-08-05-7 | 이미 같은 반응이 있으면 토글(취소)된다 | 재클릭 시 비활성 상태로 변경 |
| U-08-05-8 | currentInteraction이 있으면 해당 버튼이 활성 상태로 초기 렌더링된다 | 초기 활성 클래스 존재 |

---

## 4. 단위 테스트: API Route (briefings-today.test.ts)

### U-08-06: 인증 (AC1)

| ID | 테스트 케이스 | 기대 결과 |
|----|-------------|----------|
| U-08-06-1 | 세션 없으면 401을 반환한다 | `{ success: false }` + 401 |
| U-08-06-2 | 유효한 세션이면 요청을 처리한다 | 401 아닌 응답 |

### U-08-07: 브리핑 조회

| ID | 테스트 케이스 | 기대 결과 |
|----|-------------|----------|
| U-08-07-1 | 오늘 브리핑이 있으면 200과 items를 반환한다 | `{ success: true, data: { briefing_date, items } }` |
| U-08-07-2 | 오늘 브리핑이 없으면 404와 BRIEFING_NOT_FOUND를 반환한다 | `{ success: false, errorCode: 'BRIEFING_NOT_FOUND' }` + 404 |
| U-08-07-3 | content_items 정보가 items에 포함된다 | `items[0].title`, `items[0].summary_ai` 존재 |
| U-08-07-4 | user_interaction 정보가 items에 포함된다 | `items[0].user_interaction` 필드 존재 (null 가능) |
| U-08-07-5 | reason 필드가 items에 포함된다 | `items[0].reason` 필드 존재 (null 가능) |

---

## 5. 통합 테스트: 전체 흐름 (web-briefing.test.ts)

### I-08-01: 브리핑 조회 전체 흐름

| ID | 테스트 케이스 | 기대 결과 |
|----|-------------|----------|
| I-08-01-1 | 인증 없이 /api/briefings/today 호출 시 401 | status 401 |
| I-08-01-2 | 인증 후 오늘 브리핑 조회 성공 | 200 + `{ success: true, data }` |
| I-08-01-3 | 브리핑 없는 경우 404 반환 | 404 + `errorCode: 'BRIEFING_NOT_FOUND'` |
| I-08-01-4 | items 배열이 position 순으로 정렬된다 | `items[0].position < items[1].position` |

---

## 6. 기존 테스트 영향 분석

| 기존 테스트 파일 | 영향 | 대책 |
|-----------------|------|------|
| `tests/unit/date.test.ts` | 없음 | 새 함수 `getKSTToday` 추가는 별도 |
| `tests/integration/cron-collect.test.ts` | 없음 | API route 추가만 |
| `tests/integration/telegram-webhook.test.ts` | 없음 | 독립 파일 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | 테스트 명세 초안 작성 |
