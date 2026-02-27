# F-12 인증 (Supabase Auth + Telegram Login) — 기술 설계서

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정

---

## 1. 개요

### 1.1 목적

Cortex 웹 대시보드에 인증 레이어를 추가한다. 1인 사용자(jsong1230) 전용 서비스이므로 복잡한 다중 사용자 관리 없이, 텔레그램 계정으로 한 번 로그인하면 Supabase Auth 세션이 유지되는 간단한 구조를 채택한다.

### 1.2 인수조건

| ID | 조건 |
|----|------|
| AC1 | Supabase Auth를 통해 웹 로그인/로그아웃이 동작한다 |
| AC2 | 텔레그램 로그인 위젯으로 텔레그램 계정과 웹 계정이 연동된다 |
| AC3 | 인증되지 않은 사용자는 웹 페이지에 접근할 수 없다 (리다이렉트) |

---

## 2. 아키텍처

### 2.1 인증 흐름

```
[브라우저] → 보호 라우트 접근
  → [middleware.ts] 세션 쿠키 확인
    → 세션 있음: 통과
    → 세션 없음: /login?redirect={현재URL} 리다이렉트

[/login 페이지]
  → [TelegramLoginButton] 클릭
  → 텔레그램 앱 승인
  → [콜백] /api/auth/telegram?{telegram_data}
    → HMAC-SHA256 hash 검증 (TELEGRAM_BOT_TOKEN)
    → Supabase Admin API로 사용자 upsert
    → Supabase 세션 토큰 발급
    → 세션 쿠키 Set-Cookie
    → redirect 파라미터 URL 또는 / 리다이렉트

[/api/auth/logout]
  → Supabase 세션 삭제
  → 쿠키 삭제
  → /login 리다이렉트
```

### 2.2 컴포넌트 구성

```
middleware.ts                        # Next.js 미들웨어 (라우트 보호)
├── lib/supabase/middleware.ts       # 미들웨어용 Supabase SSR 클라이언트
├── lib/supabase/client.ts          # 브라우저용 Supabase 클라이언트 (기존 수정)
└── lib/supabase/server.ts          # 서버용 Supabase 클라이언트 (기존 유지)

lib/auth/telegram-verify.ts         # 텔레그램 hash 검증 순수 함수

app/login/page.tsx                  # 로그인 페이지 (Server Component)
components/auth/TelegramLoginButton.tsx  # 텔레그램 로그인 버튼 (Client Component)

app/api/auth/
├── telegram/route.ts               # 텔레그램 콜백 처리 (POST)
└── logout/route.ts                 # 로그아웃 처리 (POST)
```

---

## 3. 보호 라우트 정책

### 3.1 미들웨어 라우트 매칭

| 라우트 패턴 | 보호 여부 | 처리 |
|------------|---------|------|
| `/login` | 비보호 | 통과 (인증된 경우 / 리다이렉트 선택) |
| `/api/*` | 비보호 | 미들웨어 제외, 각 API가 자체 인증 |
| `/_next/*` | 비보호 | Next.js 내부 라우트 제외 |
| `/favicon.ico` | 비보호 | 정적 자산 제외 |
| `/*` (나머지 모두) | 보호 | 세션 없으면 /login 리다이렉트 |

### 3.2 리다이렉트 규칙

- 비인증 접근: `/login?redirect={encodeURIComponent(현재URL)}`
- 로그인 성공: `redirect` 파라미터 URL (없으면 `/`)
- 로그아웃: `/login`

---

## 4. 텔레그램 로그인 위젯 연동

### 4.1 텔레그램 위젯 작동 방식

텔레그램 Login Widget은 사용자가 버튼 클릭 시 텔레그램 앱에서 승인을 받고, 승인된 사용자 데이터를 콜백 URL로 전달한다.

**전달 데이터 형태:**
```
GET /api/auth/telegram?id=123456&first_name=JS&username=jsong1230&auth_date=1709100000&hash=abcdef...
```

### 4.2 Hash 검증 알고리즘

```
secret_key = SHA256(TELEGRAM_BOT_TOKEN)
data_check_string = "auth_date=1709100000\nfirst_name=JS\nid=123456\nusername=jsong1230"
  (hash 필드 제외, 키 알파벳 오름차순 정렬, \n 구분)
expected_hash = HMAC_SHA256(secret_key, data_check_string).hex()
valid = (expected_hash == hash) && (now - auth_date < 86400)
```

### 4.3 Supabase 사용자 생성/조회

Admin API (`SUPABASE_SERVICE_ROLE_KEY`)로 이메일 기반 사용자 upsert:
- 이메일: `{telegram_id}@telegram.cortex.local` (실제 이메일 미사용)
- user_metadata: `{ telegram_id, username, first_name }`
- 중복 시: 기존 사용자 조회 후 세션 생성

### 4.4 세션 생성 방식

