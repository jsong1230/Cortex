// F-11 POST /api/interactions — UPSERT 단위 테스트 (R-01)
// test-spec.md R-01-1 ~ R-01-8

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

// upsert 결과 제어
let mockUpsertData: Record<string, unknown> | null = {
  id: 'interaction-uuid-001',
  interaction: '좋아요',
  content_id: 'content-uuid-001',
};
let mockUpsertError: { message: string } | null = null;
// insert 결과 제어 (메모용)
let mockInsertData: Record<string, unknown> | null = {
  id: 'interaction-uuid-002',
  interaction: '메모',
  content_id: 'content-uuid-001',
};
let mockInsertError: { message: string } | null = null;

const mockSingleAfterUpsert = vi.fn().mockImplementation(async () => ({
  data: mockUpsertData,
  error: mockUpsertError,
}));

const mockSingleAfterInsert = vi.fn().mockImplementation(async () => ({
  data: mockInsertData,
  error: mockInsertError,
}));

const mockSelectAfterUpsert = vi.fn().mockReturnValue({ single: mockSingleAfterUpsert });
const mockSelectAfterInsert = vi.fn().mockReturnValue({ single: mockSingleAfterInsert });

const mockUpsert = vi.fn().mockReturnValue({ select: mockSelectAfterUpsert });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelectAfterInsert });

const mockFrom = vi.fn().mockReturnValue({
  upsert: mockUpsert,
  insert: mockInsert,
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const VALID_BODY_LIKE = {
  content_id: 'content-uuid-001',
  interaction: '좋아요',
  source: 'web',
};

const VALID_BODY_WITH_BRIEFING = {
  content_id: 'content-uuid-001',
  briefing_id: 'briefing-uuid-001',
  interaction: '좋아요',
  source: 'web',
};

const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// ─── R-01: POST /api/interactions — UPSERT ──────────────────────────────────

describe('POST /api/interactions — UPSERT (R-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockUpsertData = { id: 'interaction-uuid-001', interaction: '좋아요', content_id: 'content-uuid-001' };
    mockUpsertError = null;
    mockInsertData = { id: 'interaction-uuid-002', interaction: '메모', content_id: 'content-uuid-001' };
    mockInsertError = null;

    mockSingleAfterUpsert.mockImplementation(async () => ({ data: mockUpsertData, error: mockUpsertError }));
    mockSingleAfterInsert.mockImplementation(async () => ({ data: mockInsertData, error: mockInsertError }));
    mockSelectAfterUpsert.mockReturnValue({ single: mockSingleAfterUpsert });
    mockSelectAfterInsert.mockReturnValue({ single: mockSingleAfterInsert });
    mockUpsert.mockReturnValue({ select: mockSelectAfterUpsert });
    mockInsert.mockReturnValue({ select: mockSelectAfterInsert });
    mockFrom.mockReturnValue({ upsert: mockUpsert, insert: mockInsert });

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('R-01-1: 신규 반응 저장 시 201 Created를 반환한다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest(VALID_BODY_LIKE);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(body.data.interaction).toBe('좋아요');
    expect(body.data.content_id).toBeDefined();
  });

  it('R-01-2: 동일 content_id + 동일 interaction 재요청 시 200 OK (멱등 응답)를 반환한다', async () => {
    // upsert ignoreDuplicates: true → data가 null (중복 무시)이면 기존 레코드를 조회해 반환
    // 시나리오: DB UNIQUE 제약으로 upsert가 null을 반환하는 경우
    mockUpsertData = null; // 중복으로 인해 upsert 결과가 null

    // GET 조회를 통해 기존 레코드 반환 모킹
    const mockExistingData = { id: 'interaction-uuid-001', interaction: '좋아요', content_id: 'content-uuid-001' };
    const mockSelectExisting = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockExistingData, error: null }),
        }),
      }),
    });

    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      }),
      select: mockSelectExisting,
    });

    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest(VALID_BODY_LIKE);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('R-01-3: 동일 content_id + 다른 interaction은 별도 레코드로 201 Created를 반환한다', async () => {
    const saveBody = { ...VALID_BODY_LIKE, interaction: '저장' };
    mockUpsertData = { id: 'interaction-uuid-003', interaction: '저장', content_id: 'content-uuid-001' };

    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest(saveBody);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.interaction).toBe('저장');
  });

  it('R-01-4: 메모는 복수 허용 — 기존 메모 존재 시에도 새 레코드로 201 Created를 반환한다', async () => {
    const memoBody = { ...VALID_BODY_LIKE, interaction: '메모', memo_text: '새 메모 내용' };

    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest(memoBody);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    // 메모는 insert를 사용해야 함
    expect(mockInsert).toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('R-01-5: briefing_id가 없어도 201 Created를 반환한다', async () => {
    // briefing_id 없는 요청 (VALID_BODY_LIKE에는 briefing_id가 없음)
    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest(VALID_BODY_LIKE);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('R-01-5b: briefing_id가 있어도 정상 저장된다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest(VALID_BODY_WITH_BRIEFING);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('R-01-6: 인증 없으면 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;

    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest(VALID_BODY_LIKE);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('R-01-7: 유효하지 않은 interaction 타입이면 400 INTERACTION_INVALID_TYPE을 반환한다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest({ ...VALID_BODY_LIKE, interaction: '무효타입' });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INTERACTION_INVALID_TYPE');
  });

  it('R-01-8: content_id 누락 시 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest({ interaction: '좋아요', source: 'web' });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });
});
