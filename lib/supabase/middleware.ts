/**
 * 미들웨어용 Supabase SSR 클라이언트
 * NextRequest/NextResponse 쿠키 기반 세션 관리
 * @supabase/ssr 패턴 준수
 */
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js 미들웨어 환경에서 사용하는 Supabase 클라이언트 생성
 * 쿠키를 NextRequest에서 읽고 NextResponse에 씀
 */
export function createMiddlewareClient(request: NextRequest): {
  supabase: ReturnType<typeof createServerClient>;
  response: NextResponse;
} {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // request에 쿠키 설정
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // response 갱신 (갱신된 쿠키 포함)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          // response에 쿠키 설정
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}
