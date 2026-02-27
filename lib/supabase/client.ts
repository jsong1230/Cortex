// Supabase 클라이언트 — 브라우저(클라이언트 컴포넌트)용
// NEXT_PUBLIC_SUPABASE_ANON_KEY 사용 → RLS 정책 적용

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
