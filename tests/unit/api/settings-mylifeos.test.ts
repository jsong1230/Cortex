// F-20 AC5 — GET/PUT /api/settings/mylifeos 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase server 모킹 ─────────────────────────────────────────────────────

let mockSelectData: { mylifeos_enabled: boolean } | null = { mylifeos_enabled: true };
let mockSelectError: { message: string } | null = null;
let mockUpsertError: { message: string } | null = null;

const mockSingle = vi.fn().mockImplementation(async () => ({
  data: mockSelectData,
  error: mockSelectError,
}));

const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = vi.fn().mockImplementation(async () => ({
  error: mockUpsertError,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    }),
  })),
}));

// ─── GET /api/settings/mylifeos ───────────────────────────────────────────────

describe('GET /api/settings/mylifeos (AC5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelectData = { mylifeos_enabled: true };
    mockSelectError = null;
    mockUpsertError = null;

    mockSingle.mockImplementation(async () => ({
      data: mockSelectData,
      error: mockSelectError,
    }));
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpsert.mockImplementation(async () => ({ error: mockUpsertError }));
  });

  it('AC5-GET-1: My Life OS 연동 상태를 반환한다', async () => {
    const { GET } = await import('@/app/api/settings/mylifeos/route');
    const request = new NextRequest('http://localhost/api/settings/mylifeos');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('enabled');
    expect(typeof body.data.enabled).toBe('boolean');
  });

  it('AC5-GET-2: DB 데이터 없으면 기본값 false를 반환한다', async () => {
    mockSelectData = null;
    mockSingle.mockImplementation(async () => ({
      data: null,
      error: { message: 'No rows found' },
    }));

    const { GET } = await import('@/app/api/settings/mylifeos/route');
    const request = new NextRequest('http://localhost/api/settings/mylifeos');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.enabled).toBe(false);
  });
});

// ─── PUT /api/settings/mylifeos ───────────────────────────────────────────────

describe('PUT /api/settings/mylifeos (AC5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelectData = { mylifeos_enabled: true };
    mockSelectError = null;
    mockUpsertError = null;

    mockSingle.mockImplementation(async () => ({
      data: mockSelectData,
      error: mockSelectError,
    }));
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpsert.mockImplementation(async () => ({ error: mockUpsertError }));
  });

  const makePutRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/settings/mylifeos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('AC5-PUT-1: enabled=true 설정 시 200을 반환한다', async () => {
    const { PUT } = await import('@/app/api/settings/mylifeos/route');
    const request = makePutRequest({ enabled: true });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.enabled).toBe(true);
  });

  it('AC5-PUT-2: enabled=false 설정 시 200을 반환한다', async () => {
    const { PUT } = await import('@/app/api/settings/mylifeos/route');
    const request = makePutRequest({ enabled: false });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.enabled).toBe(false);
  });

  it('AC5-PUT-3: enabled 필드 누락 시 400을 반환한다', async () => {
    const { PUT } = await import('@/app/api/settings/mylifeos/route');
    const request = makePutRequest({});

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC5-PUT-4: enabled가 불리언이 아니면 400을 반환한다', async () => {
    const { PUT } = await import('@/app/api/settings/mylifeos/route');
    const request = makePutRequest({ enabled: 'yes' });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC5-PUT-5: DB 저장 실패 시 500을 반환한다', async () => {
    mockUpsertError = { message: 'DB connection error' };
    mockUpsert.mockImplementation(async () => ({ error: mockUpsertError }));

    const { PUT } = await import('@/app/api/settings/mylifeos/route');
    const request = makePutRequest({ enabled: true });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
