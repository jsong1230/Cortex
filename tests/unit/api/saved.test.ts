// F-10 GET /api/saved + DELETE /api/saved/[contentId] 단위 테스트
// test-spec.md H-09 ~ H-12

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 (GET /api/saved) ───────────────────────────────────

let mockSavedInteractions: Record<string, unknown>[] = [];
let mockSavedCount: number = 0;
let mockSavedError: { message: string } | null = null;
let mockContentItems: Record<string, unknown>[] = [];

// DELETE 관련
let mockDeleteData: Record<string, unknown>[] = [];
let mockDeleteError: { message: string } | null = null;

const mockSavedRangeImpl = vi.fn().mockImplementation(async () => ({
  data: mockSavedInteractions,
  count: mockSavedCount,
  error: mockSavedError,
}));

const mockDeleteImpl = vi.fn().mockImplementation(async () => ({
  data: mockDeleteData,
  error: mockDeleteError,
}));

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'user_interactions') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: mockSavedRangeImpl,
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockImplementation(async () => ({
          data: mockDeleteData,
          error: mockDeleteError,
        })),
      }),
    };
  }
  if (table === 'content_items') {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation(async () => ({ data: mockContentItems, error: null })),
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const SAMPLE_SAVED_INTERACTIONS = [
  {
    content_id: 'content-uuid-001',
    created_at: '2026-02-27T07:15:00+09:00',
  },
  {
    content_id: 'content-uuid-002',
    created_at: '2026-02-26T08:30:00+09:00',
  },
];

const SAMPLE_CONTENT_ITEMS = [
  {
    id: 'content-uuid-001',
    title: 'OpenAI GPT-5 출시',
    summary_ai: 'GPT-5 관련 요약',
    source: 'hackernews',
    source_url: 'https://hn.com/1',
    channel: 'tech',
  },
  {
    id: 'content-uuid-002',
    title: '토론토 폭설 경보',
    summary_ai: '폭설 예보 요약',
    source: 'cbc',
    source_url: 'https://cbc.ca/news/1',
    channel: 'canada',
  },
];

// ─── H-09: 저장 아이템 정상 조회 ────────────────────────────────────────────

describe('GET /api/saved — 저장 아이템 목록 조회 (H-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockSavedInteractions = SAMPLE_SAVED_INTERACTIONS;
    mockSavedCount = 2;
    mockSavedError = null;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
  });

  it('H-09: 200과 content_id, title, saved_at이 포함된 items를 반환한다', async () => {
    const { GET } = await import('@/app/api/saved/route');
    const request = new NextRequest('http://localhost/api/saved?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);

    if (body.data.items.length > 0) {
      const item = body.data.items[0];
      expect(item.content_id).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.saved_at).toBeDefined();
    }
  });

  it('H-09-2: 각 아이템에 channel, source, source_url, summary_ai가 포함된다', async () => {
    const { GET } = await import('@/app/api/saved/route');
    const request = new NextRequest('http://localhost/api/saved?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    if (body.data.items.length > 0) {
      const item = body.data.items[0];
      expect(item.channel).toBeDefined();
      expect(item.source).toBeDefined();
      expect(item.source_url).toBeDefined();
      expect('summary_ai' in item).toBe(true);
    }
  });

  it('H-09-3: pagination 필드(total, limit, offset, hasMore)가 포함된다', async () => {
    const { GET } = await import('@/app/api/saved/route');
    const request = new NextRequest('http://localhost/api/saved?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.limit).toBe('number');
    expect(typeof body.data.offset).toBe('number');
    expect(typeof body.data.hasMore).toBe('boolean');
  });
});

// ─── H-10: 저장 아이템 없는 경우 ────────────────────────────────────────────

describe('GET /api/saved — 저장 아이템 없는 경우 (H-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockSavedInteractions = [];
    mockSavedCount = 0;
    mockSavedError = null;
    mockContentItems = [];
  });

  it('H-10: 저장 아이템이 없으면 200과 items=[], total=0을 반환한다', async () => {
    const { GET } = await import('@/app/api/saved/route');
    const request = new NextRequest('http://localhost/api/saved');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.total).toBe(0);
    expect(body.data.hasMore).toBe(false);
  });

  it('H-10-2: 미인증 요청 시 401과 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/saved/route');
    const request = new NextRequest('http://localhost/api/saved');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });
});

// ─── H-11: 저장 해제 정상 동작 ──────────────────────────────────────────────

describe('DELETE /api/saved/[contentId] — 저장 해제 (H-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    // 삭제 성공: 1건 반환
    mockDeleteData = [{ content_id: 'content-uuid-001', interaction: '저장' }];
    mockDeleteError = null;
  });

  it('H-11: 유효한 UUID contentId로 요청 시 200과 success: true를 반환한다', async () => {
    const { DELETE } = await import('@/app/api/saved/[contentId]/route');
    const request = new NextRequest(
      'http://localhost/api/saved/550e8400-e29b-41d4-a716-446655440000',
      { method: 'DELETE' }
    );

    const response = await DELETE(request, {
      params: { contentId: '550e8400-e29b-41d4-a716-446655440000' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('H-11-2: 미인증 요청 시 401과 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;

    const { DELETE } = await import('@/app/api/saved/[contentId]/route');
    const request = new NextRequest(
      'http://localhost/api/saved/550e8400-e29b-41d4-a716-446655440000',
      { method: 'DELETE' }
    );

    const response = await DELETE(request, {
      params: { contentId: '550e8400-e29b-41d4-a716-446655440000' },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('H-11-3: UUID 형식이 아닌 contentId는 400과 INVALID_CONTENT_ID를 반환한다', async () => {
    const { DELETE } = await import('@/app/api/saved/[contentId]/route');
    const request = new NextRequest('http://localhost/api/saved/not-a-uuid', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: { contentId: 'not-a-uuid' } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_CONTENT_ID');
  });
});

// ─── H-12: 저장 기록 없는 contentId ──────────────────────────────────────────

describe('DELETE /api/saved/[contentId] — 저장 기록 없음 (H-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    // 삭제된 행 없음
    mockDeleteData = [];
    mockDeleteError = null;
  });

  it('H-12: 저장 기록이 없는 contentId로 요청 시 404와 SAVED_NOT_FOUND를 반환한다', async () => {
    const { DELETE } = await import('@/app/api/saved/[contentId]/route');
    const request = new NextRequest(
      'http://localhost/api/saved/660e8400-e29b-41d4-a716-446655440001',
      { method: 'DELETE' }
    );

    const response = await DELETE(request, {
      params: { contentId: '660e8400-e29b-41d4-a716-446655440001' },
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SAVED_NOT_FOUND');
  });
});
