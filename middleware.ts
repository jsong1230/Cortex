/**
 * Next.js 미들웨어 — 인증 라우트 보호
 * AC3: 인증되지 않은 사용자는 웹 페이지에 접근할 수 없다 (리다이렉트)
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { supabase, response } = createMiddlewareClient(request);

  // 세션 갱신 및 사용자 확인
  // getUser()는 서버에서 세션 쿠키를 검증하며 보안상 더 안전
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // 인증되지 않은 접근 → /login?redirect={현재URL} 리다이렉트
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set(
      'redirect',
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(redirectUrl);
  }

  // 인증된 사용자 → 세션 쿠키 갱신 후 통과
  return response;
}

export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 라우트에 미들웨어 적용:
     * - /login: 로그인 페이지 (인증 불필요)
     * - /api/*: API 라우트 (각 API가 자체 인증 처리)
     * - /_next/static, /_next/image: Next.js 내부 자산
     * - /favicon.ico: 파비콘
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
};
