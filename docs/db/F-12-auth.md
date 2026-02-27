# F-12 인증 — DB 스키마 확정본

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정 (구현 완료)

---

## 1. 개요

F-12 인증은 **Supabase Auth 내장 테이블**을 활용하며, 별도 마이그레이션 파일이 필요 없다.

Supabase 프로젝트에는 `auth` 스키마 하위에 다음 테이블이 이미 존재:
- `auth.users` — 사용자 정보
- `auth.sessions` — 활성 세션
- `auth.refresh_tokens` — 리프레시 토큰

---

## 2. auth.users 테이블 (Supabase 내장)

F-12에서 사용하는 컬럼:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK, 자동 생성 |
| `email` | text | `{telegram_id}@telegram.cortex.local` 형식 |
| `email_confirmed_at` | timestamptz | 생성 시 즉시 confirmed (admin.createUser) |
| `user_metadata` | jsonb | 텔레그램 사용자 데이터 |
| `created_at` | timestamptz | 최초 로그인 시각 |
| `updated_at` | timestamptz | 마지막 업데이트 |

### user_metadata 구조

텔레그램 로그인 시 저장되는 메타데이터:

```json
{
  "telegram_id": 123456789,
  "username": "jsong1230",
  "first_name": "JS",
  "last_name": null
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `telegram_id` | number | 필수 | 텔레그램 사용자 ID |
| `username` | string \| null | 선택 | 텔레그램 사용자명 |
| `first_name` | string | 필수 | 이름 |
| `last_name` | string \| null | 선택 | 성 |

---

## 3. 이메일 네이밍 규칙

텔레그램 인증은 실제 이메일이 없으므로 가상 이메일을 사용:

```
{telegram_id}@telegram.cortex.local
```

예시: `123456789@telegram.cortex.local`

**이 이메일의 특징:**
- Supabase에서 유효한 이메일 형식으로 인정
- 실제 이메일 서버로 전송되지 않음 (`admin.createUser`에서 `email_confirm: true`)
- telegram_id로 사용자 lookup 가능

---

## 4. 마이그레이션

**별도 마이그레이션 파일 없음.**

Supabase Auth는 프로젝트 생성 시 자동으로 `auth` 스키마를 초기화한다.
기존 `supabase/migrations/` 파일에 추가할 내용 없음.

---

## 5. 인덱스 (Supabase 내장)

Supabase Auth가 자동으로 관리하는 인덱스:
- `auth.users.email` — UNIQUE INDEX (로그인 중복 방지)
- `auth.sessions.user_id` — INDEX (세션 조회)

---

## 6. RLS 정책

Supabase Auth 테이블에는 RLS가 자동 적용되어 있으며, 수정 불필요.

다른 Cortex 테이블에서 인증 사용자 ID로 필터링:
```sql
-- 예시: content_items에서 인증된 사용자만 접근
CREATE POLICY "authenticated users only" ON content_items
  FOR SELECT TO authenticated USING (true);
```

---

*F-12 DB spec v1.0 | 2026-02-28*
