# F-10 웹 브리핑 히스토리 -- 구현 태스크 목록

**버전**: 1.0 | **날짜**: 2026-02-28
**참조**: `docs/specs/F-10-web-briefing-history/design.md`

---

## 구현 순서

### Phase 1: 공유 로직 추출 + API

| # | 태스크 | 파일 | 예상 시간 | 의존성 |
|---|--------|------|----------|--------|
| 1 | 브리핑 조회 공통 로직 추출 | `lib/queries/briefing-query.ts` | 20분 | - |
| 2 | today API 리팩터링 (공통 함수 사용) | `app/api/briefings/today/route.ts` | 10분 | #1 |
| 3 | GET /api/briefings/[date] 구현 | `app/api/briefings/[date]/route.ts` | 15분 | #1 |
| 4 | GET /api/briefings 목록 API 구현 | `app/api/briefings/route.ts` | 20분 | - |
| 5 | GET /api/saved 저장 목록 API 구현 | `app/api/saved/route.ts` | 20분 | - |
| 6 | DELETE /api/saved/[contentId] 구현 | `app/api/saved/[contentId]/route.ts` | 15분 | - |

### Phase 2: 프론트엔드 컴포넌트

| # | 태스크 | 파일 | 예상 시간 | 의존성 |
|---|--------|------|----------|--------|
| 7 | HistoryView 탭 컨테이너 | `components/history/HistoryView.tsx` | 20분 | - |
| 8 | BriefingDateList 컴포넌트 | `components/history/BriefingDateList.tsx` | 40분 | #4, #3 |
| 9 | SavedItemList 컴포넌트 | `components/history/SavedItemList.tsx` | 30분 | #5, #6 |
| 10 | HistoryPage 라우트 교체 | `app/(web)/history/page.tsx` | 10분 | #7 |

### Phase 3: 테스트

| # | 태스크 | 파일 | 예상 시간 | 의존성 |
|---|--------|------|----------|--------|
| 11 | API 단위 테스트 (H-01 ~ H-12) | 테스트 파일 | 40분 | #3~#6 |
| 12 | 컴포넌트 단위 테스트 (H-13 ~ H-26) | 테스트 파일 | 40분 | #7~#9 |
| 13 | 통합 테스트 (H-27 ~ H-30) | 테스트 파일 | 20분 | #11, #12 |

---

## 태스크 상세

### #1 브리핑 조회 공통 로직 추출

`app/api/briefings/today/route.ts`에서 briefings/content_items/user_interactions 3-쿼리 패턴을 `lib/queries/briefing-query.ts`의 `getBriefingByDate(supabase, date)` 함수로 추출한다. today API와 [date] API가 동일한 로직을 공유하도록 한다.

### #2 today API 리팩터링

기존 today/route.ts의 로직을 `getBriefingByDate(supabase, getTodayKST())`로 대체한다. 응답 구조는 변경 없음. 기존 테스트가 있다면 통과 확인.

### #3 GET /api/briefings/[date] 구현

기존 stub (501 Not Implemented)를 실제 구현으로 교체. 인증 검증 추가, 미래 날짜 검증 추가, `getBriefingByDate(supabase, date)` 호출.

### #4 GET /api/briefings 목록 API

신규 파일. page/limit 파라미터 파싱, briefings 테이블 페이지네이션 조회, items JSONB에서 아이템 수/채널 분포 계산, PaginatedResponse 형식 응답.

### #5 GET /api/saved

신규 파일. user_interactions에서 `interaction='저장'`을 DISTINCT ON(content_id)로 조회 후 content_items JOIN. 페이지네이션 지원.

### #6 DELETE /api/saved/[contentId]

신규 파일. UUID 검증, user_interactions에서 해당 content_id의 저장 레코드 삭제.

### #7 HistoryView

탭 전환 로직. URL searchParams 연동 (`?tab=saved`). 탭 스타일링 (design-system.md 준수).

### #8 BriefingDateList

날짜 목록 fetch, 스켈레톤 UI, 날짜 선택 시 [date] API 호출 및 BriefingCard 인라인 렌더링, "더 보기" 버튼, 빈/에러 상태 처리.

### #9 SavedItemList

저장 아이템 fetch, 저장 해제 낙관적 업데이트, "더 보기" 버튼, 빈 상태 메시지.

### #10 HistoryPage 라우트 교체

기존 placeholder를 서버 컴포넌트 + HistoryView 클라이언트 컴포넌트로 교체. metadata 설정.

---

## 구현 체크리스트

- [ ] `lib/queries/briefing-query.ts` 공통 함수 추출
- [ ] `app/api/briefings/today/route.ts` 리팩터링
- [ ] `app/api/briefings/[date]/route.ts` 구현
- [ ] `app/api/briefings/route.ts` 구현
- [ ] `app/api/saved/route.ts` 구현
- [ ] `app/api/saved/[contentId]/route.ts` 구현
- [ ] `components/history/HistoryView.tsx` 구현
- [ ] `components/history/BriefingDateList.tsx` 구현
- [ ] `components/history/SavedItemList.tsx` 구현
- [ ] `app/(web)/history/page.tsx` 교체
- [ ] API 단위 테스트 통과 (H-01 ~ H-12)
- [ ] 컴포넌트 단위 테스트 통과 (H-13 ~ H-26)
- [ ] 통합 테스트 통과 (H-27 ~ H-30)
- [ ] TypeScript strict mode 에러 없음
- [ ] 모바일 레이아웃 확인 (375px)
- [ ] 데스크톱 레이아웃 확인 (1024px+)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-10 구현 태스크 목록 작성 |
