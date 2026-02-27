# F-11 사용자 반응 수집 -- 구현 계획

**버전**: 1.0 | **날짜**: 2026-02-28
**참조**: `design.md`, `test-spec.md`

---

## 구현 순서

### Phase 1: DB 마이그레이션

1. `supabase/migrations/004_interaction_unique_constraint.sql` 작성
   - 기존 중복 데이터 정리 (중복 중 최신 것만 유지)
   - `idx_interactions_content_type_unique` 부분 유니크 인덱스 생성
   - RLS DELETE/UPDATE 정책 추가

### Phase 2: RED 테스트 작성

1. `tests/unit/api/interactions.test.ts` -- POST UPSERT 테스트 (R-01)
2. `tests/unit/api/interactions-get.test.ts` -- GET 이력 조회 테스트 (R-02)
3. `tests/unit/api/interactions-id.test.ts` -- DELETE/PUT 테스트 (R-03, R-04)
4. `tests/unit/api/interactions-stats.test.ts` -- 통계 테스트 (R-05)
5. `tests/unit/telegram-commands-dedup.test.ts` -- 텔레그램 중복 방지 (R-06)
6. `tests/integration/user-interactions.test.ts` -- 통합 테스트 (R-07, R-08)

### Phase 3: GREEN 구현

#### 백엔드 -- 기존 파일 수정

1. `app/api/interactions/route.ts` 수정
   - POST: UPSERT 전략 적용 (메모 제외)
   - POST: briefing_id 선택 필드화
   - GET: 이력 조회 핸들러 추가 (쿼리 파라미터 파싱, 페이지네이션)

2. `lib/telegram-commands.ts` 수정
   - `insertInteraction()`: INSERT를 UPSERT로 변경
   - `handleCallbackQuery()`: UPSERT 적용

3. `app/api/cron/send-briefing/route.ts` 수정
   - 브리핑 발송 전 어제 브리핑 스킵 자동 기록 로직 추가

#### 백엔드 -- 신규 파일 생성

4. `app/api/interactions/[id]/route.ts` 생성
   - DELETE: 반응 삭제 (물리 삭제)
   - PUT: 메모 텍스트 수정

5. `app/api/interactions/stats/route.ts` 생성
   - GET: 반응 통계 (by_type, by_source, by_channel)

#### 프론트엔드 -- 기존 파일 수정

6. `components/briefing/FeedbackButtons.tsx` 수정
   - 토글(같은 버튼 재클릭) 시 DELETE /api/interactions/[id] 호출
   - 활성 상태일 때 interaction ID를 상태로 관리

### Phase 4: 검증

1. `npx vitest run` -- 전체 테스트 PASS 확인
2. `npx tsc --noEmit` -- 타입 에러 없음 확인
3. 회귀 테스트 -- F-07, F-08 관련 기존 테스트 모두 PASS 확인

### Phase 5: 문서 작성

1. `docs/api/F-11-user-interactions.md` -- API 스펙 확정본
2. `docs/db/F-11-user-interactions.md` -- DB 스키마 확정본

---

## 체크리스트

- [ ] 기존 테스트 전체 PASS 유지
- [ ] TypeScript strict 모드 통과
- [ ] UPSERT로 중복 반응 방지 동작 확인
- [ ] 메모는 복수 허용 확인
- [ ] DELETE로 반응 취소 동작 확인
- [ ] PUT으로 메모 수정 동작 확인
- [ ] 통계 API에서 by_type, by_source, by_channel 모두 반환
- [ ] 스킵 자동 기록이 send-briefing Cron에서 동작
- [ ] FeedbackButtons 토글 시 실제 DELETE 호출
- [ ] 세션 없으면 모든 API에서 401 반환
- [ ] 텔레그램 insertInteraction에 UPSERT 적용

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | F-11 구현 계획 작성 |
