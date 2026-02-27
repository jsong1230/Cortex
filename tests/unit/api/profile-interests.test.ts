// F-14 POST/PUT/DELETE /api/profile/interests 단위 테스트 (AC2)
// 토픽 수동 추가, 스코어 조정, 아카이브

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

// 조회 체인 결과 제어
let mockSelectData: Record<string, unknown>[] | null = [];
let mockSelectError: { message: string } | null = null;

// upsert/insert/update 결과 제어
let mockMutateData: Record<string, unknown> | null = null;
let mockMutateError: { message: string } | null = null;

const mockSingleFn = vi.fn();
const mockEqFn2 = vi.fn();
const mockEqFn = vi.fn();
const mockUpdateFn = vi.fn();
const mockInsertSelectFn = vi.fn();
const mockInsertFn = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockSelectData, error: mockSelectError }),
        }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(async () => ({
            data: mockSelectData?.[0] ?? null,
            error: mockSelectError,
          })),
        }),
      }),
      insert: mockInsertFn,
      update: mockUpdateFn,
    }),
  })),
}));

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

const makeRequest = (method: string, body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/profile/interests', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// ─── P-01: POST — 토픽 추가 ──────────────────────────────────────────────────

describe('POST /api/profile/interests — 토픽 추가 (P-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockSelectData = [];
    mockSelectError = null;
    mockMutateData = { id: 'new-uuid', topic: 'Rust', score: 0.5 };
    mockMutateError = null;

    mockInsertFn.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockMutateData, error: mockMutateError }),
      }),
    });

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('P-01-1: 신규 토픽 추가 시 201 Created를 반환한다', async () => {
    const { POST } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('POST', { topic: 'Rust' });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.topic).toBe('Rust');
    expect(body.data.score).toBe(0.5);
  });

  it('P-01-2: topic 필드 누락 시 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('POST', {});

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('P-01-3: 빈 문자열 topic이면 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('POST', { topic: '  ' });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('P-01-4: 인증 없으면 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;
    const { POST } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('POST', { topic: 'Rust' });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('P-01-5: DB 에러 시 500을 반환한다', async () => {
    mockMutateError = { message: 'DB error' };
    mockInsertFn.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: mockMutateError }),
      }),
    });

    const { POST } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('POST', { topic: 'Rust' });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});

// ─── P-02: PUT — 스코어 업데이트 ─────────────────────────────────────────────

describe('PUT /api/profile/interests — 스코어 업데이트 (P-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockMutateData = { id: 'topic-uuid', topic: 'Rust', score: 0.8 };
    mockMutateError = null;

    mockUpdateFn.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockMutateData, error: mockMutateError }),
        }),
      }),
    });

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('P-02-1: 유효한 score 업데이트 시 200 OK를 반환한다', async () => {
    const { PUT } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('PUT', { id: 'topic-uuid', score: 0.8 });

    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.score).toBe(0.8);
  });

  it('P-02-2: id 누락 시 400을 반환한다', async () => {
    const { PUT } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('PUT', { score: 0.8 });

    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('P-02-3: score가 0~1 범위를 벗어나면 400을 반환한다', async () => {
    const { PUT } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('PUT', { id: 'topic-uuid', score: 1.5 });

    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('P-02-4: 인증 없으면 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;
    const { PUT } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('PUT', { id: 'topic-uuid', score: 0.7 });

    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });
});

// ─── P-03: DELETE — 토픽 아카이브 ────────────────────────────────────────────

describe('DELETE /api/profile/interests — 토픽 아카이브 (P-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockMutateData = { id: 'topic-uuid', topic: 'Rust', archived_at: '2026-02-28T00:00:00Z' };
    mockMutateError = null;

    mockUpdateFn.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockMutateData, error: mockMutateError }),
        }),
      }),
    });

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('P-03-1: 존재하는 토픽 아카이브 시 200 OK를 반환한다', async () => {
    const { DELETE } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('DELETE', { id: 'topic-uuid' });

    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.archived_at).toBeTruthy();
  });

  it('P-03-2: id 누락 시 400을 반환한다', async () => {
    const { DELETE } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('DELETE', {});

    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('P-03-3: 인증 없으면 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;
    const { DELETE } = await import('@/app/api/profile/interests/route');
    const req = makeRequest('DELETE', { id: 'topic-uuid' });

    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });
});
