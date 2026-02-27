# F-08 웹 브리핑 뷰어 — 구현 계획

**버전**: 1.0 | **날짜**: 2026-02-28
**참조**: design.md, test-spec.md

---

## 구현 순서

### Phase 1: RED 테스트 작성
1. `tests/unit/components/briefing-card.test.tsx` 작성
2. `tests/unit/components/feedback-buttons.test.tsx` 작성
3. `tests/unit/api/briefings-today.test.ts` 작성
4. `tests/integration/web-briefing.test.ts` 작성

### Phase 2: GREEN 구현

#### 백엔드
1. `lib/supabase/auth.ts` — 웹 API 인증 유틸리티
2. `app/api/briefings/today/route.ts` — stub 교체 → 완전 구현
3. `app/api/interactions/route.ts` — 반응 저장 API (신규)

#### 프론트엔드 컴포넌트
4. `components/briefing/ChannelBadge.tsx` — 디자인 시스템 색상 적용
5. `components/briefing/FeedbackButtons.tsx` — 낙관적 업데이트 구현
6. `components/briefing/BriefingCard.tsx` — 카드 레이아웃 완성
7. `components/briefing/BriefingCardList.tsx` — 로딩/에러/빈 상태
8. `components/layout/MobileHeader.tsx` — 신규
9. `components/layout/BottomNav.tsx` — 기존 nav.tsx 교체
10. `components/layout/Sidebar.tsx` — 신규 (데스크톱)

#### 페이지
11. `app/(web)/layout.tsx` — AppShell
12. `app/(web)/page.tsx` — BriefingCardList 렌더링

### Phase 3: 검증
1. `npx vitest run` — 전체 테스트 PASS 확인
2. `npx tsc --noEmit` — 타입 에러 없음 확인

### Phase 4: 문서 작성
1. `docs/api/F-08-web-briefing-viewer.md` — API 스펙 확정본
2. `docs/db/F-08-web-briefing-viewer.md` — DB 스키마 확정본

---

## 체크리스트

- [ ] 기존 284개 테스트 PASS 유지
- [ ] TypeScript strict 모드 통과
- [ ] 모든 인터랙티브 요소 44px 이상 터치 타겟
- [ ] 본문 최소 16px (12px 미만 금지)
- [ ] N+1 쿼리 방지 (content_items in 조회)
- [ ] 낙관적 업데이트 구현 (탭 즉시 색상 변경)
- [ ] reason 필드 선택적 표시 (AC5)
- [ ] 세션 없으면 401 반환
- [ ] 브리핑 없으면 404 + BRIEFING_NOT_FOUND
