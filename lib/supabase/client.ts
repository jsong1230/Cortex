/**
 * Supabase 클라이언트 — 브라우저(클라이언트 컴포넌트)용
 * NEXT_PUBLIC_SUPABASE_ANON_KEY 사용 → RLS 정책 적용
 * 절대 서버 컴포넌트나 API Route에서 사용 금지
 */
import { createBrowserClient } from '@supabase/ssr';

/** 기존 호환성 유지 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** 명시적 네이밍 버전 (권장) */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
