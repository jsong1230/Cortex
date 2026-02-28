// 봇 OTP 로그인 — HMAC 기반 (DB 저장 불필요)
// 1. 6자리 코드 생성 → HMAC 서명 → 쿠키에 challenge 저장
// 2. 봇이 코드를 텔레그램으로 전송
// 3. 사용자가 코드 입력 → HMAC 재검증

import { createHmac, randomInt } from 'crypto';

const OTP_TTL_SECONDS = 300; // 5분

export interface OtpChallenge {
  hash: string;
  expiresAt: number; // Unix timestamp (seconds)
}

/**
 * 6자리 숫자 OTP 생성
 */
export function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

/**
 * OTP challenge 생성 (HMAC 서명)
 */
export function createChallenge(code: string, secret: string): OtpChallenge {
  const expiresAt = Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS;
  const hash = createHmac('sha256', secret)
    .update(`${code}:${expiresAt}`)
    .digest('hex');

  return { hash, expiresAt };
}

/**
 * OTP 검증 (challenge의 HMAC과 비교)
 */
export function verifyOtp(
  code: string,
  challenge: OtpChallenge,
  secret: string,
): boolean {
  // 만료 체크
  if (Math.floor(Date.now() / 1000) > challenge.expiresAt) {
    return false;
  }

  // HMAC 재생성 후 비교
  const expectedHash = createHmac('sha256', secret)
    .update(`${code}:${challenge.expiresAt}`)
    .digest('hex');

  return expectedHash === challenge.hash;
}
