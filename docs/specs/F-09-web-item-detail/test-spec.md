# F-09 웹 아이템 상세 -- 테스트 명세

**버전**: 1.0 | **날짜**: 2026-02-28 | **참조**: design.md, features.md #F-09

---

## 1. 테스트 범위

| 파일 | 타입 | 대상 |
|------|------|------|
| `tests/unit/api/content-detail.test.ts` | 단위 | GET /api/content/[id] |
| `tests/unit/components/item-detail-view.test.tsx` | 단위 | ItemDetailView 렌더링 |
| `tests/unit/components/memo-input.test.tsx` | 단위 | MemoInput 저장 로직 |
| `tests/unit/components/related-items.test.tsx` | 단위 | RelatedItems 렌더링 |
| `tests/integration/web-item-detail.test.ts` | 통합 | 전체 상세 조회 + 메모 저장 흐름 |

---

## 2. 단위 테스트: API Route (content-detail.test.ts)

### D-01: 인증 검증

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-01-1 | 세션 없으면 401을 반환한다 | 인증 없이 GET /api/content/[id] | `{ success: false, errorCode: 'AUTH_REQUIRED' }` + 401 |
| D-01-2 | 유효한 세션이면 요청을 처리한다 | 유효 세션 + 존재하는 id | 401이 아닌 응답 |

### D-02: 콘텐츠 조회

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-02-1 | 존재하는 콘텐츠 ID로 200을 반환한다 | 유효 UUID | `{ success: true, data: { content_id, title, summary_ai, ... } }` + 200 |
| D-02-2 | 존재하지 않는 ID로 404를 반환한다 | 없는 UUID | `{ success: false, errorCode: 'CONTENT_NOT_FOUND' }` + 404 |
| D-02-3 | 잘못된 형식의 ID로 400을 반환한다 | `"invalid-not-uuid"` | `{ success: false }` + 400 |

### D-03: 응답 데이터 구조

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-03-1 | title, summary_ai, source, source_url이 포함된다 (AC2) | 유효 콘텐츠 | 해당 필드 모두 존재 |
| D-03-2 | channel 필드가 포함된다 | 유효 콘텐츠 | `data.channel` 존재 |
| D-03-3 | tags 배열이 포함된다 | 유효 콘텐츠 | `data.tags` 배열 존재 (null 가능) |
| D-03-4 | collected_at이 ISO 8601 형식이다 | 유효 콘텐츠 | ISO 형식 문자열 |
| D-03-5 | user_interaction 필드가 포함된다 | 유효 콘텐츠 | `data.user_interaction` 존재 (null 가능) |
| D-03-6 | memo_text 필드가 포함된다 | 유효 콘텐츠 | `data.memo_text` 존재 (null 가능) |
| D-03-7 | reason 필드가 포함된다 | 유효 콘텐츠 | `data.reason` 존재 (null 가능) |
| D-03-8 | briefing_id 필드가 포함된다 | 유효 콘텐츠 | `data.briefing_id` 존재 (null 가능) |

### D-04: 관련 아이템 (AC4)

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-04-1 | related_items 배열이 포함된다 | 유효 콘텐츠 | `data.related_items` 배열 존재 |
| D-04-2 | 관련 아이템은 최대 5건이다 | tags 겹침이 많은 콘텐츠 | `data.related_items.length <= 5` |
| D-04-3 | 자기 자신은 related_items에 포함되지 않는다 | 유효 콘텐츠 | 현재 content_id가 목록에 없음 |
| D-04-4 | tags가 null이면 related_items가 빈 배열이다 | tags=null 콘텐츠 | `data.related_items` === `[]` |
| D-04-5 | 관련 아이템에 channel, title, summary_ai, source, source_url이 포함된다 | 유효 | 각 필드 존재 |

---

## 3. 단위 테스트: ItemDetailView (item-detail-view.test.tsx)

### D-05: 기본 렌더링 (AC1, AC2)

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-05-1 | 제목이 렌더링된다 | contentId 전달 | `[data-testid="item-title"]` 내 제목 텍스트 존재 |
| D-05-2 | AI 요약 전문이 렌더링된다 | contentId 전달 | `[data-testid="ai-summary"]` 내 요약 텍스트 존재 |
| D-05-3 | 원문 링크가 렌더링된다 | contentId 전달 | `[data-testid="original-link"]` 존재, href=source_url |
| D-05-4 | 소스명이 렌더링된다 | contentId 전달 | 소스 텍스트가 DOM에 존재 |
| D-05-5 | 수집 시간이 렌더링된다 | contentId 전달 | `[data-testid="collected-at"]` 내 시간 텍스트 존재 |
| D-05-6 | 채널 뱃지가 렌더링된다 | contentId 전달 | ChannelBadge 컴포넌트 존재 |
| D-05-7 | summary_ai가 null이면 요약 섹션이 "요약 없음" 표시 | null summary | 대체 텍스트 표시 |

### D-06: 태그 표시

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-06-1 | 태그가 칩 형태로 표시된다 | tags: ['LLM', 'AI'] | 태그 텍스트가 각각 존재 |
| D-06-2 | tags가 null이면 태그 영역이 숨겨진다 | tags: null | 태그 영역 미존재 |
| D-06-3 | tags가 빈 배열이면 태그 영역이 숨겨진다 | tags: [] | 태그 영역 미존재 |

