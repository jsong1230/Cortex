# F-10 웹 브리핑 히스토리 -- 테스트 명세

**버전**: 1.0 | **날짜**: 2026-02-28
**참조**: `docs/specs/F-10-web-briefing-history/design.md`, `docs/project/features.md` #F-10

---

## 참조

- 설계서: `docs/specs/F-10-web-briefing-history/design.md`
- 인수조건: `docs/project/features.md` #F-10

---

## 단위 테스트

### API Route 테스트

| ID | 대상 | 시나리오 | 입력 | 예상 결과 |
|----|------|----------|------|-----------|
| H-01 | GET /api/briefings | 인증된 사용자가 브리핑 목록을 요청한다 | `page=1, limit=20` | 200, `items` 배열 + `total`, `hasMore` 필드 포함 |
| H-02 | GET /api/briefings | 미인증 사용자가 요청한다 | 세션 없음 | 401, `errorCode: 'AUTH_REQUIRED'` |
| H-03 | GET /api/briefings | page 파라미터가 0 또는 음수이다 | `page=0` | 400, `errorCode: 'INVALID_PARAMS'` |
| H-04 | GET /api/briefings | limit가 50을 초과한다 | `limit=100` | 400, `errorCode: 'INVALID_PARAMS'` |
| H-05 | GET /api/briefings/[date] | 유효한 날짜의 브리핑을 요청한다 | `date=2026-02-27` | 200, `briefing_date`, `items` 배열 포함 (today API와 동일 구조) |
| H-06 | GET /api/briefings/[date] | 존재하지 않는 날짜를 요청한다 | `date=2020-01-01` | 404, `errorCode: 'BRIEFING_NOT_FOUND'` |
| H-07 | GET /api/briefings/[date] | 미래 날짜를 요청한다 | `date=2099-12-31` | 400, `errorCode: 'FUTURE_DATE_NOT_ALLOWED'` |
| H-08 | GET /api/briefings/[date] | 잘못된 형식의 날짜를 요청한다 | `date=2026/02/27` | 400, `errorCode: 'INVALID_DATE_FORMAT'` |
| H-09 | GET /api/saved | 저장 아이템이 있는 경우 목록을 요청한다 | `page=1, limit=20` | 200, `items` 배열에 `content_id`, `title`, `saved_at` 포함 |
| H-10 | GET /api/saved | 저장 아이템이 없는 경우 | 세션 있음, 데이터 없음 | 200, `items: []`, `total: 0` |
| H-11 | DELETE /api/saved/[contentId] | 유효한 contentId로 저장 해제한다 | UUID 형식 contentId | 200, `success: true` |
| H-12 | DELETE /api/saved/[contentId] | 존재하지 않는 contentId로 해제 시도한다 | UUID 형식이지만 저장 기록 없음 | 404, `errorCode: 'SAVED_NOT_FOUND'` |

### 컴포넌트 테스트

