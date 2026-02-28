// F-17 AC2 — 뮤트 로직 단위 테스트
// getMuteStatus, setMute

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase 모킹 ───────────────────────────────────────────────────────────

let mockRow: Record<string, unknown> | null = null;
let mockError: { message: string } | null = null;
let mockUpsertError: { message: string } | null = null;

const mockSingle = vi.fn().mockImplementation(async () => ({
  data: mockRow,
  error: mockError,
}));

const mockSelectChain = vi.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = vi.fn().mockImplementation(async () => ({
  data: null,
  error: mockUpsertError,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: mockSelectChain,
      upsert: mockUpsert,
    }),
  })),
}));

import {
  getMuteStatus,
  setMute,
} from '@/lib/fatigue-prevention';

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('getMuteStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRow = null;
    mockError = null;
  });

  it('AC2-1: mute_until가 null이면 뮤트 상태가 아니다', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { mute_until: null },
      error: null,
    });

    const result = await getMuteStatus();

    expect(result.isMuted).toBe(false);
    expect(result.muteUntil).toBeNull();
  });

  it('AC2-2: mute_until가 미래 시각이면 뮤트 상태이다', async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mockSingle.mockResolvedValueOnce({
      data: { mute_until: futureDate },
      error: null,
    });

    const result = await getMuteStatus();

    expect(result.isMuted).toBe(true);
    expect(result.muteUntil).toBe(futureDate);
  });

  it('AC2-3: mute_until가 과거 시각이면 뮤트 상태가 아니다', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockSingle.mockResolvedValueOnce({
      data: { mute_until: pastDate },
      error: null,
    });

    const result = await getMuteStatus();

    expect(result.isMuted).toBe(false);
  });

  it('AC2-4: cortex_settings 행이 없으면 뮤트 상태가 아니다', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getMuteStatus();

    expect(result.isMuted).toBe(false);
  });

  it('AC2-5: DB 오류 시 뮤트 상태가 아닌 것으로 처리한다', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB 오류' } });

    const result = await getMuteStatus();

    expect(result.isMuted).toBe(false);
  });
});

describe('setMute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertError = null;
    mockUpsert.mockImplementation(async () => ({ data: null, error: mockUpsertError }));
  });

  it('AC2-6: N=3이면 3일 후 시각으로 mute_until이 설정된다', async () => {
    const before = Date.now();
    await setMute(3);
    const after = Date.now();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const calledWith = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    const muteUntil = new Date(calledWith.mute_until as string).getTime();

    // 3일(259200000ms) ± 5초 허용
    const expectedMs = 3 * 24 * 60 * 60 * 1000;
    expect(muteUntil).toBeGreaterThanOrEqual(before + expectedMs - 5000);
    expect(muteUntil).toBeLessThanOrEqual(after + expectedMs + 5000);
  });

  it('AC2-7: N=0이면 mute_until이 null로 설정된다 (뮤트 해제)', async () => {
    await setMute(0);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const calledWith = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(calledWith.mute_until).toBeNull();
  });

  it('AC2-8: 음수 N은 뮤트 해제로 처리한다', async () => {
    await setMute(-1);

    const calledWith = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(calledWith.mute_until).toBeNull();
  });

  it('AC2-9: DB 오류 시 에러를 throw한다', async () => {
    mockUpsert.mockResolvedValueOnce({ data: null, error: { message: '저장 실패' } });

    await expect(setMute(3)).rejects.toThrow();
  });
});