### D-07: reason 표시

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-07-1 | reason이 있으면 힌트가 표시된다 | reason: "지난주 메모: MSA" | `[data-testid="reason-hint"]` 존재 |
| D-07-2 | reason이 null이면 힌트 영역이 숨겨진다 | reason: null | 힌트 요소 미존재 |

---

## 4. 단위 테스트: MemoInput (memo-input.test.tsx)

### D-08: 메모 저장 (AC3)

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-08-1 | textarea가 렌더링된다 | - | `[data-testid="memo-textarea"]` 존재 |
| D-08-2 | 저장 버튼이 렌더링된다 | - | `[data-testid="memo-save"]` 존재 |
| D-08-3 | 기존 메모가 있으면 textarea에 pre-fill된다 | initialMemo: "기존 메모" | textarea.value === "기존 메모" |
| D-08-4 | 빈 메모로 저장 시도 시 버튼이 비활성화된다 | 빈 textarea | 저장 버튼 disabled |
| D-08-5 | 저장 클릭 시 POST /api/interactions가 호출된다 | memo_text 입력 후 저장 | fetch가 interaction='메모' + memo_text 포함 payload로 호출 |
| D-08-6 | 저장 성공 시 토스트가 표시된다 | API 성공 mock | "메모가 저장되었습니다" 텍스트 존재 |
| D-08-7 | 저장 실패 시 에러 토스트가 표시된다 | API 실패 mock | 에러 메시지 텍스트 존재 |
| D-08-8 | 저장 중 버튼이 비활성화된다 | 저장 진행 중 | 저장 버튼 disabled |

---

## 5. 단위 테스트: RelatedItems (related-items.test.tsx)

### D-09: 관련 아이템 렌더링 (AC4)

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-09-1 | 관련 아이템이 있으면 목록이 렌더링된다 | items 3건 | 3개의 아이템 카드 존재 |
| D-09-2 | 각 아이템에 채널 뱃지, 제목이 표시된다 | items 1건 | ChannelBadge + 제목 텍스트 존재 |
| D-09-3 | 아이템 클릭 시 /item/[id]로 이동한다 | items 1건 | Link href="/item/{content_id}" |
| D-09-4 | 관련 아이템이 0건이면 빈 상태 메시지가 표시된다 | items 0건 | "관련 아이템이 없습니다" 텍스트 |
| D-09-5 | 섹션 제목 "관련 아이템"이 표시된다 | items 존재 | "관련 아이템" 텍스트 존재 |

---

## 6. 통합 테스트: 전체 흐름 (web-item-detail.test.ts)

### D-10: 상세 조회 + 메모 저장 흐름

| ID | 테스트 케이스 | 입력 | 예상 결과 |
|----|-------------|------|----------|
| D-10-1 | 인증 없이 /api/content/[id] 호출 시 401 | 세션 없음 | status 401 |
| D-10-2 | 인증 후 콘텐츠 상세 조회 성공 | 유효 세션 + 존재 ID | 200 + `{ success: true, data }` |
| D-10-3 | 없는 콘텐츠 ID로 404 반환 | 유효 세션 + 없는 ID | 404 + `errorCode: 'CONTENT_NOT_FOUND'` |
| D-10-4 | 메모 저장 후 재조회 시 memo_text가 반영된다 | 메모 저장 -> 재조회 | `data.memo_text` === 저장한 텍스트 |
| D-10-5 | 원문 링크 클릭 기록이 user_interactions에 저장된다 | '웹열기' interaction POST | 201 + interaction='웹열기' |
| D-10-6 | 관련 아이템이 같은 tags를 공유한다 | tags 겹치는 콘텐츠 존재 | related_items 비어있지 않음 |

---

## 7. 경계 조건 / 에러 케이스

- 유효하지 않은 UUID 형식의 ID → 400 Bad Request
- summary_ai가 null인 콘텐츠 → 요약 없음 대체 텍스트 표시
- tags가 null 또는 빈 배열인 콘텐츠 → 관련 아이템 빈 배열, 태그 영역 미표시
- briefing에 포함되지 않은 콘텐츠 → reason=null, briefing_id=null
- 메모 텍스트가 비어있는 상태에서 저장 시도 → 저장 버튼 비활성화
- 매우 긴 메모 텍스트 (5000자 이상) → 서버에서 적절한 길이 제한 적용
- 네트워크 오류로 API 호출 실패 → 에러 배너 + 재시도 버튼 표시

---

## 8. 기존 테스트 영향 분석

| 기존 테스트 파일 | 영향 | 대책 |
|-----------------|------|------|
| `tests/unit/components/briefing-card.test.tsx` | 없음 | BriefingCard에 링크 추가 시 테스트 보완 필요 |
| `tests/unit/components/feedback-buttons.test.tsx` | 없음 | FeedbackButtons 재사용, 인터페이스 변경 없음 |
| `tests/unit/api/briefings-today.test.ts` | 없음 | 독립 API route |
| `tests/integration/web-briefing.test.ts` | 없음 | 독립 흐름 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | 테스트 명세 초안 작성 (D-01 ~ D-10) |
