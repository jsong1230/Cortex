// F-14 GET/POST /api/profile/interests/archived 단위 테스트 (AC4)
// 보관된 토픽 조회 + 복원

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

let mockArchivedData: Record<string, unknown>[] | null = null;
let mockArchivedError: { message: string } | null = null;
let mockRestoreData: Record<string, unknown> | null = null;
let mockRestoreError: { message: string } | null = null;

const mockUpdateEqSelectSingle = vi.fn();
const mockUpdateEqSelect = vi.fn();
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockArchivedData,
            error: mockArchivedError,
          }),
        }),
      }),
      update: mockUpdate,
    }),
  })),
}));

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

const makeGetRequest = () =>
  new NextRequest('http://localhost/api/profile/interests/archived', {
    method: 'GET',
  });

const makePostRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/profile/interests/archived', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// ─── A-01: GET — 보관된 토픽 조회 (AC4) ─────────────────────────────────────

describe('GET /api/profile/interests/archived — 보관 토픽 조회 (A-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockArchivedData = [
      {
        id: 'arch-uuid-1',
        topic: 'Angular',
        score: 0.3,
        interaction_count: 2,
        last_updated: '2025-11-01T00:00:00Z',
        archived_at: '2025-12-01T00:00:00Z',
      },
      {
        id: 'arch-uuid-2',
        topic: 'jQuery',
        score: 0.1,
        interaction_count: 1,
        last_updated: '2025-10-01T00:00:00Z',
        archived_at: '2025-11-15T00:00:00Z',
      },
    ];
    mockArchivedError = null;
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('A-01-1: 보관된 토픽 목록을 200 OK로 반환한다', async () => {
    const { GET } = await import('@/app/api/profile/interests/archived/route');
    const req = makeGetRequest();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.topics).toHaveLength(2);
    expect(body.data.topics[0].topic).toBe('Angular');
    expect(body.data.topics[0].archived_at).toBeTruthy();
  });

  it('A-01-2: 보관된 토픽이 없으면 빈 배열을 반환한다', async () => {
    mockArchivedData = [];
    const { GET } = await import('@/app/api/profile/interests/archived/route');

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.topics).toHaveLength(0);
    expect(body.data.total).toBe(0);
  });

  it('A-01-3: 인증 없으면 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;
    const { GET } = await import('@/app/api/profile/interests/archived/route');

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('A-01-4: DB 에러 시 500을 반환한다', async () => {
    mockArchivedError = { message: 'DB connection error' };
    mockArchivedData = null;
    const { GET } = await import('@/app/api/profile/interests/archived/route');

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});

// ─── A-02: POST — 보관 토픽 복원 (AC4) ──────────────────────────────────────

describe('POST /api/profile/interests/archived — 보관 토픽 복원 (A-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockRestoreData = {
      id: 'arch-uuid-1',
      topic: 'Angular',
      score: 0.3,
      archived_at: null,
    };
    mockRestoreError = null;

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockRestoreData, error: mockRestoreError }),
        }),
      }),
    });

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('A-02-1: 유효한 id로 복원 시 200 OK와 archived_at=null을 반환한다', async () => {
    const { POST } = await import('@/app/api/profile/interests/archived/route');
    const req = makePostRequest({ id: 'arch-uuid-1' });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.archived_at).toBeNull();
  });

  it('A-02-2: id 누락 시 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/profile/interests/archived/route');
    const req = makePostRequest({});

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('A-02-3: 인증 없으면 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;
    const { POST } = await import('@/app/api/profile/interests/archived/route');
    const req = makePostRequest({ id: 'arch-uuid-1' });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('A-02-4: DB 에러 시 500을 반환한다', async () => {
    mockRestoreError = { message: 'DB error' };
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: mockRestoreError }),
        }),
      }),
    });

    const { POST } = await import('@/app/api/profile/interests/archived/route');
    const req = makePostRequest({ id: 'arch-uuid-1' });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
