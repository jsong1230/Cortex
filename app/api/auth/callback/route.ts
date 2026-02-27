/**
 * GET /api/auth/callback
 * Supabase Auth 세션 교환 콜백
 * Magic Link OTP 토큰을 세션으로 교환 후 redirect
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/';

  if (!tokenHash || type !== 'magiclink') {
    return NextResponse.redirect(new URL('/login?error=invalid_callback', request.url));
  }

  const cookieStore = cookies();

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
              // 읽기 전용 환경에서 무시
            }
          });
        },
      },
    }
  );

  // OTP 토큰으로 세션 교환
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  // 세션 교환 성공 → next URL로 리다이렉트 (Open Redirect 방지)
  const redirectUrl = new URL(next, request.url);
  const baseUrl = new URL(request.url);
  const safeRedirect = redirectUrl.origin === baseUrl.origin ? redirectUrl : new URL('/', request.url);
  return NextResponse.redirect(safeRedirect);
}
