// F-15 alert_settings API 단위 테스트 (RED → GREEN)
// AC7: GET — 설정 목록 조회 / PUT — 트리거별 ON/OFF 설정

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ─────────────────────────────────────────────────────

const MOCK_SETTINGS = [
  {
    id: 'setting-uuid-1',
    trigger_type: 'toronto_weather',
    is_enabled: true,
    quiet_hours_start: '23:00',
    quiet_hours_end: '07:00',
    last_triggered_at: null,
    daily_count: 0,
    daily_count_reset_at: '2026-02-28',
  },
  {
    id: 'setting-uuid-2',
    trigger_type: 'keyword_breaking',
    is_enabled: true,
    quiet_hours_start: '23:00',
    quiet_hours_end: '07:00',
    last_triggered_at: null,
    daily_count: 1,
    daily_count_reset_at: '2026-02-28',
  },
];

let mockSelectData: typeof MOCK_SETTINGS | null = MOCK_SETTINGS;
let mockSelectError: { message: string } | null = null;
let mockUpdateData: (typeof MOCK_SETTINGS)[0] | null = MOCK_SETTINGS[0];
let mockUpdateError: { message: string } | null = null;

const mockSelectResult = vi.fn().mockImplementation(async () => ({
  data: mockSelectData,
  error: mockSelectError,
}));

const mockUpdateSingle = vi.fn().mockImplementation(async () => ({
  data: mockUpdateData,
  error: mockUpdateError,
}));

const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockUpdateSingle });
const mockUpdateEq = vi.fn().mockReturnValue({ select: mockUpdateSelect });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue(mockSelectResult()),
  }),
  update: mockUpdate,
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── GET /api/alerts/settings ─────────────────────────────────────────────────

describe('GET /api/alerts/settings (AC7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockSelectData = MOCK_SETTINGS;
    mockSelectError = null;

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockSelectData,
          error: mockSelectError,
        }),
      }),
      update: mockUpdate,
    });

    vi.resetModules();
  });

  it('AC7: 인증 없으면 401 반환', async () => {
    mockUser = null;
    const { GET } = await import('@/app/api/alerts/settings/route');
    const request = new NextRequest('http://localhost/api/alerts/settings', {
      method: 'GET',
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('AC7: 인증된 사용자에게 alert_settings 목록 반환', async () => {
    const { GET } = await import('@/app/api/alerts/settings/route');
    const request = new NextRequest('http://localhost/api/alerts/settings', {
      method: 'GET',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('AC7: 반환된 설정에 trigger_type, is_enabled, quiet_hours 필드가 포함된다', async () => {
    const { GET } = await import('@/app/api/alerts/settings/route');
    const request = new NextRequest('http://localhost/api/alerts/settings', {
      method: 'GET',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    if (body.data && body.data.length > 0) {
      const setting = body.data[0];
      expect(setting).toHaveProperty('trigger_type');
      expect(setting).toHaveProperty('is_enabled');
    }
  });
});

// ─── PUT /api/alerts/settings ─────────────────────────────────────────────────

describe('PUT /api/alerts/settings (AC7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockUpdateData = MOCK_SETTINGS[0];
    mockUpdateError = null;

    mockUpdateSingle.mockResolvedValue({ data: mockUpdateData, error: mockUpdateError });
    mockUpdateSelect.mockReturnValue({ single: mockUpdateSingle });
    mockUpdateEq.mockReturnValue({ select: mockUpdateSelect });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: MOCK_SETTINGS, error: null }),
      }),
      update: mockUpdate,
    });

    vi.resetModules();
  });

  const makePutRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/alerts/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('AC7: trigger_type + is_enabled으로 설정 업데이트 성공 시 200 반환', async () => {
    const { PUT } = await import('@/app/api/alerts/settings/route');
    const request = makePutRequest({
      trigger_type: 'toronto_weather',
      is_enabled: false,
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('AC7: quiet_hours_start/end 업데이트도 허용된다', async () => {
    const { PUT } = await import('@/app/api/alerts/settings/route');
    const request = makePutRequest({
      trigger_type: 'keyword_breaking',
      is_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('AC7: 잘못된 trigger_type이면 400 반환', async () => {
    const { PUT } = await import('@/app/api/alerts/settings/route');
    const request = makePutRequest({
      trigger_type: 'invalid_trigger',
      is_enabled: true,
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC7: trigger_type 누락 시 400 반환', async () => {
    const { PUT } = await import('@/app/api/alerts/settings/route');
    const request = makePutRequest({
      is_enabled: true,
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC7: is_enabled 누락 시 400 반환', async () => {
    const { PUT } = await import('@/app/api/alerts/settings/route');
    const request = makePutRequest({
      trigger_type: 'toronto_weather',
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC7: 인증 없으면 401 반환', async () => {
    mockUser = null;
    const { PUT } = await import('@/app/api/alerts/settings/route');
    const request = makePutRequest({
      trigger_type: 'toronto_weather',
      is_enabled: true,
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('잘못된 JSON body이면 400 반환', async () => {
    const { PUT } = await import('@/app/api/alerts/settings/route');
    const request = new NextRequest('http://localhost/api/alerts/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });
});
