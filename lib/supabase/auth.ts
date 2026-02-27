// 웹 API용 Supabase Auth 유틸리티
// @supabase/ssr의 createServerClient를 사용하여 쿠키 기반 세션 검증

import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

/**
 * 쿠키 기반 Supabase Auth 클라이언트 생성
 * 웹 대시보드 API Routes에서 사용
 */
function createAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.'
    );
  }

  const cookieStore = cookies();

  return createSSRClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component에서 set 호출 시 무시 (읽기 전용)
        }
      },
    },
  });
}

/**
 * 현재 요청의 인증된 사용자를 반환한다.
 * 세션이 없거나 유효하지 않으면 null을 반환한다.
 */
export async function getAuthUser(): Promise<User | null> {
  try {
    const supabase = createAuthClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
