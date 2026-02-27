// F-17 AC1 — 채널 ON/OFF 설정 단위 테스트
// getChannelSettings, updateChannelSettings

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
  getChannelSettings,
  updateChannelSettings,
  DEFAULT_CHANNEL_SETTINGS,
  type ChannelSettings,
} from '@/lib/fatigue-prevention';

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('getChannelSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRow = null;
    mockError = null;
    mockUpsertError = null;
    mockSingle.mockImplementation(async () => ({ data: mockRow, error: mockError }));
  });

  it('AC1-1: user_settings가 없으면 기본값(모두 ON)을 반환한다', async () => {
    mockRow = null;
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getChannelSettings();

    expect(result).toEqual(DEFAULT_CHANNEL_SETTINGS);
    expect(result.tech).toBe(true);
    expect(result.world).toBe(true);
    expect(result.culture).toBe(true);
    expect(result.canada).toBe(true);
  });

  it('AC1-2: user_settings 행이 있으면 저장된 채널 설정을 반환한다', async () => {
    const storedSettings: ChannelSettings = {
      tech: true,
      world: false,
      culture: true,
      canada: false,
    };
    mockSingle.mockResolvedValueOnce({
      data: { channel_settings: storedSettings },
      error: null,
    });

    const result = await getChannelSettings();

    expect(result).toEqual(storedSettings);
    expect(result.world).toBe(false);
    expect(result.canada).toBe(false);
  });

  it('AC1-3: DB 오류 시 기본값을 반환한다', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB 오류' },
    });

    const result = await getChannelSettings();

    expect(result).toEqual(DEFAULT_CHANNEL_SETTINGS);
  });
});

describe('updateChannelSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertError = null;
    mockUpsert.mockImplementation(async () => ({ data: null, error: mockUpsertError }));
  });

  it('AC1-4: 정상 저장 시 성공을 반환한다', async () => {
    const newSettings: ChannelSettings = {
      tech: true,
      world: false,
      culture: true,
      canada: false,
    };

    const result = await updateChannelSettings(newSettings);

    expect(result.success).toBe(true);
  });

  it('AC1-5: world를 OFF로 설정하면 upsert가 호출된다', async () => {
    const settings: ChannelSettings = {
      tech: true,
      world: false,
      culture: true,
      canada: true,
    };

    await updateChannelSettings(settings);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        channel_settings: settings,
      }),
      expect.any(Object),
    );
  });

  it('AC1-6: DB 오류 시 실패를 반환한다', async () => {
    mockUpsert.mockResolvedValueOnce({ data: null, error: { message: '저장 실패' } });

    const result = await updateChannelSettings(DEFAULT_CHANNEL_SETTINGS);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
