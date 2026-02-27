// F-13 학습 엔진 — EMA 스코어링 단위 테스트 (RED → GREEN)
// AC2: 반응 타입별 점수 변화, AC3: EMA(alpha=0.3)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── EMA 공식 검증 (순수 함수 테스트) ────────────────────────────────────────

describe('EMA_ALPHA 상수', () => {
  it('AC3: EMA_ALPHA는 0.3이어야 한다', async () => {
    vi.resetModules();
    const { EMA_ALPHA } = await import('@/lib/scoring');
    expect(EMA_ALPHA).toBe(0.3);
  });
});

describe('INTERACTION_WEIGHTS 상수', () => {
  it('AC2: 좋아요 가중치는 양수이다', async () => {
    vi.resetModules();
    const { INTERACTION_WEIGHTS } = await import('@/lib/scoring');
    expect(INTERACTION_WEIGHTS['좋아요']).toBeGreaterThan(0);
  });

  it('AC2: 싫어요 가중치는 음수이다', async () => {
    vi.resetModules();
    const { INTERACTION_WEIGHTS } = await import('@/lib/scoring');
    expect(INTERACTION_WEIGHTS['싫어요']).toBeLessThan(0);
  });

  it('AC2: 저장 가중치는 양수이다', async () => {
    vi.resetModules();
    const { INTERACTION_WEIGHTS } = await import('@/lib/scoring');
    expect(INTERACTION_WEIGHTS['저장']).toBeGreaterThan(0);
  });

  it('AC2: 스킵 가중치는 음수이다', async () => {
    vi.resetModules();
    const { INTERACTION_WEIGHTS } = await import('@/lib/scoring');
    expect(INTERACTION_WEIGHTS['스킵']).toBeLessThan(0);
  });
});

describe('calculateContentScore', () => {
  it('태그가 없으면 기본값 0.5를 반환한다', async () => {
    vi.resetModules();
    const { calculateContentScore } = await import('@/lib/scoring');
    const profile = new Map<string, number>();
    expect(calculateContentScore([], profile)).toBe(0.5);
  });

  it('태그 1개가 매칭되면 해당 태그 점수를 반환한다', async () => {
    vi.resetModules();
    const { calculateContentScore } = await import('@/lib/scoring');
    const profile = new Map<string, number>([['AI', 0.8]]);
    expect(calculateContentScore(['AI'], profile)).toBe(0.8);
  });

  it('태그 2개의 평균 점수를 반환한다', async () => {
    vi.resetModules();
    const { calculateContentScore } = await import('@/lib/scoring');
    const profile = new Map<string, number>([
      ['AI', 0.8],
      ['Rust', 0.6],
    ]);
    expect(calculateContentScore(['AI', 'Rust'], profile)).toBeCloseTo(0.7);
  });

  it('프로필에 없는 태그는 0.5 기본값으로 처리한다', async () => {
    vi.resetModules();
    const { calculateContentScore } = await import('@/lib/scoring');
    const profile = new Map<string, number>([['AI', 0.8]]);
    // 'AI' => 0.8, 'Unknown' => 0.5 → 평균 0.65
    expect(calculateContentScore(['AI', 'Unknown'], profile)).toBeCloseTo(0.65);
  });

  it('모든 태그가 프로필에 없으면 0.5를 반환한다', async () => {
    vi.resetModules();
    const { calculateContentScore } = await import('@/lib/scoring');
    const profile = new Map<string, number>();
    expect(calculateContentScore(['AI', 'Rust'], profile)).toBe(0.5);
  });
});

describe('calculateTechScore Phase 2', () => {
  it('AC6: interest, context, recency가 모두 제공되면 공식 0.6:0.3:0.1을 적용한다', async () => {
    vi.resetModules();
    const { calculateTechScore } = await import('@/lib/scoring');
    // 0.8 * 0.6 + 0.5 * 0.3 + 1.0 * 0.1 = 0.48 + 0.15 + 0.1 = 0.73
    const result = calculateTechScore(0.8, 0.8, 0.5, 1.0);
    expect(result).toBeCloseTo(0.73);
  });

  it('AC6: Phase 1 pass-through — interestScore 미제공 시 scoreInitial 반환', async () => {
    vi.resetModules();
    const { calculateTechScore } = await import('@/lib/scoring');
    const result = calculateTechScore(0.7);
    expect(result).toBe(0.7);
  });
});

// ─── EMA 수학 공식 단위 검증 ─────────────────────────────────────────────────

