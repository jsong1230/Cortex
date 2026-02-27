// Supabase 서버 클라이언트 — API Routes / Server Components용
// SUPABASE_SERVICE_ROLE_KEY 사용 → RLS 우회 (서버 전용)

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * 서버 전용 Supabase 클라이언트 (Service Role Key 사용)
 * Cron API Routes, 내부 서버 로직에서만 사용
 * 클라이언트 컴포넌트에서 절대 사용 금지
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.'
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
