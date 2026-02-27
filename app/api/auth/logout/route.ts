/**
 * POST /api/auth/logout
 * 로그아웃 처리 — 세션 삭제 후 /login 리다이렉트
 *
 * AC1: Supabase Auth를 통해 웹 로그아웃이 동작한다
 */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(_request: Request): Promise<NextResponse> {
  const cookieStore = cookies();

  // SSR Supabase 클라이언트 생성 (쿠키 기반)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // 읽기 전용 환경에서 쿠키 설정 실패 무시
            }
          });
        },
      },
    }
  );

  // 세션 삭제 (에러 발생해도 /login으로 이동)
  await supabase.auth.signOut();

  // /login으로 리다이렉트
  return NextResponse.redirect(new URL('/login', new URL(_request.url).origin), {
    status: 302,
  });
}

// GET 메서드는 지원하지 않음 (undefined = 405 자동 처리)
// export const GET = undefined; // 명시적 미노출
