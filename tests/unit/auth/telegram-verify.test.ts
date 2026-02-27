/**
 * F-12 인증 — 텔레그램 Hash 검증 단위 테스트
 * RED 단계: 구현 전 실패하는 테스트
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyTelegramLogin, isTelegramAuthExpired } from '@/lib/auth/telegram-verify';

// 테스트용 봇 토큰
const TEST_BOT_TOKEN = 'test_bot_token_123456';

/**
 * 테스트용 유효한 hash 생성 헬퍼
 */
function computeValidHash(
  botToken: string,
  data: Record<string, string | number>
): string {
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');
  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

describe('verifyTelegramLogin', () => {
  const now = Math.floor(Date.now() / 1000);

  const baseUserData = {
    id: 123456789,
    first_name: 'JS',
    username: 'jsong1230',
    auth_date: now,
  };

  it('T1-01: 유효한 hash면 true를 반환한다', () => {
    const hash = computeValidHash(TEST_BOT_TOKEN, baseUserData);
    const result = verifyTelegramLogin(
      { ...baseUserData, hash },
      TEST_BOT_TOKEN
    );
    expect(result).toBe(true);
  });

  it('T1-02: 잘못된 hash면 false를 반환한다', () => {
    const result = verifyTelegramLogin(
      { ...baseUserData, hash: 'invalid_hash_value' },
      TEST_BOT_TOKEN
    );
    expect(result).toBe(false);
  });

  it('T1-03: hash 필드 제외 후 알파벳 오름차순 정렬로 검증한다', () => {
    // 선택적 필드 포함 (last_name, photo_url)
    const dataWithOptionals = {
      id: 123456789,
      first_name: 'JS',
      last_name: 'Song',
      username: 'jsong1230',
      photo_url: 'https://t.me/photo.jpg',
      auth_date: now,
    };
    const hash = computeValidHash(TEST_BOT_TOKEN, dataWithOptionals);
    const result = verifyTelegramLogin(
      { ...dataWithOptionals, hash },
      TEST_BOT_TOKEN
    );
    expect(result).toBe(true);
  });

  it('T1-04: 빈 botToken이면 false를 반환한다', () => {
    const hash = computeValidHash(TEST_BOT_TOKEN, baseUserData);
    const result = verifyTelegramLogin(
      { ...baseUserData, hash },
      ''
    );
    expect(result).toBe(false);
  });
});

describe('isTelegramAuthExpired', () => {
  const now = Math.floor(Date.now() / 1000);

  it('T2-01: 현재 시각 auth_date면 만료되지 않았다', () => {
    expect(isTelegramAuthExpired(now)).toBe(false);
  });

  it('T2-02: 23시간 전 auth_date면 만료되지 않았다', () => {
    const authDate = now - 23 * 3600;
    expect(isTelegramAuthExpired(authDate)).toBe(false);
  });

  it('T2-03: 25시간 전 auth_date면 만료되었다', () => {
    const authDate = now - 25 * 3600;
    expect(isTelegramAuthExpired(authDate)).toBe(true);
  });

  it('T2-04: maxAgeSeconds를 60초로 설정하면 120초 전은 만료이다', () => {
    const authDate = now - 120;
    expect(isTelegramAuthExpired(authDate, 60)).toBe(true);
  });
});