describe('EMA 수학 공식 검증', () => {
  const EMA_ALPHA = 0.3;

  it('좋아요(weight=1.0), currentScore=0.5 → newScore = 0.65', () => {
    const weight = 1.0;
    const currentScore = 0.5;
    const newScore = EMA_ALPHA * weight + (1 - EMA_ALPHA) * currentScore;
    expect(newScore).toBeCloseTo(0.65, 5);
  });

  it('싫어요(weight=-0.8), currentScore=0.7 → newScore < 0.7', () => {
    const weight = -0.8;
    const currentScore = 0.7;
    const rawScore = EMA_ALPHA * weight + (1 - EMA_ALPHA) * currentScore;
    const newScore = Math.max(0.0, Math.min(1.0, rawScore));
    expect(newScore).toBeLessThan(0.7);
  });

  it('클램핑: 매우 낮은 점수도 0.0 이상이다', () => {
    const weight = -0.8;
    const currentScore = 0.01;
    const rawScore = EMA_ALPHA * weight + (1 - EMA_ALPHA) * currentScore;
    const newScore = Math.max(0.0, Math.min(1.0, rawScore));
    expect(newScore).toBeGreaterThanOrEqual(0.0);
  });

  it('클램핑: 매우 높은 점수도 1.0 이하이다', () => {
    const weight = 1.0;
    const currentScore = 0.99;
    const rawScore = EMA_ALPHA * weight + (1 - EMA_ALPHA) * currentScore;
    const newScore = Math.max(0.0, Math.min(1.0, rawScore));
    expect(newScore).toBeLessThanOrEqual(1.0);
  });
});

// ─── updateInterestScore (Supabase mock 필요) ─────────────────────────────────

describe('updateInterestScore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('AC3: EMA 공식으로 점수를 업데이트한다 — 좋아요(currentScore=0.5) → 0.65', async () => {
    // 기존 score=0.5, 좋아요 weight=1.0, alpha=0.3
    // newScore = 0.3 * 1.0 + 0.7 * 0.5 = 0.65
    const capturedUpserts: unknown[] = [];

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'uuid-1', topic: 'AI', score: 0.5, interaction_count: 5 }],
              error: null,
            }),
          }),
          upsert: vi.fn().mockImplementation((data: unknown) => {
            capturedUpserts.push(data);
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    }));

    const { updateInterestScore } = await import('@/lib/scoring');
    await updateInterestScore({ contentId: 'c-1', interaction: '좋아요', tags: ['AI'] });

    expect(capturedUpserts.length).toBeGreaterThan(0);
    const upserted = capturedUpserts[0] as Array<{ topic: string; score: number }>;
    const entries = Array.isArray(upserted) ? upserted : [upserted];
    const aiEntry = entries.find((u) => u.topic === 'AI');
    expect(aiEntry?.score).toBeCloseTo(0.65, 5);
  });

  it('AC2: 싫어요 반응은 점수를 낮춘다 (currentScore=0.7)', async () => {
    const capturedUpserts: unknown[] = [];

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'uuid-1', topic: 'AI', score: 0.7, interaction_count: 3 }],
              error: null,
            }),
          }),
          upsert: vi.fn().mockImplementation((data: unknown) => {
            capturedUpserts.push(data);
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    }));

    const { updateInterestScore } = await import('@/lib/scoring');
    await updateInterestScore({ contentId: 'c-2', interaction: '싫어요', tags: ['AI'] });

    const upserted = capturedUpserts[0] as Array<{ topic: string; score: number }>;
    const entries = Array.isArray(upserted) ? upserted : [upserted];
    const aiEntry = entries.find((u) => u.topic === 'AI');
    expect(aiEntry?.score).toBeLessThan(0.7);
  });

  it('점수는 0.0 이하로 떨어지지 않는다 (클램핑)', async () => {
    const capturedUpserts: unknown[] = [];

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'uuid-1', topic: 'AI', score: 0.05, interaction_count: 1 }],
              error: null,
            }),
          }),
          upsert: vi.fn().mockImplementation((data: unknown) => {
            capturedUpserts.push(data);
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    }));

    const { updateInterestScore } = await import('@/lib/scoring');
    await updateInterestScore({ contentId: 'c-3', interaction: '싫어요', tags: ['AI'] });

    const upserted = capturedUpserts[0] as Array<{ score: number }>;
    const entries = Array.isArray(upserted) ? upserted : [upserted];
    expect(entries[0].score).toBeGreaterThanOrEqual(0.0);
  });

  it('점수는 1.0 초과하지 않는다 (클램핑)', async () => {
    const capturedUpserts: unknown[] = [];

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'uuid-1', topic: 'AI', score: 0.95, interaction_count: 10 }],
              error: null,
            }),
          }),
          upsert: vi.fn().mockImplementation((data: unknown) => {
            capturedUpserts.push(data);
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    }));

    const { updateInterestScore } = await import('@/lib/scoring');
    await updateInterestScore({ contentId: 'c-4', interaction: '좋아요', tags: ['AI'] });

    const upserted = capturedUpserts[0] as Array<{ score: number }>;
    const entries = Array.isArray(upserted) ? upserted : [upserted];
    expect(entries[0].score).toBeLessThanOrEqual(1.0);
  });

  it('DB 조회 오류 시 에러를 throw한다', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB connection error' },
            }),
          }),
          upsert: vi.fn(),
        })),
      })),
    }));

    const { updateInterestScore } = await import('@/lib/scoring');
    await expect(
      updateInterestScore({ contentId: 'c-5', interaction: '좋아요', tags: ['AI'] })
    ).rejects.toThrow();
  });

  it('tags가 비어있으면 아무 작업도 하지 않는다', async () => {
    const mockUpsert = vi.fn();

    vi.doMock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: mockUpsert,
        })),
      })),
    }));

    const { updateInterestScore } = await import('@/lib/scoring');
    await updateInterestScore({ contentId: 'c-6', interaction: '좋아요', tags: [] });

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
