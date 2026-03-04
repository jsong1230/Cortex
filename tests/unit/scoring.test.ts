// F-05 AI 요약/스코어링 — scoring.ts 단위 테스트
// test-spec.md U-20 ~ U-22
// I-12: 부분 정보 처리 케이스 추가

import { describe, it, expect } from 'vitest';
import { calculateTechScore, calculateRecencyScore } from '@/lib/scoring';

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

  it('중간값 0.5를 그대로 반환한다', () => {
    const result = calculateTechScore(0.5);
    expect(result).toBe(0.5);
  });

  // 세 값 모두 제공: 0.9*0.6 + 0.8*0.3 + 0.7*0.1 = 0.54 + 0.24 + 0.07 = 0.85
  it('interest/context/recency가 모두 제공되면 가중 공식(0.6:0.3:0.1)을 적용한다', () => {
    const result = calculateTechScore(0.6, 0.9, 0.8, 0.7);
    expect(result).toBeCloseTo(0.85);
  });

  // ─── I-12: 부분 정보 처리 ────────────────────────────────────────────────

  it('I-12-1: interestScore만 있으면 가중치 정규화하여 계산한다', () => {
    // interest(0.6) + scoreInitial 보완(0.4)
    // 0.9 * 0.6 + 0.5 * 0.4 = 0.54 + 0.20 = 0.74
    const result = calculateTechScore(0.5, 0.9, undefined, undefined);
    expect(result).toBeCloseTo(0.74);
  });

  it('I-12-2: interest + context만 있으면 recency 가중치를 scoreInitial로 보완한다', () => {
    // interest(0.6) + context(0.3) + scoreInitial 보완(0.1)
    // 0.9*0.6 + 0.8*0.3 + 0.5*0.1 = 0.54 + 0.24 + 0.05 = 0.83
    const result = calculateTechScore(0.5, 0.9, 0.8, undefined);
    expect(result).toBeCloseTo(0.83);
  });

  it('I-12-3: recencyScore만 있으면 나머지 0.9 가중치를 scoreInitial로 채운다', () => {
    // recency(0.1) + scoreInitial 보완(0.9)
    // 1.0*0.1 + 0.5*0.9 = 0.10 + 0.45 = 0.55
    const result = calculateTechScore(0.5, undefined, undefined, 1.0);
    expect(result).toBeCloseTo(0.55);
  });
});

describe('calculateRecencyScore', () => {
  it('방금 발행된 아이템(0시간)은 점수 1.0에 가깝다', () => {
    const now = new Date().toISOString();
    const score = calculateRecencyScore(now);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('24시간 전 아이템은 점수가 약 0.30이다 (λ=0.05)', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const score = calculateRecencyScore(yesterday);
    // exp(-0.05 * 24) ≈ 0.301
    expect(score).toBeCloseTo(0.301, 1);
  });

  it('48시간 전 아이템은 점수가 약 0.09이다', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const score = calculateRecencyScore(twoDaysAgo);
    // exp(-0.05 * 48) ≈ 0.0907
    expect(score).toBeCloseTo(0.091, 1);
  });

  it('published_at이 null이면 중간값 0.5를 반환한다', () => {
    expect(calculateRecencyScore(null)).toBe(0.5);
    expect(calculateRecencyScore(undefined)).toBe(0.5);
  });

  it('잘못된 날짜 문자열이면 중간값 0.5를 반환한다', () => {
    expect(calculateRecencyScore('not-a-date')).toBe(0.5);
  });
});
