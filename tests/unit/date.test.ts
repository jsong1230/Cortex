// lib/utils/date.ts 단위 테스트
import { describe, it, expect } from 'vitest';
import { toKST, formatDate, isWeekendKST, getExpiresAt } from '@/lib/utils/date';

describe('date utilities', () => {
  describe('toKST', () => {
    it('UTC 시간에 9시간을 더한다', () => {
      const utc = new Date('2026-02-27T00:00:00Z');
      const kst = toKST(utc);
      // toKST는 +9시간 오프셋을 추가하므로, getTime() 차이로 검증
      const diffHours = (kst.getTime() - utc.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBe(9);
    });
  });

  describe('formatDate', () => {
    it('날짜를 YYYY-MM-DD 형식으로 변환한다', () => {
      const date = new Date('2026-02-27T12:00:00');
      expect(formatDate(date)).toBe('2026-02-27');
    });

    it('한 자리 월/일에 0을 채운다', () => {
      const date = new Date('2026-01-05T12:00:00');
      expect(formatDate(date)).toBe('2026-01-05');
    });
  });

  describe('isWeekendKST', () => {
    it('토요일은 주말이다', () => {
      // 2026-02-28은 토요일 (UTC)
      const saturday = new Date('2026-02-27T16:00:00Z'); // KST 토요일 01:00
      expect(isWeekendKST(saturday)).toBe(true);
    });
  });

  describe('getExpiresAt', () => {
    it('기본 7일 후 만료 타임스탬프를 반환한다', () => {
      const before = Date.now();
      const expires = new Date(getExpiresAt()).getTime();
      const after = Date.now();

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(expires).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
      expect(expires).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
    });
  });
});