| ID | 대상 | 시나리오 | 입력 | 예상 결과 |
|----|------|----------|------|-----------|
| H-13 | HistoryView | 초기 렌더링 시 "브리핑 히스토리" 탭이 활성이다 | props 없음 | "브리핑 히스토리" 탭에 활성 스타일 적용, BriefingDateList 렌더링 |
| H-14 | HistoryView | URL에 `?tab=saved`가 있으면 저장 목록 탭이 활성이다 | searchParams: `tab=saved` | "저장 목록" 탭에 활성 스타일 적용, SavedItemList 렌더링 |
| H-15 | HistoryView | 탭 클릭 시 뷰가 전환된다 | "저장 목록" 탭 클릭 | SavedItemList 렌더링, URL에 `?tab=saved` 반영 |
| H-16 | BriefingDateList | 로딩 중 스켈레톤이 표시된다 | fetch pending | 스켈레톤 UI 3개 렌더링, aria-busy="true" |
| H-17 | BriefingDateList | 날짜 목록이 정상 렌더링된다 | API 응답 성공 | 각 날짜 카드에 날짜, 아이템 수, 채널 뱃지 표시 |
| H-18 | BriefingDateList | 날짜 카드 클릭 시 브리핑 카드가 인라인 표시된다 | 날짜 카드 클릭 | 해당 날짜 하단에 BriefingCard 목록 렌더링 |
| H-19 | BriefingDateList | 같은 날짜 재클릭 시 접힌다 (토글) | 활성 날짜 재클릭 | BriefingCard 목록 숨김 |
| H-20 | BriefingDateList | "더 보기" 버튼 클릭 시 다음 페이지 로드 | hasMore=true, 버튼 클릭 | 기존 목록 유지 + 추가 날짜 append |
| H-21 | BriefingDateList | 에러 발생 시 에러 배너와 재시도 버튼 표시 | API 500 에러 | 에러 메시지 + "다시 시도" 버튼 |
| H-22 | BriefingDateList | 브리핑이 하나도 없을 때 빈 상태 메시지 | API 200, items=[] | "아직 브리핑 기록이 없습니다" 메시지 |
| H-23 | SavedItemList | 저장 아이템이 정상 렌더링된다 | API 응답 성공 | 각 아이템에 채널 뱃지, 제목, 요약, 저장일 표시 |
| H-24 | SavedItemList | 저장 해제 버튼 클릭 시 낙관적으로 제거된다 | 해제 버튼 클릭 | 즉시 목록에서 제거, DELETE API 호출 |
| H-25 | SavedItemList | 저장 해제 API 실패 시 아이템이 복원된다 | DELETE 500 에러 | 아이템이 목록에 다시 나타남 |
| H-26 | SavedItemList | 저장 아이템이 없을 때 빈 상태 메시지 | API 200, items=[] | "아직 저장한 아이템이 없습니다" + 안내 메시지 |

---

## 통합 테스트

| ID | API | 시나리오 | 입력 | 예상 결과 |
|----|-----|----------|------|-----------|
| H-27 | GET /api/briefings -> GET /api/briefings/[date] | 목록에서 날짜 조회 후 해당 날짜 상세 조회 | 목록의 첫 번째 날짜 | 상세 응답의 briefing_date가 목록의 날짜와 일치 |
| H-28 | POST /api/interactions -> GET /api/saved | 저장 반응 후 저장 목록에 반영 | `interaction='저장'` POST 후 saved GET | saved 목록에 해당 content_id 포함 |
| H-29 | DELETE /api/saved/[id] -> GET /api/saved | 저장 해제 후 저장 목록에서 제거 | DELETE 후 saved GET | saved 목록에 해당 content_id 미포함 |
| H-30 | GET /api/briefings/[date] | today API와 동일한 응답 구조 | 오늘 날짜로 요청 | today API 응답과 구조 동일 (briefing_date, items[]) |

---

## 경계 조건 / 에러 케이스

- 브리핑이 0건일 때 목록 API가 빈 배열과 total=0을 반환한다
- 동일 content_id에 '저장' interaction이 여러 건 있을 때 DISTINCT ON으로 1건만 반환한다
- 저장 해제 후 동일 아이템을 다시 저장하면 새 interaction 레코드가 생성된다
- page=1, limit=20에서 전체 데이터가 정확히 20건이면 hasMore=false이다 (20건 = 마지막 페이지)
- page=1, limit=20에서 전체 데이터가 21건이면 hasMore=true이다
- limit=0일 때 400 에러를 반환한다
- limit에 문자열이 전달될 때 400 에러를 반환한다
- YYYY-MM-DD 형식이지만 유효하지 않은 날짜(2026-02-30)는 400으로 처리한다
- contentId가 UUID 형식이 아닌 경우 400을 반환한다
- 미인증 상태에서 모든 API가 401을 반환한다

---

## 접근성 테스트

| ID | 대상 | 검증 항목 |
|----|------|-----------|
| H-31 | HistoryView | 탭에 `role="tablist"`, `role="tab"`, `aria-selected` 속성이 올바르게 설정된다 |
| H-32 | BriefingDateList | 날짜 카드가 `button` 역할이거나 키보드로 활성화 가능하다 |
| H-33 | SavedItemList | 저장 해제 버튼에 `aria-label="저장 해제"` 가 설정된다 |
| H-34 | 전체 | 탭 키로 모든 인터랙티브 요소 접근이 가능하다 |
| H-35 | 전체 | 로딩 중 `aria-busy="true"` 가 설정된다 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-10 테스트 명세 초안 작성 |
