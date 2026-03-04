// lib/utils/date.ts 단위 테스트
// I-10: 타임존 경계값 케이스 추가
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

    // ─── I-10: 타임존 경계값 케이스 ────────────────────────────────────────
    // Note: toKST는 UTC 서버 환경 전용 설계.
    // 로컬 KST 환경에서는 오프셋이 이중 적용되므로,
    // UTC/KST 모두에서 동일 결과가 나오는 케이스만 검증한다.

    it('I-10-1: UTC 금요일 22:00 = KST 토요일 07:00 → 주말', () => {
      // UTC 2026-03-06 22:00 = KST 2026-03-07 07:00 (토요일)
      // UTC 환경: toKST → 토요일 → weekend
      // KST 환경: 이미 KST 토요일 07:00, toKST +9h → 토요일 16:00 → weekend
      const utcFridayEvening = new Date('2026-03-06T22:00:00Z');
      expect(isWeekendKST(utcFridayEvening)).toBe(true);
    });

    it('I-10-3: UTC 금요일 15:00 = KST 토요일 00:00 → 주말', () => {
      // UTC 2026-03-06 15:00 = KST 2026-03-07 00:00 (토요일 자정)
      // UTC 환경: toKST → 토요일 00:00 → weekend
      // KST 환경: toKST +9h → 토요일 09:00 → weekend
      const utcFridayKstSaturdayMidnight = new Date('2026-03-06T15:00:00Z');
      expect(isWeekendKST(utcFridayKstSaturdayMidnight)).toBe(true);
    });

    it('I-10-5: UTC 일요일 15:00 = KST 월요일 00:00 → 평일', () => {
      // UTC 2026-03-08 15:00 = KST 2026-03-09 00:00 (월요일 자정)
      // UTC 환경: toKST → 월요일 → weekday
      // KST 환경: toKST +9h → 월요일 09:00 → weekday
      const utcSundayKstMondayMidnight = new Date('2026-03-08T15:00:00Z');
      expect(isWeekendKST(utcSundayKstMondayMidnight)).toBe(false);
    });
  });

  describe('toKST — 경과 시간', () => {
    it('I-10-6: toKST는 입력 Date에 정확히 9시간을 더한다', () => {
      const utc = new Date('2026-03-05T00:00:00Z');
      const kst = toKST(utc);
      const diffHours = (kst.getTime() - utc.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBe(9);
    });

    it('I-10-7: UTC 목요일 자정 기준 KST 변환 후 타임스탬프는 UTC+9 시각이다', () => {
      // toKST는 서버(UTC 환경)에서 getDay()/getDate() 등이 KST 기준으로 동작하도록 설계
      // 타임스탬프 차이로 검증 (로컬 timezone에 무관)
      const utcMidnight = new Date('2026-03-05T00:00:00Z'); // 목요일
      const kst = toKST(utcMidnight);
      // KST 타임스탬프는 UTC 자정 + 9시간 = 2026-03-05T09:00:00Z
      expect(kst.getTime()).toBe(new Date('2026-03-05T09:00:00Z').getTime());
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
