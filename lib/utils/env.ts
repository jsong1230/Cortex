// 필수 환경변수 시작 시 검증 유틸
// 앱 초기화 경로(route handler, cron 등)에서 호출하여 누락 즉시 감지

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_WEBHOOK_SECRET',
  'CRON_SECRET',
] as const;

/**
 * 필수 환경변수 존재 여부를 확인한다.
 * 누락된 항목이 있으면 에러 메시지를 반환한다.
 * 모두 존재하면 null을 반환한다.
 */
export function checkRequiredEnv(): string | null {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length === 0) return null;
  return `필수 환경변수 누락: ${missing.join(', ')}`;
}

/**
 * 필수 환경변수가 누락된 경우 에러를 throw한다.
 * cron, webhook 등 서버 진입점에서 호출한다.
 * 테스트 환경(NODE_ENV=test)에서는 스킵한다.
 */
export function assertRequiredEnv(): void {
  if (process.env.NODE_ENV === 'test') return;
  const error = checkRequiredEnv();
  if (error) throw new Error(error);
}
