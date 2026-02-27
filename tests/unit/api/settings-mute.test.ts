// F-17 AC2 — GET/POST/DELETE /api/settings/mute 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── fatigue-prevention 모킹 ──────────────────────────────────────────────────

let mockMuteStatus = { isMuted: false, muteUntil: null as string | null };
let mockSetMuteError: string | null = null;

vi.mock('@/lib/fatigue-prevention', () => ({
  getMuteStatus: vi.fn().mockImplementation(async () => mockMuteStatus),
  setMute: vi.fn().mockImplementation(async () => {
    if (mockSetMuteError) throw new Error(mockSetMuteError);
  }),
  getChannelSettings: vi.fn().mockResolvedValue({ tech: true, world: true, culture: true, canada: true }),
  updateChannelSettings: vi.fn().mockResolvedValue({ success: true }),
  DEFAULT_CHANNEL_SETTINGS: { tech: true, world: true, culture: true, canada: true },
  checkNoReactionStreak: vi.fn().mockResolvedValue(false),
  updateItemReduction: vi.fn().mockResolvedValue(0),
  detectRepeatingIssues: vi.fn().mockReturnValue(new Set()),
  markAsFollowing: vi.fn().mockImplementation((item: unknown) => ({ ...(item as object), is_following: true })),
  MAX_ITEM_REDUCTION: 4,
}));

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('GET /api/settings/mute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockMuteStatus = { isMuted: false, muteUntil: null };
    mockSetMuteError = null;
  });

  it('AC2-GET-1: 뮤트 상태가 아닐 때 isMuted=false를 반환한다', async () => {
    const { GET } = await import('@/app/api/settings/mute/route');
    const request = new NextRequest('http://localhost/api/settings/mute');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.isMuted).toBe(false);
  });

  it('AC2-GET-2: 뮤트 중일 때 isMuted=true와 muteUntil을 반환한다', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    mockMuteStatus = { isMuted: true, muteUntil: futureDate };

    const { GET } = await import('@/app/api/settings/mute/route');
    const request = new NextRequest('http://localhost/api/settings/mute');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.isMuted).toBe(true);
    expect(body.data.muteUntil).toBe(futureDate);
  });
});

describe('POST /api/settings/mute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSetMuteError = null;
  });

  it('AC2-POST-1: 유효한 days로 뮤트 설정 시 200을 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/mute/route');
    const request = new NextRequest('http://localhost/api/settings/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 3 }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('AC2-POST-2: days가 없으면 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/mute/route');
    const request = new NextRequest('http://localhost/api/settings/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC2-POST-3: days가 음수이면 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/mute/route');
    const request = new NextRequest('http://localhost/api/settings/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: -1 }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC2-POST-4: days가 365 초과이면 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/mute/route');
    const request = new NextRequest('http://localhost/api/settings/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 400 }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe('DELETE /api/settings/mute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSetMuteError = null;
  });

  it('AC2-DELETE-1: 뮤트 해제 시 200을 반환한다', async () => {
    const { DELETE } = await import('@/app/api/settings/mute/route');
    const request = new NextRequest('http://localhost/api/settings/mute', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
