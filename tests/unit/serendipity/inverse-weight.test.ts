// F-23 세렌디피티 — calculateInverseWeight 단위 테스트
// AC2: 약한 역가중치로 평소 관심사와 다른 영역이 선택되도록 한다

import { describe, it, expect } from 'vitest';
import { calculateInverseWeight } from '@/lib/serendipity';

describe('calculateInverseWeight', () => {
  it('AC2-1: 태그가 없으면 최대 역가중치(1.0 + 0.2 = 1.2)를 반환한다', () => {
    const profile = new Map<string, number>([['llm', 0.9]]);
    const result = calculateInverseWeight([], profile);
    // 태그 없음 → averageInterestScore = 0 → 1.0 - 0 + 0.2 = 1.2
    expect(result).toBeCloseTo(1.2);
  });

  it('AC2-2: 프로필에 없는 태그는 interest_score=0으로 취급하여 높은 역가중치를 반환한다', () => {
    const profile = new Map<string, number>([['llm', 0.9]]);
    const result = calculateInverseWeight(['unknown-topic'], profile);
    // averageInterestScore = 0 → 1.0 - 0 + 0.2 = 1.2
    expect(result).toBeCloseTo(1.2);
  });

  it('AC2-3: 높은 관심도 태그는 낮은 역가중치를 반환한다', () => {
    const profile = new Map<string, number>([['llm', 0.9], ['cloud', 0.8]]);
    const result = calculateInverseWeight(['llm', 'cloud'], profile);
    // averageInterestScore = (0.9 + 0.8) / 2 = 0.85 → 1.0 - 0.85 + 0.2 = 0.35
    expect(result).toBeCloseTo(0.35);
  });

  it('AC2-4: 낮은 관심도 태그는 높은 역가중치를 반환한다', () => {
    const profile = new Map<string, number>([['cooking', 0.1], ['gardening', 0.05]]);
    const result = calculateInverseWeight(['cooking', 'gardening'], profile);
    // averageInterestScore = (0.1 + 0.05) / 2 = 0.075 → 1.0 - 0.075 + 0.2 = 1.125
    expect(result).toBeCloseTo(1.125);
  });

  it('AC2-5: 역가중치는 항상 0보다 크다 (최소 0.2)', () => {
    // 관심도 1.0짜리 태그 → 1.0 - 1.0 + 0.2 = 0.2
    const profile = new Map<string, number>([['llm', 1.0]]);
    const result = calculateInverseWeight(['llm'], profile);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(0.2);
  });

  it('AC2-6: 관심도 0.5인 태그는 역가중치 0.7이다', () => {
    const profile = new Map<string, number>([['tech', 0.5]]);
    const result = calculateInverseWeight(['tech'], profile);
    // 1.0 - 0.5 + 0.2 = 0.7
    expect(result).toBeCloseTo(0.7);
  });

  it('AC2-7: 빈 프로필이면 모든 태그 점수가 0으로 취급된다', () => {
    const profile = new Map<string, number>();
    const result = calculateInverseWeight(['llm', 'cloud'], profile);
    // averageInterestScore = 0 → 1.0 - 0 + 0.2 = 1.2
    expect(result).toBeCloseTo(1.2);
  });
});
