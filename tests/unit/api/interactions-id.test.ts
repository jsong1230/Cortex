// F-11 DELETE/PUT /api/interactions/[id] — 단위 테스트 (R-03, R-04)
// test-spec.md R-03-1 ~ R-03-4, R-04-1 ~ R-04-5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

// DELETE 시 사용하는 select → eq → single 체인
let mockSelectForDelete: Record<string, unknown> | null = {
  id: 'interaction-uuid-001',
  interaction: '좋아요',
  content_id: 'content-uuid-001',
};
let mockSelectForDeleteError: { message: string } | null = null;

// DELETE 결과
let mockDeleteError: { message: string } | null = null;

// PUT 시 사용하는 select → eq → single 체인
let mockSelectForPut: Record<string, unknown> | null = {
  id: 'interaction-uuid-002',
  interaction: '메모',
  memo_text: '기존 메모',
  content_id: 'content-uuid-001',
};
let mockSelectForPutError: { message: string } | null = null;

// PUT update 결과
let mockUpdateData: Record<string, unknown> | null = {
  id: 'interaction-uuid-002',
  interaction: '메모',
  memo_text: '수정된 메모',
  content_id: 'content-uuid-001',
};
let mockUpdateError: { message: string } | null = null;

const makeSingleResolveDelete = () =>
  vi.fn().mockResolvedValue({ data: mockSelectForDelete, error: mockSelectForDeleteError });

const makeSingleResolveUpdate = () =>
  vi.fn().mockResolvedValue({ data: mockUpdateData, error: mockUpdateError });

// from('user_interactions') 체인 빌더
function makeFromChain() {
  const singleForSelect = vi.fn().mockImplementation(async () => ({
    data: mockSelectForDelete,
    error: mockSelectForDeleteError,
  }));

  const eqForSelect = vi.fn().mockReturnValue({ single: singleForSelect });
  const selectChain = vi.fn().mockReturnValue({ eq: eqForSelect });

  // DELETE 체인: .delete().eq().select().single()
  const singleAfterDelete = vi.fn().mockResolvedValue({ data: mockSelectForDelete, error: mockDeleteError });
  const selectAfterDelete = vi.fn().mockReturnValue({ single: singleAfterDelete });
  const eqForDelete = vi.fn().mockReturnValue({ select: selectAfterDelete });
  const deleteChain = vi.fn().mockReturnValue({ eq: eqForDelete });

  // UPDATE 체인: .update().eq().select().single()
  const singleAfterUpdate = vi.fn().mockImplementation(async () => ({
    data: mockUpdateData,
    error: mockUpdateError,
  }));
  const selectAfterUpdate = vi.fn().mockReturnValue({ single: singleAfterUpdate });
  const eqForUpdate = vi.fn().mockReturnValue({ select: selectAfterUpdate });
  const updateChain = vi.fn().mockReturnValue({ eq: eqForUpdate });

  return {
    select: selectChain,
    delete: deleteChain,
    update: updateChain,
  };
}

const mockFrom = vi.fn().mockImplementation(() => makeFromChain());

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

const VALID_ID = 'interaction-uuid-001';
const MEMO_ID = 'interaction-uuid-002';
const INVALID_ID = 'non-existent-uuid';

const makeDeleteRequest = (id: string) =>
  new NextRequest(`http://localhost/api/interactions/${id}`, { method: 'DELETE' });

