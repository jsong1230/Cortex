# F-12 인증 — API 스펙 확정본

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정 (구현 완료)

---

## 1. 개요

Supabase Auth + 텔레그램 로그인 위젯을 사용한 인증 API.

- **기본 URL**: `/api/auth`
- **인증 방식**: Supabase SSR 쿠키 기반 세션
- **사용 환경**: 서버 사이드 (API Route)

---

## 2. 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/auth/telegram` | 텔레그램 로그인 콜백 처리 |
| GET | `/api/auth/callback` | Supabase OTP 세션 교환 |
| POST | `/api/auth/logout` | 로그아웃 |

---

## 3. GET /api/auth/telegram

텔레그램 Login Widget 콜백 처리. 텔레그램 위젯이 사용자 승인 후 이 URL로 리다이렉트.

### 요청

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `id` | string | 필수 | 텔레그램 사용자 ID |
| `first_name` | string | 필수 | 텔레그램 이름 |
| `auth_date` | string | 필수 | 인증 시각 (Unix timestamp) |
| `hash` | string | 필수 | HMAC-SHA256 서명 |
| `username` | string | 선택 | 텔레그램 사용자명 |
| `last_name` | string | 선택 | 성 |
| `photo_url` | string | 선택 | 프로필 이미지 URL |
| `redirect` | string | 선택 | 로그인 성공 후 이동할 경로 (기본값: `/`) |

### 응답

**성공 (302):**
```
Location: /api/auth/callback?token_hash={otp}&type=magiclink&next={redirect}
```

**실패:**

| 상태 코드 | 조건 | 응답 |
|----------|------|------|
| 400 | 필수 파라미터 누락 | `{ "error": "필수 파라미터가 누락되었습니다." }` |
| 401 | 잘못된 hash | `{ "error": "Hash 검증 실패: 유효하지 않은 텔레그램 데이터입니다." }` |
| 401 | auth_date 24시간 초과 | `{ "error": "인증 데이터가 만료되었습니다. 다시 로그인해주세요." }` |
| 500 | Supabase 오류 | `{ "error": "..." }` |

### Hash 검증 알고리즘

```
secret_key = SHA256(TELEGRAM_BOT_TOKEN)
data_check_string = join(sort(keys - 'hash').map(k => k + "=" + v), "\n")
expected_hash = HMAC_SHA256(secret_key, data_check_string).hex()
valid = timingSafeEqual(expected_hash, hash) && (now - auth_date) <= 86400
```

---

## 4. GET /api/auth/callback

Supabase OTP 토큰을 세션으로 교환하는 콜백. `/api/auth/telegram` 성공 후 내부적으로 리다이렉트되는 엔드포인트.

### 요청

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `token_hash` | string | 필수 | Supabase magic link OTP 토큰 |
| `type` | string | 필수 | `magiclink` 고정 |
| `next` | string | 선택 | 세션 교환 성공 후 이동할 경로 (기본값: `/`) |

### 응답

**성공 (302):**
```
Location: {next}  (세션 쿠키 Set-Cookie 포함)
```

**실패 (302):**
```
Location: /login?error={error_message}
```

---

## 5. POST /api/auth/logout

로그아웃 처리. Supabase 세션 삭제 후 `/login`으로 리다이렉트.

### 요청

- Body: 없음
- Headers: 세션 쿠키 자동 포함 (브라우저)

### 응답

**항상 302 리다이렉트:**
```
Location: /login
Set-Cookie: (세션 쿠키 삭제)
```

세션이 없어도 동일하게 처리 (에러 없음).

---

## 6. 미들웨어 보호 라우트

`middleware.ts`가 처리하는 라우트 보호:

**보호 대상 (인증 필요):**
- `/*` — `/login`, `/api/*`, `/_next/*`, `/favicon.ico` 제외한 모든 경로

**매처 패턴:**
```
/((?!api|_next/static|_next/image|favicon.ico|login).*)
```

**비인증 접근 시:**
```
302 → /login?redirect={encodeURIComponent(현재 경로+쿼리스트링)}
```

---

## 7. 관련 파일

| 파일 | 역할 |
|------|------|
| `middleware.ts` | 라우트 보호 미들웨어 |
| `lib/auth/telegram-verify.ts` | Hash 검증 순수 함수 |
| `lib/supabase/middleware.ts` | 미들웨어용 Supabase 클라이언트 |
| `lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트 |
| `lib/supabase/server.ts` | 서버용 Supabase Admin 클라이언트 |
| `app/api/auth/telegram/route.ts` | 텔레그램 콜백 API |
| `app/api/auth/callback/route.ts` | OTP 세션 교환 API |
| `app/api/auth/logout/route.ts` | 로그아웃 API |
| `app/login/page.tsx` | 로그인 페이지 |
| `components/auth/TelegramLoginButton.tsx` | 텔레그램 로그인 버튼 컴포넌트 |

---

*F-12 API spec v1.0 | 2026-02-28*
