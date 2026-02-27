// F-05 AI 요약/스코어링 — scoring.ts 단위 테스트
// test-spec.md U-20 ~ U-22

import { describe, it, expect } from 'vitest';
import { calculateTechScore } from '@/lib/scoring';

describe('calculateTechScore', () => {
  // U-20: Phase 1 pass-through — scoreInitial을 그대로 반환
  it('U-20: Phase 1에서 scoreInitial=0.7을 그대로 반환한다 (pass-through)', () => {
    const result = calculateTechScore(0.7);
    expect(result).toBe(0.7);
  });

  // U-21: 범위 검증 — scoreInitial=0.0
  it('U-21: scoreInitial=0.0을 그대로 0.0으로 반환한다', () => {
    const result = calculateTechScore(0.0);
    expect(result).toBe(0.0);
  });

  // U-22: 범위 검증 — scoreInitial=1.0
  it('U-22: scoreInitial=1.0을 그대로 1.0으로 반환한다', () => {
    const result = calculateTechScore(1.0);
    expect(result).toBe(1.0);
  });

  // 추가 검증
  it('중간값 0.5를 그대로 반환한다', () => {
    const result = calculateTechScore(0.5);
    expect(result).toBe(0.5);
  });

  // F-13 Phase 2 활성화: interest/context/recency가 모두 제공되면 가중 공식 적용
  // 0.9*0.6 + 0.8*0.3 + 0.7*0.1 = 0.54 + 0.24 + 0.07 = 0.85
  it('Phase 2: interest/context/recency가 모두 제공되면 가중 공식(0.6:0.3:0.1)을 적용한다', () => {
    const result = calculateTechScore(0.6, 0.9, 0.8, 0.7);
    expect(result).toBeCloseTo(0.85);
  });
});