const makePutRequest = (id: string, body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/interactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Route params 형식
const makeParams = (id: string) => ({ params: { id } });

// ─── R-03: DELETE /api/interactions/[id] ───────────────────────────────────

describe('DELETE /api/interactions/[id] — 반응 취소 (R-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockSelectForDelete = {
      id: VALID_ID,
      interaction: '좋아요',
      content_id: 'content-uuid-001',
    };
    mockSelectForDeleteError = null;
    mockDeleteError = null;
    mockFrom.mockImplementation(() => makeFromChain());
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('R-03-1: 존재하는 반응 삭제 시 200과 삭제된 데이터를 반환한다', async () => {
    const { DELETE } = await import('@/app/api/interactions/[id]/route');
    const request = makeDeleteRequest(VALID_ID);

    const response = await DELETE(request, makeParams(VALID_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(body.data.interaction).toBeDefined();
    expect(body.data.content_id).toBeDefined();
  });

  it('R-03-2: 존재하지 않는 ID로 삭제 시 404 INTERACTION_NOT_FOUND를 반환한다', async () => {
    mockSelectForDelete = null;

    mockFrom.mockImplementation(() => makeFromChain());

    const { DELETE } = await import('@/app/api/interactions/[id]/route');
    const request = makeDeleteRequest(INVALID_ID);

    const response = await DELETE(request, makeParams(INVALID_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INTERACTION_NOT_FOUND');
  });

  it('R-03-3: 인증 없으면 401을 반환한다', async () => {
    mockUser = null;

    const { DELETE } = await import('@/app/api/interactions/[id]/route');
    const request = makeDeleteRequest(VALID_ID);

    const response = await DELETE(request, makeParams(VALID_ID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });
});

// ─── R-04: PUT /api/interactions/[id] ─────────────────────────────────────

describe('PUT /api/interactions/[id] — 메모 수정 (R-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockSelectForPut = {
      id: MEMO_ID,
      interaction: '메모',
      memo_text: '기존 메모',
      content_id: 'content-uuid-001',
    };
    mockSelectForPutError = null;
    mockUpdateData = {
      id: MEMO_ID,
      interaction: '메모',
      memo_text: '수정된 메모',
      content_id: 'content-uuid-001',
    };
    mockUpdateError = null;

    // PUT에서는 select 후 update를 하므로 select chain이 메모 데이터를 반환하도록
    const singleForSelect = vi.fn().mockImplementation(async () => ({
      data: mockSelectForPut,
      error: mockSelectForPutError,
    }));
    const eqForSelect = vi.fn().mockReturnValue({ single: singleForSelect });
    const selectChain = vi.fn().mockReturnValue({ eq: eqForSelect });

    const singleAfterUpdate = vi.fn().mockImplementation(async () => ({
      data: mockUpdateData,
      error: mockUpdateError,
    }));
    const selectAfterUpdate = vi.fn().mockReturnValue({ single: singleAfterUpdate });
    const eqForUpdate = vi.fn().mockReturnValue({ select: selectAfterUpdate });
    const updateChain = vi.fn().mockReturnValue({ eq: eqForUpdate });

    mockFrom.mockImplementation(() => ({
      select: selectChain,
      update: updateChain,
    }));

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('R-04-1: 메모 텍스트 수정 시 200과 수정된 데이터를 반환한다', async () => {
    const { PUT } = await import('@/app/api/interactions/[id]/route');
    const request = makePutRequest(MEMO_ID, { memo_text: '수정된 메모' });

    const response = await PUT(request, makeParams(MEMO_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.memo_text).toBe('수정된 메모');
  });

  it('R-04-2: 메모가 아닌 반응(좋아요) 수정 시도 시 400 INTERACTION_NOT_MEMO를 반환한다', async () => {
    mockSelectForPut = {
      id: VALID_ID,
      interaction: '좋아요', // 메모 아님
      memo_text: null,
      content_id: 'content-uuid-001',
    };

    const singleForSelect = vi.fn().mockImplementation(async () => ({
      data: mockSelectForPut,
      error: null,
    }));
    const eqForSelect = vi.fn().mockReturnValue({ single: singleForSelect });
    const selectChain = vi.fn().mockReturnValue({ eq: eqForSelect });

    mockFrom.mockImplementation(() => ({
      select: selectChain,
      update: vi.fn(),
    }));

    const { PUT } = await import('@/app/api/interactions/[id]/route');
    const request = makePutRequest(VALID_ID, { memo_text: '수정 시도' });

    const response = await PUT(request, makeParams(VALID_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INTERACTION_NOT_MEMO');
  });

  it('R-04-3: memo_text 누락 시 400 INTERACTION_MEMO_REQUIRED를 반환한다', async () => {
    const { PUT } = await import('@/app/api/interactions/[id]/route');
    const request = makePutRequest(MEMO_ID, {});

    const response = await PUT(request, makeParams(MEMO_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INTERACTION_MEMO_REQUIRED');
  });

  it('R-04-4: 존재하지 않는 ID로 PUT 시 404 INTERACTION_NOT_FOUND를 반환한다', async () => {
    mockSelectForPut = null;

    const singleForSelect = vi.fn().mockImplementation(async () => ({
      data: null,
      error: null,
    }));
    const eqForSelect = vi.fn().mockReturnValue({ single: singleForSelect });
    const selectChain = vi.fn().mockReturnValue({ eq: eqForSelect });

    mockFrom.mockImplementation(() => ({
      select: selectChain,
      update: vi.fn(),
    }));

    const { PUT } = await import('@/app/api/interactions/[id]/route');
    const request = makePutRequest(INVALID_ID, { memo_text: '수정 시도' });

    const response = await PUT(request, makeParams(INVALID_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INTERACTION_NOT_FOUND');
  });

  it('R-04-5: 인증 없으면 401을 반환한다', async () => {
    mockUser = null;

    const { PUT } = await import('@/app/api/interactions/[id]/route');
    const request = makePutRequest(MEMO_ID, { memo_text: '수정 시도' });

    const response = await PUT(request, makeParams(MEMO_ID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });
});
