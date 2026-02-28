// F-17 AC3 — 7일 연속 무반응 감지 + 아이템 수 자동 감소 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase 모킹 ───────────────────────────────────────────────────────────

let mockInteractionRows: unknown[] = [];
let mockInteractionError: { message: string } | null = null;
let mockSettingsRow: Record<string, unknown> | null = null;
let mockSettingsError: { message: string } | null = null;
let mockUpsertError: { message: string } | null = null;

// select 체인을 위한 유연한 모킹
const buildSelectChain = (rows: unknown[], error: { message: string } | null) => ({
  select: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn().mockImplementation(async () => ({ data: mockSettingsRow, error: mockSettingsError })),
  then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) =>
    Promise.resolve(cb({ data: rows, error }))
  ),
});

const mockUpsert = vi.fn().mockImplementation(async () => ({ data: null, error: mockUpsertError }));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'user_interactions') {
        return buildSelectChain(mockInteractionRows, mockInteractionError);
      }
      // cortex_settings
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(async () => ({
            data: mockSettingsRow,
            error: mockSettingsError,
          })),
        }),
        upsert: mockUpsert,
      };
    }),
  })),
}));

import {
  checkNoReactionStreak,
  updateItemReduction,
  MAX_ITEM_REDUCTION,
} from '@/lib/fatigue-prevention';

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('checkNoReactionStreak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInteractionRows = [];
    mockInteractionError = null;
    mockSettingsRow = null;
    mockSettingsError = null;
  });

  it('AC3-1: 최근 7일간 반응이 없으면 true를 반환한다', async () => {
    mockInteractionRows = [];

    const result = await checkNoReactionStreak();

    expect(result).toBe(true);
  });

  it('AC3-2: 최근 7일간 반응이 있으면 false를 반환한다', async () => {
    mockInteractionRows = [{ id: 'interaction-1', interaction: '좋아요' }];

    const result = await checkNoReactionStreak();

    expect(result).toBe(false);
  });

  it('AC3-3: DB 오류 시 false를 반환한다 (안전 기본값)', async () => {
    mockInteractionError = { message: 'DB 오류' };

    const result = await checkNoReactionStreak();

    expect(result).toBe(false);
  });
});

describe('updateItemReduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsRow = null;
    mockSettingsError = null;
    mockUpsertError = null;
    mockUpsert.mockImplementation(async () => ({ data: null, error: mockUpsertError }));
  });

  it('AC3-4: 현재 감소량이 0이면 2로 증가한다', async () => {
    mockSettingsRow = { item_reduction: 0 };

    const newReduction = await updateItemReduction();

    expect(newReduction).toBe(2);
    const calledWith = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(calledWith.item_reduction).toBe(2);
  });

  it('AC3-5: 현재 감소량이 2이면 4로 증가한다', async () => {
    mockSettingsRow = { item_reduction: 2 };

    const newReduction = await updateItemReduction();

    expect(newReduction).toBe(4);
  });

  it('AC3-6: MAX_ITEM_REDUCTION(4)에 도달하면 그 이상 증가하지 않는다', async () => {
    mockSettingsRow = { item_reduction: 4 };

    const newReduction = await updateItemReduction();

    expect(newReduction).toBe(MAX_ITEM_REDUCTION);
    expect(newReduction).toBe(4);
  });

  it('AC3-7: cortex_settings가 없으면 0에서 시작해 2로 증가한다', async () => {
    mockSettingsRow = null;

    const newReduction = await updateItemReduction();

    expect(newReduction).toBe(2);
  });
});
