# F-06 텔레그램 브리핑 발송 — 구현 계획

**버전**: 1.0 | **날짜**: 2026-02-28
**의존성**: F-05 완료

---

## 태스크 목록

### Phase 1: 설계 문서
- [x] docs/specs/F-06-telegram-briefing/design.md
- [x] docs/specs/F-06-telegram-briefing/test-spec.md
- [x] docs/specs/F-06-telegram-briefing/plan.md

### Phase 2: 테스트 작성 (RED)
- [x] tests/unit/telegram.test.ts 작성 (U-01~U-05)
- [x] tests/integration/cron-send-briefing.test.ts 작성 (I-01~I-02)
- [x] `npx vitest run tests/unit/telegram.test.ts` — RED 확인

### Phase 3: 구현 (GREEN)

#### 3-1: lib/telegram.ts 확장
- [x] BriefingItem 인터페이스 정의
- [x] formatBriefingMessage(items) 구현
- [x] createInlineKeyboard(webUrl) 구현
- [x] selectBriefingItems(items) 구현
- [x] sendBriefing(items, webUrl) 구현 (재시도 포함)

#### 3-2: app/api/cron/send-briefing/route.ts 구현
- [x] Supabase에서 오늘 요약 완료 아이템 조회
- [x] selectBriefingItems → formatBriefingMessage → sendMessage 파이프라인
- [x] briefings 테이블 INSERT
- [x] 에러 처리 및 구조화 로깅

### Phase 4: 테스트 실행 (GREEN 확인)
- [x] `npx vitest run tests/unit/telegram.test.ts` — 전부 PASS
- [x] `npx vitest run tests/integration/cron-send-briefing.test.ts` — 전부 PASS
- [x] `npx vitest run` — 기존 202개 포함 전체 PASS
- [x] `npx tsc --noEmit` — 빌드 에러 없음

### Phase 5: 사후 문서
- [x] docs/api/F-06-telegram-briefing.md 작성
- [x] docs/db/F-06-telegram-briefing.md 작성 (briefings 테이블 확정본)

---

## 추정 시간

| Phase | 예상 시간 |
|-------|----------|
| 1. 설계 문서 | 완료 |
| 2. 테스트 작성 | 30분 |
| 3. 구현 | 45분 |
| 4. 테스트 실행 | 15분 |
| 5. 사후 문서 | 15분 |
| **합계** | **~1시간 45분** |

---

*F-06 구현 계획 v1.0 | 2026-02-28*
