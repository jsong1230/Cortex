# F-09 웹 아이템 상세 -- 구현 계획

**버전**: 1.0 | **날짜**: 2026-02-28
**참조**: design.md, test-spec.md

---

## 구현 순서

### Phase 1: RED 테스트 작성
1. `tests/unit/api/content-detail.test.ts` 작성 (D-01 ~ D-04)
2. `tests/unit/components/item-detail-view.test.tsx` 작성 (D-05 ~ D-07)
3. `tests/unit/components/memo-input.test.tsx` 작성 (D-08)
4. `tests/unit/components/related-items.test.tsx` 작성 (D-09)
5. `tests/integration/web-item-detail.test.ts` 작성 (D-10)

### Phase 2: GREEN 구현

#### 백엔드
1. `app/api/content/[id]/route.ts` -- 콘텐츠 상세 API (신규)
   - 인증 검증 (getAuthUser)
   - content_items 단건 조회
   - user_interactions 반응 + 메모 조회
   - briefings reason 조회
   - 관련 아이템 조회 (tags overlap)

#### 프론트엔드 컴포넌트
2. `components/item/AISummarySection.tsx` -- AI 요약 섹션 (신규)
3. `components/item/ItemMeta.tsx` -- 소스, 시간, 태그 메타 정보 (신규)
4. `components/item/OriginalLink.tsx` -- 원문 링크 버튼 (신규)
5. `components/item/MemoInput.tsx` -- 메모 입력 + 저장 (신규)
6. `components/item/RelatedItems.tsx` -- 관련 아이템 목록 (신규)
7. `components/item/ItemDetailView.tsx` -- 상세 페이지 메인 컴포넌트 (신규)

#### 페이지
8. `app/(web)/item/[id]/page.tsx` -- stub 교체, ItemDetailView 렌더링

#### 기존 컴포넌트 연결
9. BriefingCard에 `/item/[id]` 이동 링크 추가 (카드 제목 클릭 시)
   - 기존 sourceUrl 외부 링크는 유지
   - 카드 전체 또는 제목 영역 탭 시 상세 페이지 이동

### Phase 3: 검증
1. `npx vitest run` -- 전체 테스트 PASS 확인
2. `npx tsc --noEmit` -- 타입 에러 없음 확인

### Phase 4: 문서 작성
1. `docs/api/F-09-web-item-detail.md` -- API 스펙 확정본
2. `docs/db/F-09-web-item-detail.md` -- DB 쿼리 확정본

---

## 체크리스트

- [ ] 기존 테스트 PASS 유지
- [ ] TypeScript strict 모드 통과
- [ ] 모든 인터랙티브 요소 44px 이상 터치 타겟
- [ ] 본문 최소 16px (12px 미만 금지)
- [ ] 쿼리 최적화 (4개 쿼리 고정, N+1 방지)
- [ ] 메모 저장 시 interaction='메모' + memo_text로 기록 (AC3)
- [ ] 관련 아이템 최대 5건, 자기 자신 제외 (AC4)
- [ ] 원문 링크 클릭 시 '웹열기' interaction 기록
- [ ] 세션 없으면 401 반환
- [ ] 콘텐츠 없으면 404 + CONTENT_NOT_FOUND
- [ ] 반응형 레이아웃 (모바일 1열, 데스크톱 640px)
- [ ] BackButton: router.back() 또는 / 이동
- [ ] FeedbackButtons 재사용 (F-08 컴포넌트)
- [ ] ChannelBadge 재사용 (F-08 컴포넌트)

---

## 의존성

| 항목 | 상태 | 비고 |
|------|------|------|
| F-08 BriefingCard | 완료 | 재사용 |
| F-08 FeedbackButtons | 완료 | 재사용 |
| F-08 ChannelBadge | 완료 | 재사용 |
| F-12 인증 (getAuthUser) | 완료 | 재사용 |
| POST /api/interactions | 완료 | 메모 저장에 재사용 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-28 | 구현 계획 초안 작성 |
