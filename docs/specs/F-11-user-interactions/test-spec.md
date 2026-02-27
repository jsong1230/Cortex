# F-11 사용자 반응 수집 -- 테스트 명세

**버전**: 1.0 | **날짜**: 2026-02-28
**참조**: `docs/specs/F-11-user-interactions/design.md`, `docs/project/features.md` #F-11

---

## 1. 테스트 범위

| 파일 | 타입 | 대상 |
|------|------|------|
| `tests/unit/api/interactions.test.ts` | 단위 | POST /api/interactions (UPSERT) |
| `tests/unit/api/interactions-id.test.ts` | 단위 | DELETE, PUT /api/interactions/[id] |
| `tests/unit/api/interactions-stats.test.ts` | 단위 | GET /api/interactions/stats |
| `tests/unit/api/interactions-get.test.ts` | 단위 | GET /api/interactions (이력 조회) |
| `tests/unit/telegram-commands-dedup.test.ts` | 단위 | insertInteraction UPSERT |
| `tests/integration/user-interactions.test.ts` | 통합 | 전체 반응 수집 흐름 |

---

## 2. 단위 테스트

### R-01: POST /api/interactions -- 중복 방지 (UPSERT)

| ID | 시나리오 | 입력 | 예상 결과 |
|----|----------|------|-----------|
| R-01-1 | 신규 반응 저장 | `{ content_id: "uuid-1", interaction: "좋아요", source: "web" }` | 201 Created + `{ success: true, data: { id, interaction, content_id } }` |
| R-01-2 | 동일 content_id + 동일 interaction 재요청 | 이미 좋아요 존재 + 동일 요청 | 200 OK (멱등 응답, 기존 레코드 반환) |
| R-01-3 | 동일 content_id + 다른 interaction | 좋아요 존재 + `{ interaction: "저장" }` | 201 Created (별도 레코드) |
| R-01-4 | 메모는 복수 허용 | 메모 1건 존재 + 새 메모 요청 | 201 Created (새 레코드 생성) |
| R-01-5 | briefing_id가 없어도 저장 가능 | `{ content_id, interaction, source }` (briefing_id 미포함) | 201 Created |
| R-01-6 | 인증 없으면 401 | 세션 없이 요청 | `{ success: false, errorCode: "AUTH_REQUIRED" }` + 401 |
| R-01-7 | 유효하지 않은 interaction 타입 | `{ interaction: "무효타입" }` | 400 + `INTERACTION_INVALID_TYPE` |
| R-01-8 | content_id 누락 | `{ interaction: "좋아요" }` | 400 |

### R-02: GET /api/interactions -- 반응 이력 조회

| ID | 시나리오 | 입력 | 예상 결과 |
|----|----------|------|-----------|
| R-02-1 | 전체 이력 조회 (파라미터 없음) | `GET /api/interactions` | 200 + `{ items: [...], total, limit: 50, offset: 0 }` |
| R-02-2 | content_id 필터 | `GET /api/interactions?content_id=uuid-1` | 200 + 해당 content_id의 반응만 포함 |
| R-02-3 | interaction 타입 필터 | `GET /api/interactions?interaction=저장` | 200 + '저장' 반응만 포함 |
| R-02-4 | source 필터 | `GET /api/interactions?source=web` | 200 + web 소스만 포함 |
| R-02-5 | 날짜 범위 필터 | `GET /api/interactions?from=2026-02-01&to=2026-02-28` | 200 + 해당 기간 반응만 포함 |
| R-02-6 | 페이지네이션 | `GET /api/interactions?limit=10&offset=10` | 200 + 11~20번째 레코드 |
| R-02-7 | content_title, content_channel이 응답에 포함 | 아무 필터 | items[].content_title, items[].content_channel 필드 존재 |
| R-02-8 | 인증 없으면 401 | 세션 없이 요청 | 401 |

### R-03: DELETE /api/interactions/[id] -- 반응 취소

| ID | 시나리오 | 입력 | 예상 결과 |
|----|----------|------|-----------|
| R-03-1 | 존재하는 반응 삭제 | `DELETE /api/interactions/{valid-id}` | 200 + `{ success: true, data: { id, interaction, content_id } }` |
| R-03-2 | 존재하지 않는 ID | `DELETE /api/interactions/{invalid-id}` | 404 + `INTERACTION_NOT_FOUND` |
| R-03-3 | 인증 없으면 401 | 세션 없이 요청 | 401 |
| R-03-4 | 삭제 후 GET으로 확인 | 삭제 후 같은 ID 조회 | items에 해당 ID 미포함 |

### R-04: PUT /api/interactions/[id] -- 메모 수정

| ID | 시나리오 | 입력 | 예상 결과 |
|----|----------|------|-----------|
| R-04-1 | 메모 텍스트 수정 | `PUT /api/interactions/{memo-id}` + `{ memo_text: "수정됨" }` | 200 + `{ data: { memo_text: "수정됨" } }` |
| R-04-2 | 메모가 아닌 반응 수정 시도 | 좋아요 반응 ID로 PUT | 400 + `INTERACTION_NOT_MEMO` |
| R-04-3 | memo_text 누락 | `PUT /api/interactions/{id}` + `{}` | 400 + `INTERACTION_MEMO_REQUIRED` |
| R-04-4 | 존재하지 않는 ID | `PUT /api/interactions/{invalid-id}` | 404 + `INTERACTION_NOT_FOUND` |
| R-04-5 | 인증 없으면 401 | 세션 없이 요청 | 401 |

