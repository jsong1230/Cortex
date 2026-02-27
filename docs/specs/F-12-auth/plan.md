# F-12 인증 — 구현 계획

**버전**: 1.0 | **날짜**: 2026-02-28

---

## 구현 순서

### Phase 1: 설계 문서 (완료)
- [x] docs/specs/F-12-auth/design.md
- [x] docs/specs/F-12-auth/test-spec.md
- [x] docs/specs/F-12-auth/plan.md

### Phase 2: RED 테스트 작성
- [ ] tests/unit/auth/telegram-verify.test.ts
- [ ] tests/unit/auth/middleware.test.ts
- [ ] tests/unit/auth/auth-api.test.ts
- [ ] tests/integration/auth-flow.test.ts

### Phase 3: GREEN 구현
- [ ] lib/auth/telegram-verify.ts
- [ ] lib/supabase/middleware.ts
- [ ] middleware.ts (프로젝트 루트)
- [ ] app/api/auth/telegram/route.ts
- [ ] app/api/auth/logout/route.ts
- [ ] lib/supabase/client.ts (createBrowserSupabaseClient 함수 추가)
- [ ] app/login/page.tsx
- [ ] components/auth/TelegramLoginButton.tsx

### Phase 4: 사후 문서
- [ ] docs/api/F-12-auth.md
- [ ] docs/db/F-12-auth.md

---

## 태스크 체크리스트

| # | 태스크 | 예상 시간 | 우선순위 |
|---|--------|---------|--------|
| 1 | telegram-verify.ts 순수 함수 구현 | 30분 | P0 |
| 2 | 단위 테스트 telegram-verify.test.ts | 20분 | P0 |
| 3 | middleware.ts + lib/supabase/middleware.ts | 45분 | P0 |
| 4 | 미들웨어 단위 테스트 | 30분 | P0 |
| 5 | /api/auth/telegram 라우트 | 60분 | P0 |
| 6 | /api/auth/logout 라우트 | 20분 | P0 |
| 7 | 인증 API 단위 테스트 | 40분 | P0 |
| 8 | 통합 테스트 | 40분 | P1 |
| 9 | /login 페이지 + TelegramLoginButton | 45분 | P1 |
| 10 | 기존 테스트 회귀 검증 | 10분 | P0 |

---

## 의존성

- `@supabase/ssr` ^0.8.0: 이미 설치됨
- `@supabase/supabase-js` ^2.98.0: 이미 설치됨
- `crypto` (Node.js 내장): 별도 설치 불필요

---

*F-12 plan.md v1.0 | 2026-02-28*
