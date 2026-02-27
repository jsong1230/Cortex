// lib/alerts.ts 단위 테스트
import { describe, it, expect } from 'vitest';
import { isQuietHours } from '@/lib/alerts';

describe('isQuietHours', () => {
  it('자정을 넘는 방해 금지 시간 내에 있으면 true', () => {
    // 23:00 ~ 07:00, 현재 00:30
    const midnight = new Date();
    midnight.setHours(0, 30, 0, 0);
    expect(isQuietHours('23:00', '07:00', midnight)).toBe(true);
  });

  it('방해 금지 시간 종료 후에는 false', () => {
    // 23:00 ~ 07:00, 현재 09:00
    const morning = new Date();
    morning.setHours(9, 0, 0, 0);
    expect(isQuietHours('23:00', '07:00', morning)).toBe(false);
  });

  it('방해 금지 시작 직후에는 true', () => {
    // 23:00 ~ 07:00, 현재 23:30
    const night = new Date();
    night.setHours(23, 30, 0, 0);
    expect(isQuietHours('23:00', '07:00', night)).toBe(true);
  });
});
