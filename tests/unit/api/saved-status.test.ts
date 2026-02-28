// F-19 PUT /api/saved/[contentId]/status + GET /api/saved/[contentId]/status 단위 테스트
// AC3: 사용자가 완독 체크를 수동으로 수행

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── 모킹 설정 ────────────────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

const mockMarkAsCompleted = vi.fn();
const mockMarkAsReading = vi.fn();
const mockGetStatus = vi.fn();

vi.mock('@/lib/reading-loop', () => ({
  markAsCompleted: mockMarkAsCompleted,
  markAsReading: mockMarkAsReading,
  saveItem: vi.fn(),
  archiveExpiredItems: vi.fn(),
  getItemsNearingArchive: vi.fn(),
  getUnreadItems: vi.fn(),
  getMonthlyUnreadSummary: vi.fn(),
  getSavedItemByContentId: mockGetStatus,
}));

// ─── 테스트 데이터 ────────────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVALID_ID = 'not-a-uuid';

// ─── PUT /api/saved/[contentId]/status — 완독 체크 (AC3) ─────────────────────

describe('PUT /api/saved/[contentId]/status — 완독 처리 (AC3)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockMarkAsCompleted.mockResolvedValue({
      id: 'saved-item-uuid-001',
      content_id: VALID_UUID,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  });

  it('SS-01: status=completed 요청 시 200과 완독 처리된 아이템을 반환한다', async () => {
    const { PUT } = await import('@/app/api/saved/[contentId]/status/route');
    const request = new NextRequest(
      `http://localhost/api/saved/${VALID_UUID}/status`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }
    );

    const response = await PUT(request, { params: { contentId: VALID_UUID } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('completed');
  });

  it('SS-02: 미인증 요청 시 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;

    const { PUT } = await import('@/app/api/saved/[contentId]/status/route');
    const request = new NextRequest(
      `http://localhost/api/saved/${VALID_UUID}/status`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }
    );

    const response = await PUT(request, { params: { contentId: VALID_UUID } });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('SS-03: UUID 형식이 아닌 contentId는 400 INVALID_CONTENT_ID를 반환한다', async () => {
    const { PUT } = await import('@/app/api/saved/[contentId]/status/route');
    const request = new NextRequest(
      `http://localhost/api/saved/${INVALID_ID}/status`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }
    );

    const response = await PUT(request, { params: { contentId: INVALID_ID } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_CONTENT_ID');
  });

  it('SS-04: 잘못된 status 값은 400 INVALID_STATUS를 반환한다', async () => {
    const { PUT } = await import('@/app/api/saved/[contentId]/status/route');
    const request = new NextRequest(
      `http://localhost/api/saved/${VALID_UUID}/status`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid_status' }),
      }
    );

    const response = await PUT(request, { params: { contentId: VALID_UUID } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_STATUS');
  });

  it('SS-05: 저장 기록이 없는 contentId는 404 SAVED_NOT_FOUND를 반환한다', async () => {
    mockMarkAsCompleted.mockResolvedValue(null);

    const { PUT } = await import('@/app/api/saved/[contentId]/status/route');
    const request = new NextRequest(
      `http://localhost/api/saved/${VALID_UUID}/status`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }
    );

    const response = await PUT(request, { params: { contentId: VALID_UUID } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.errorCode).toBe('SAVED_NOT_FOUND');
  });
});

// ─── GET /api/saved/[contentId]/status — 현재 상태 조회 ──────────────────────

describe('GET /api/saved/[contentId]/status — 상태 조회', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockGetStatus.mockResolvedValue({
      id: 'saved-item-uuid-001',
      content_id: VALID_UUID,
      status: 'reading',
      saved_at: new Date().toISOString(),
      reading_started_at: new Date().toISOString(),
      completed_at: null,
      archived_at: null,
    });
  });

  it('SS-06: 유효한 contentId로 요청 시 200과 현재 상태를 반환한다', async () => {
    const { GET } = await import('@/app/api/saved/[contentId]/status/route');
    const request = new NextRequest(
      `http://localhost/api/saved/${VALID_UUID}/status`
    );

    const response = await GET(request, { params: { contentId: VALID_UUID } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('reading');
    expect(body.data.content_id).toBe(VALID_UUID);
  });

  it('SS-07: 저장 기록이 없으면 404 SAVED_NOT_FOUND를 반환한다', async () => {
    mockGetStatus.mockResolvedValue(null);

    const { GET } = await import('@/app/api/saved/[contentId]/status/route');
    const request = new NextRequest(
      `http://localhost/api/saved/${VALID_UUID}/status`
    );

    const response = await GET(request, { params: { contentId: VALID_UUID } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.errorCode).toBe('SAVED_NOT_FOUND');
  });
});
