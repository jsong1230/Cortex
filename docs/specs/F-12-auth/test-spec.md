# F-12 인증 — 테스트 명세서

**버전**: 1.0 | **날짜**: 2026-02-28

---

## 1. 테스트 범위

| 파일 | 테스트 유형 | 케이스 수 |
|------|-----------|---------|
| `tests/unit/auth/telegram-verify.test.ts` | 단위 | 8개 |
| `tests/unit/auth/middleware.test.ts` | 단위 | 6개 |
| `tests/unit/auth/auth-api.test.ts` | 단위 | 8개 |
| `tests/integration/auth-flow.test.ts` | 통합 | 5개 |

---

## 2. 단위 테스트: 텔레그램 Hash 검증

### 파일: `tests/unit/auth/telegram-verify.test.ts`

#### T1: verifyTelegramLogin

| ID | 시나리오 | 입력 | 기대값 |
|----|---------|------|--------|
| T1-01 | 유효한 hash면 true 반환 | 올바른 TelegramLoginData + botToken | `true` |
| T1-02 | 잘못된 hash면 false 반환 | hash 조작된 데이터 | `false` |
| T1-03 | hash 필드 제외 후 알파벳 순 정렬 검증 | 올바른 데이터 | `true` |
| T1-04 | 빈 botToken이면 false 반환 | botToken = '' | `false` |

#### T2: isTelegramAuthExpired

| ID | 시나리오 | 입력 | 기대값 |
|----|---------|------|--------|
| T2-01 | 현재 시각 auth_date면 만료 아님 | `now` | `false` |
| T2-02 | 24시간 이내 auth_date면 만료 아님 | `now - 23 * 3600` | `false` |
| T2-03 | 24시간 초과 auth_date면 만료 | `now - 25 * 3600` | `true` |
| T2-04 | maxAgeSeconds 파라미터 커스텀 | `60` (1분), `now - 120` | `true` |

---

## 3. 단위 테스트: 미들웨어

### 파일: `tests/unit/auth/middleware.test.ts`

| ID | 시나리오 | 입력 | 기대값 |
|----|---------|------|--------|
| M1 | 세션 없이 보호 라우트 접근 → 리다이렉트 | 세션 없음, URL: `/` | 302, `Location: /login?redirect=%2F` |
| M2 | 세션 없이 /history 접근 → 리다이렉트 | 세션 없음, URL: `/history` | 302, `Location: /login?redirect=%2Fhistory` |
| M3 | /login 접근은 인증 불필요 → 통과 | 세션 없음, URL: `/login` | 통과 (리다이렉트 없음) |
| M4 | /api/* 접근은 미들웨어 제외 | URL: `/api/briefings/today` | 미들웨어 미적용 |
| M5 | 세션 있으면 보호 라우트 통과 | 세션 있음, URL: `/` | 통과 |
| M6 | 세션 있으면 쿠키 갱신됨 | 유효 세션 | response에 갱신된 쿠키 |

---

## 4. 단위 테스트: 인증 API

### 파일: `tests/unit/auth/auth-api.test.ts`

#### GET /api/auth/telegram

| ID | 시나리오 | 입력 | 기대값 |
|----|---------|------|--------|
| A1 | 유효한 텔레그램 데이터 → 세션 생성 후 리다이렉트 | 올바른 hash, id, auth_date | 302, `/` |
| A2 | 잘못된 hash → 401 | 조작된 hash | 401 |
| A3 | 만료된 auth_date → 401 | `auth_date = now - 90000` | 401 |
| A4 | redirect 파라미터 있으면 해당 URL로 이동 | redirect=/history | 302, `/history` |
| A5 | hash 파라미터 누락 → 400 | hash 없음 | 400 |

#### POST /api/auth/logout

| ID | 시나리오 | 입력 | 기대값 |
|----|---------|------|--------|
| A6 | 로그아웃 요청 → /login 리다이렉트 | 세션 쿠키 있음 | 302, `/login` |
| A7 | 세션 없어도 로그아웃 처리 완료 | 세션 쿠키 없음 | 302, `/login` |
| A8 | GET 요청 → 405 | GET method | 405 |

---

## 5. 통합 테스트: 인증 흐름

### 파일: `tests/integration/auth-flow.test.ts`

| ID | 시나리오 | 전제 조건 | 기대값 |
|----|---------|----------|--------|
| I1 | 비인증 사용자가 / 접근 시 /login 리다이렉트 | Supabase 세션 없음 | 리다이렉트 발생 |
| I2 | 유효한 텔레그램 데이터로 /api/auth/telegram 호출 시 세션 생성 | 올바른 hash | 302 + Set-Cookie |
| I3 | 세션 쿠키 있으면 보호 라우트 접근 가능 | 세션 쿠키 있음 | 200 통과 |
| I4 | 로그아웃 후 세션 무효화 | 세션 쿠키 있음 | 302 /login |
| I5 | Supabase Admin API 사용자 upsert 정상 동작 | 신규 텔레그램 사용자 | 사용자 생성 |

---

## 6. 테스트 환경 설정

### Mock 대상

```typescript
// Supabase Admin API mock
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn(),
        getUserByEmail: vi.fn(),
        generateLink: vi.fn(),
      },
      signOut: vi.fn(),
    },
  })),
}))

// @supabase/ssr mock
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
  createBrowserClient: vi.fn(),
}))

// next/headers mock
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))
```

### 테스트 픽스처

```typescript
// 유효한 텔레그램 로그인 데이터 (테스트용 bot token으로 서명)
const TEST_BOT_TOKEN = 'test_bot_token_for_testing'
const validTelegramData = {
  id: 123456789,
  first_name: 'JS',
  username: 'jsong1230',
  auth_date: Math.floor(Date.now() / 1000),
  hash: computeValidHash(TEST_BOT_TOKEN, { id: 123456789, ... }),
}
```

---

*F-12 test-spec.md v1.0 | 2026-02-28*
