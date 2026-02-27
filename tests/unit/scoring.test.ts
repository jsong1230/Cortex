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

  it('Phase 2 파라미터를 전달해도 Phase 1에서는 scoreInitial만 사용한다', () => {
    const result = calculateTechScore(0.6, 0.9, 0.8, 0.7);
    expect(result).toBe(0.6);
  });
});
