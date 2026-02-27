# F-07 텔레그램 봇 명령어 처리 — 구현 계획

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**담당**: backend-dev
**예상 소요**: 1일

---

## 태스크 목록

### Phase 1: 설계 (완료)
- [x] docs/specs/F-07-telegram-commands/design.md 작성
- [x] docs/specs/F-07-telegram-commands/test-spec.md 작성
- [x] docs/specs/F-07-telegram-commands/plan.md 작성

### Phase 2: 테스트 작성 (RED)
- [x] tests/unit/telegram-commands.test.ts — parseCommand 단위 테스트
- [x] tests/unit/telegram-commands.test.ts — handleGood/handleBad 단위 테스트
- [x] tests/unit/telegram-commands.test.ts — handleSave 단위 테스트
- [x] tests/unit/telegram-commands.test.ts — handleMore 단위 테스트
- [x] tests/unit/telegram-commands.test.ts — handleKeyword 단위 테스트
- [x] tests/unit/telegram-commands.test.ts — handleStats 단위 테스트
- [x] tests/unit/telegram-commands.test.ts — handleMute 단위 테스트
- [x] tests/unit/telegram-commands.test.ts — handleUnknown 단위 테스트
- [x] tests/integration/telegram-webhook.test.ts — 웹훅 인증 + 명령어 흐름

### Phase 3: 구현 (GREEN)
- [x] lib/telegram-commands.ts 신규 구현
  - parseCommand()
  - handleGood()
  - handleBad()
  - handleSave()
  - handleMore()
  - handleKeyword()
  - handleStats()
  - handleMute()
  - handleUnknown()
  - handleCallbackQuery()
  - dispatchCommand()
- [x] app/api/telegram/webhook/route.ts 완전 구현

### Phase 4: 검증
- [x] npx vitest run — 기존 234 + 신규 테스트 전체 PASS
- [x] npx tsc --noEmit — 빌드 에러 없음

### Phase 5: 사후 문서
- [x] docs/api/F-07-telegram-commands.md — API 스펙 확정본
- [x] docs/db/F-07-telegram-commands.md — DB 스키마 확정본

---

## 의존성 확인

- `lib/telegram.ts` (F-06): sendMessage, parseCallbackData 사용 — 이미 구현됨
- `lib/supabase/server.ts`: Supabase 클라이언트 — 이미 구현됨
- DB 테이블: user_interactions, briefings, interest_profile, alert_settings — 이미 존재

## 위험 요소

| 위험 | 대응 |
|------|------|
| briefings.items JSONB 구조 불일치 | 타입 가드로 안전하게 파싱 |
| 텔레그램 재전송 (비200 응답 시) | 비즈니스 로직 오류도 200으로 반환 |
| Supabase UPSERT 동시성 | interest_profile은 topic UNIQUE 제약 활용 |

---

*F-07 Plan v1.0 | 2026-02-28*
