/**
 * 텔레그램 로그인 위젯 Hash 검증 유틸리티
 * 서버 전용 — TELEGRAM_BOT_TOKEN 노출 방지
 * 참고: https://core.telegram.org/widgets/login#checking-authorization
 */
import crypto from 'crypto';

export interface TelegramLoginData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * 텔레그램 로그인 위젯 hash 검증
 * - secret_key = SHA256(botToken)
 * - data_check_string = 알파벳 오름차순 정렬된 "key=value\n..." (hash 제외)
 * - expected_hash = HMAC_SHA256(secret_key, data_check_string).hex()
 */
export function verifyTelegramLogin(
  data: TelegramLoginData,
  botToken: string
): boolean {
  if (!botToken) {
    return false;
  }

  const { hash, ...userData } = data;

  // undefined 필드 제거 후 알파벳 오름차순 정렬
  const dataCheckString = Object.keys(userData)
    .filter((key) => userData[key as keyof typeof userData] !== undefined)
    .sort()
    .map((key) => `${key}=${userData[key as keyof typeof userData]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // 타이밍 공격 방지를 위해 timingSafeEqual 사용
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (hashBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * 텔레그램 auth_date 만료 검증
 * 기본 86400초 (24시간) 이상 경과 시 만료
 */
export function isTelegramAuthExpired(
  authDate: number,
  maxAgeSeconds: number = 86400
): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - authDate > maxAgeSeconds;
}
