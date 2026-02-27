// F-15 긴급 알림 가드 단위 테스트 (RED → GREEN)
// AC4: 중복 알림 방지 / AC5: 하루 최대 3회 / AC6: 방해 금지 시간

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase 모킹 ───────────────────────────────────────────────────────────

let mockAlertLogRows: Array<{ trigger_type: string; content_id: string | null; sent_at: string }> = [];
let mockAlertLogError: { message: string } | null = null;
let mockAlertCountRows: Array<{ id: string }> = [];
let mockAlertCountError: { message: string } | null = null;

const mockGteDateFilter = vi.fn().mockImplementation(async () => ({
  data: mockAlertLogRows,
  error: mockAlertLogError,
}));

const mockEqContentFilter = vi.fn().mockReturnValue({ gte: mockGteDateFilter });
const mockEqTriggerFilter = vi.fn().mockReturnValue({ eq: mockEqContentFilter });

const mockSelectForDuplicate = vi.fn().mockReturnValue({ eq: mockEqTriggerFilter });

const mockCountGte = vi.fn().mockImplementation(async () => ({
  data: mockAlertCountRows,
  error: mockAlertCountError,
}));
const mockCountFrom = vi.fn().mockReturnValue({ gte: mockCountGte });
const mockSelectForCount = vi.fn().mockReturnValue({ gte: mockCountGte });

const mockFrom = vi.fn().mockImplementation((table: string) => {
  void table;
  return {
    select: vi.fn().mockImplementation((cols: string) => {
      // count 쿼리 vs duplicate 쿼리 분기
      if (cols === '*') {
        return { eq: mockEqTriggerFilter };
      }
      return { gte: mockCountGte };
    }),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

import { isQuietHours, checkDailyAlertCount, hasDuplicateAlert } from '@/lib/alerts';

// ─── isQuietHours ─────────────────────────────────────────────────────────────

describe('isQuietHours', () => {
  it('AC6: 자정을 넘는 방해 금지 시간 내(00:30)에는 true', () => {
    const midnight = new Date();
    midnight.setHours(0, 30, 0, 0);
    expect(isQuietHours('23:00', '07:00', midnight)).toBe(true);
  });

  it('AC6: 방해 금지 시간 종료 후(09:00)에는 false', () => {
    const morning = new Date();
    morning.setHours(9, 0, 0, 0);
    expect(isQuietHours('23:00', '07:00', morning)).toBe(false);
  });

  it('AC6: 방해 금지 시작 직후(23:30)에는 true', () => {
    const night = new Date();
    night.setHours(23, 30, 0, 0);
    expect(isQuietHours('23:00', '07:00', night)).toBe(true);
  });

  it('AC6: 방해 금지 시간 정각 시작(23:00)은 true', () => {
    const start = new Date();
    start.setHours(23, 0, 0, 0);
    expect(isQuietHours('23:00', '07:00', start)).toBe(true);
  });

  it('AC6: 방해 금지 시간 정각 종료(07:00)는 false (종료 시간 미포함)', () => {
    const end = new Date();
    end.setHours(7, 0, 0, 0);
    expect(isQuietHours('23:00', '07:00', end)).toBe(false);
  });

  it('연속 범위 방해 금지 시간(09:00~18:00) 내에 있으면 true', () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    expect(isQuietHours('09:00', '18:00', noon)).toBe(true);
  });

  it('연속 범위 방해 금지 시간(09:00~18:00) 외에 있으면 false', () => {
    const night = new Date();
    night.setHours(20, 0, 0, 0);
    expect(isQuietHours('09:00', '18:00', night)).toBe(false);
  });
});

// ─── checkDailyAlertCount ─────────────────────────────────────────────────────

describe('checkDailyAlertCount (AC5: 하루 최대 3회)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC5: 오늘 발송 횟수가 3 미만이면 true (발송 가능)', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({
            data: [{ id: '1' }, { id: '2' }],
            error: null,
          }),
        }),
      }),
    };

    const canSend = await checkDailyAlertCount(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(canSend).toBe(true);
  });

  it('AC5: 오늘 발송 횟수가 3이면 false (발송 불가)', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({
            data: [{ id: '1' }, { id: '2' }, { id: '3' }],
            error: null,
          }),
        }),
      }),
    };

    const canSend = await checkDailyAlertCount(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(canSend).toBe(false);
  });

  it('AC5: 오늘 발송 횟수가 3 초과면 false', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({
            data: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
            error: null,
          }),
        }),
      }),
    };

    const canSend = await checkDailyAlertCount(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(canSend).toBe(false);
  });

  it('DB 오류 시 false 반환 (안전 기본값)', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB connection failed' },
          }),
        }),
      }),
    };

    const canSend = await checkDailyAlertCount(mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>);
    expect(canSend).toBe(false);
  });
});

// ─── hasDuplicateAlert ────────────────────────────────────────────────────────

describe('hasDuplicateAlert (AC4: 당일 중복 방지)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC4: 당일 같은 trigger_type + content_id 알림 있으면 true (중복)', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: [{ trigger_type: 'keyword_breaking', content_id: 'content-001' }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const isDuplicate = await hasDuplicateAlert(
      mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>,
      'keyword_breaking',
      'content-001'
    );
    expect(isDuplicate).toBe(true);
  });

  it('AC4: 당일 같은 trigger_type이지만 다른 content_id면 false (중복 아님)', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const isDuplicate = await hasDuplicateAlert(
      mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>,
      'keyword_breaking',
      'content-002'
    );
    expect(isDuplicate).toBe(false);
  });

  it('AC4: content_id 없는 날씨 알림 — 당일 같은 trigger_type 있으면 true', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: [{ trigger_type: 'toronto_weather', content_id: null }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const isDuplicate = await hasDuplicateAlert(
      mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>,
      'toronto_weather',
      null
    );
    expect(isDuplicate).toBe(true);
  });

  it('AC4: 전날 알림은 중복 아님 — false 반환', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const isDuplicate = await hasDuplicateAlert(
      mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>,
      'toronto_weather',
      null
    );
    expect(isDuplicate).toBe(false);
  });

  it('DB 오류 시 false 반환 (발송 허용 — 누락 방지 우선)', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB error' },
              }),
            }),
          }),
        }),
      }),
    };

    const isDuplicate = await hasDuplicateAlert(
      mockClient as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>,
      'keyword_breaking',
      'content-001'
    );
    expect(isDuplicate).toBe(false);
  });
});
