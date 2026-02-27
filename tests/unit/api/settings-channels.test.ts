// F-17 AC1 — GET/PUT /api/settings/channels 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── fatigue-prevention 모킹 ──────────────────────────────────────────────────

let mockChannelSettings = {
  tech: true,
  world: true,
  culture: true,
  canada: true,
};
let mockGetError: string | null = null;
let mockUpdateResult = { success: true };

vi.mock('@/lib/fatigue-prevention', () => ({
  getChannelSettings: vi.fn().mockImplementation(async () => {
    if (mockGetError) throw new Error(mockGetError);
    return mockChannelSettings;
  }),
  updateChannelSettings: vi.fn().mockImplementation(async () => mockUpdateResult),
  DEFAULT_CHANNEL_SETTINGS: {
    tech: true,
    world: true,
    culture: true,
    canada: true,
  },
  getMuteStatus: vi.fn().mockResolvedValue({ isMuted: false, muteUntil: null }),
  setMute: vi.fn().mockResolvedValue(undefined),
  checkNoReactionStreak: vi.fn().mockResolvedValue(false),
  updateItemReduction: vi.fn().mockResolvedValue(0),
  detectRepeatingIssues: vi.fn().mockReturnValue(new Set()),
  markAsFollowing: vi.fn().mockImplementation((item: unknown) => ({ ...(item as object), is_following: true })),
  MAX_ITEM_REDUCTION: 4,
}));

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('GET /api/settings/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockChannelSettings = { tech: true, world: true, culture: true, canada: true };
    mockGetError = null;
  });

  it('AC1-GET-1: 채널 설정을 반환한다', async () => {
    const { GET } = await import('@/app/api/settings/channels/route');
    const request = new NextRequest('http://localhost/api/settings/channels');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.tech).toBeDefined();
    expect(body.data.world).toBeDefined();
    expect(body.data.culture).toBeDefined();
    expect(body.data.canada).toBeDefined();
  });

  it('AC1-GET-2: 기본값은 모두 true이다', async () => {
    const { GET } = await import('@/app/api/settings/channels/route');
    const request = new NextRequest('http://localhost/api/settings/channels');

    const response = await GET(request);
    const body = await response.json();

    expect(body.data.tech).toBe(true);
    expect(body.data.world).toBe(true);
    expect(body.data.culture).toBe(true);
    expect(body.data.canada).toBe(true);
  });
});

describe('PUT /api/settings/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockUpdateResult = { success: true };
  });

  it('AC1-PUT-1: 유효한 채널 설정으로 업데이트하면 200을 반환한다', async () => {
    const { PUT } = await import('@/app/api/settings/channels/route');
    const request = new NextRequest('http://localhost/api/settings/channels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tech: true, world: false, culture: true, canada: false }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('AC1-PUT-2: 잘못된 값(비불리언)이 포함되면 400을 반환한다', async () => {
    const { PUT } = await import('@/app/api/settings/channels/route');
    const request = new NextRequest('http://localhost/api/settings/channels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tech: 'yes', world: false, culture: true, canada: false }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC1-PUT-3: 필드가 누락되면 400을 반환한다', async () => {
    const { PUT } = await import('@/app/api/settings/channels/route');
    const request = new NextRequest('http://localhost/api/settings/channels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tech: true, world: false }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC1-PUT-4: 저장 실패 시 500을 반환한다', async () => {
    mockUpdateResult = { success: false, error: '저장 실패' } as typeof mockUpdateResult;

    const { PUT } = await import('@/app/api/settings/channels/route');
    const request = new NextRequest('http://localhost/api/settings/channels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tech: true, world: true, culture: true, canada: true }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