Supabase의 `generateLink` (magic link) API를 활용하여 OTP 토큰을 서버에서 직접 생성하고, 브라우저 세션을 `createSessionFromUrl`로 완성한다.

**대안**: `admin.auth.createSession()` API를 사용하면 더 직접적.

---

## 5. API 엔드포인트 설계

### 5.1 GET /api/auth/telegram

텔레그램 위젯 콜백 처리.

**쿼리 파라미터:**
```typescript
{
  id: string         // 텔레그램 사용자 ID
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string  // Unix timestamp
  hash: string       // HMAC-SHA256 서명
  redirect?: string  // 로그인 후 이동할 URL
}
```

**처리 순서:**
1. hash 검증 (실패 시 401)
2. auth_date 만료 검증 (24시간, 실패 시 401)
3. Supabase Admin으로 사용자 upsert
4. Magic link 생성 → OTP 추출
5. Response에 Set-Cookie (Supabase 세션)
6. redirect 파라미터 URL로 302 리다이렉트

### 5.2 POST /api/auth/logout

로그아웃 처리.

**처리 순서:**
1. 요청에서 Supabase 세션 토큰 읽기
2. `supabase.auth.signOut()` 호출
3. 세션 쿠키 삭제 (Set-Cookie: max-age=0)
4. /login으로 302 리다이렉트

---

## 6. 파일별 구현 명세

### 6.1 lib/auth/telegram-verify.ts

```typescript
interface TelegramLoginData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

// 텔레그램 hash 검증 (순수 함수, 서버 전용)
export function verifyTelegramLogin(data: TelegramLoginData, botToken: string): boolean

// auth_date 만료 검증 (기본 24시간)
export function isTelegramAuthExpired(authDate: number, maxAgeSeconds?: number): boolean
```

### 6.2 lib/supabase/middleware.ts

```typescript
// @supabase/ssr의 createServerClient를 Next.js 미들웨어 환경에 맞게 래핑
// 쿠키를 NextRequest/NextResponse에서 읽고 씀
export function createMiddlewareClient(request: NextRequest): {
  supabase: SupabaseClient
  response: NextResponse
}
```

### 6.3 middleware.ts (프로젝트 루트)

```typescript
// 보호 라우트 매처:
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
}

// 로직:
// 1. 미들웨어 클라이언트로 세션 확인
// 2. 세션 없음 → /login?redirect={pathname} 리다이렉트
// 3. 세션 있음 → 쿠키 갱신 후 통과
```

### 6.4 components/auth/TelegramLoginButton.tsx

```typescript
'use client'
// 텔레그램 로그인 스크립트를 동적 로드하는 Client Component
// data-bot-id: NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
// data-auth-url: /api/auth/telegram
// 디자인: 텔레그램 색상 (#0088cc 배경, 흰색 텍스트)
```

---

## 7. 환경변수

| 변수명 | 용도 | 노출 범위 |
|--------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 클라이언트 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API 접근 | 서버 전용 |
| `TELEGRAM_BOT_TOKEN` | Hash 검증 시크릿 | 서버 전용 |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | 위젯 설정용 봇 이름 | 클라이언트 |

> **보안**: `TELEGRAM_BOT_TOKEN`은 절대 클라이언트에 노출 금지. 서버 API에서만 사용.

---

## 8. DB 변경사항

F-12는 Supabase Auth 기능을 활용하며, 별도 테이블 생성 없이 Supabase의 내장 `auth.users` 테이블을 사용한다.

**auth.users에 저장되는 메타데이터:**
```json
{
  "app_metadata": {},
  "user_metadata": {
    "telegram_id": 123456,
    "username": "jsong1230",
    "first_name": "JS"
  }
}
```

**추가 마이그레이션 불필요** — Supabase Auth는 이미 활성화되어 있음.

---

## 9. 보안 고려사항

1. **Hash 검증 필수**: 텔레그램에서 전달된 모든 데이터는 HMAC-SHA256으로 검증
2. **auth_date 만료**: 24시간 초과 시 재인증 요구
3. **Bot Token 서버 전용**: `TELEGRAM_BOT_TOKEN` 환경변수는 서버에서만 접근
4. **1인 사용자**: 텔레그램 ID가 허용 목록(`TELEGRAM_CHAT_ID`)과 일치하는지 추가 검증 가능
5. **HTTPS 필수**: 쿠키 `Secure` 플래그 (Vercel 배포 환경)

---

## 10. 테스트 전략

| 테스트 유형 | 대상 | 방법 |
|------------|------|------|
| 단위 테스트 | `verifyTelegramLogin()`, `isTelegramAuthExpired()` | Vitest, 순수 함수 |
| 단위 테스트 | 미들웨어 리다이렉트 로직 | Vitest + Next.js 모킹 |
| 단위 테스트 | 인증 API 라우트 | Vitest + fetch 모킹 |
| 통합 테스트 | 전체 인증 흐름 | Vitest + Supabase 모킹 |

---

*F-12 design.md v1.0 | 2026-02-28*