### R-05: GET /api/interactions/stats -- 반응 통계

| ID | 시나리오 | 입력 | 예상 결과 |
|----|----------|------|-----------|
| R-05-1 | 기본 통계 조회 (기본 30일) | `GET /api/interactions/stats` | 200 + `{ by_type, by_source, by_channel, total }` |
| R-05-2 | 날짜 범위 지정 | `GET /api/interactions/stats?from=2026-02-01&to=2026-02-28` | 200 + 해당 기간 통계 |
| R-05-3 | by_type에 모든 interaction 타입 포함 | 아무 조건 | by_type 객체에 7개 타입 키 존재 (값 0 포함) |
| R-05-4 | by_source에 telegram_bot, web, system 포함 | 아무 조건 | by_source 객체에 3개 소스 키 존재 |
| R-05-5 | by_channel에 tech, world, culture, canada 포함 | 아무 조건 | by_channel 객체 존재 |
| R-05-6 | 반응 데이터 없는 기간 | 미래 날짜 범위 | 200 + total: 0, 모든 값 0 |
| R-05-7 | 인증 없으면 401 | 세션 없이 요청 | 401 |

### R-06: 텔레그램 반응 -- 중복 방지 (insertInteraction)

| ID | 시나리오 | 입력 | 예상 결과 |
|----|----------|------|-----------|
| R-06-1 | 텔레그램 신규 좋아요 | `insertInteraction(contentId, briefingId, '좋아요')` | DB에 1건 INSERT |
| R-06-2 | 텔레그램 동일 좋아요 재클릭 | 이미 좋아요 존재 + 동일 호출 | 에러 없이 무시 (UPSERT) |
| R-06-3 | source가 'telegram_bot'으로 기록 | 아무 호출 | DB 레코드의 source = 'telegram_bot' |

---

## 3. 통합 테스트

### R-07: 웹 + 텔레그램 통합 반응 흐름

| ID | 시나리오 | 입력 | 예상 결과 |
|----|----------|------|-----------|
| R-07-1 | 웹에서 좋아요 → GET 이력 조회 | POST(좋아요) → GET | items에 좋아요 1건 포함 |
| R-07-2 | 웹 좋아요 → 텔레그램 좋아요 (같은 콘텐츠) | POST(web) → insertInteraction(telegram) | DB에 1건만 존재 (중복 방지) |
| R-07-3 | 반응 → 삭제 → 통계 확인 | POST → DELETE → GET /stats | 삭제된 반응이 통계에 미포함 |
| R-07-4 | 메모 생성 → 수정 → 이력 확인 | POST(메모) → PUT(수정) → GET | 수정된 메모 텍스트 반영 |

### R-08: 스킵 자동 기록

| ID | 시나리오 | 입력 | 예상 결과 |
|----|----------|------|-----------|
| R-08-1 | 어제 브리핑 아이템 중 무반응 아이템에 스킵 자동 기록 | 어제 브리핑 3개 아이템 중 1개만 반응 | 나머지 2개에 '스킵' + source='system' INSERT |
| R-08-2 | 이미 반응 있는 아이템은 스킵되지 않음 | 모든 아이템에 반응 존재 | 스킵 INSERT 0건 |
| R-08-3 | 어제 브리핑 없으면 스킵 로직 건너뜀 | 어제 브리핑 미존재 | 스킵 INSERT 0건, 에러 없음 |

---

## 4. 경계 조건 / 에러 케이스

- 동시에 웹과 텔레그램에서 같은 반응 전송 시 UNIQUE 제약이 하나만 허용
- content_id가 content_items에 존재하지 않는 경우 FK 제약으로 INSERT 실패 → 500 또는 400 응답
- limit이 100 초과 시 100으로 클램프
- offset이 음수면 0으로 클램프
- from이 to보다 미래이면 빈 배열 반환
- UUID 형식이 아닌 id 파라미터 → 400

---

## 5. 회귀 테스트

| 기존 기능 | 영향 여부 | 검증 방법 |
|-----------|-----------|-----------|
| F-07 텔레그램 봇 /good 명령어 | 있음 (UPSERT 적용) | 기존 테스트 `telegram-commands.test.ts` 내 handleGood PASS 확인 |
| F-07 텔레그램 인라인 버튼 | 있음 (UPSERT 적용) | handleCallbackQuery 테스트 PASS 확인 |
| F-08 FeedbackButtons 낙관적 업데이트 | 있음 (토글 시 DELETE 호출) | feedback-buttons.test.tsx 재실행 |
| F-08 GET /api/briefings/today | 없음 (읽기만) | briefings-today.test.ts 재실행 |
| F-12 인증 | 없음 | auth 테스트 재실행 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-11 테스트 명세 작성 |
