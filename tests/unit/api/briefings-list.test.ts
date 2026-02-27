// F-10 GET /api/briefings 단위 테스트
// test-spec.md H-01 ~ H-04

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

let mockBriefings: Record<string, unknown>[] = [];
let mockBriefingsCount: number = 0;
let mockBriefingsError: { message: string } | null = null;

const mockRangeImpl = vi.fn().mockImplementation(async () => ({
  data: mockBriefings,
  count: mockBriefingsCount,
  error: mockBriefingsError,
}));

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'briefings') {
    return {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: mockRangeImpl,
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
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

const SAMPLE_BRIEFINGS = [
  {
    id: 'briefing-uuid-001',
    briefing_date: '2026-02-27',
    items: [
      { content_id: 'c-001', position: 1, channel: 'tech' },
      { content_id: 'c-002', position: 2, channel: 'world' },
      { content_id: 'c-003', position: 3, channel: 'culture' },
      { content_id: 'c-004', position: 4, channel: 'canada' },
      { content_id: 'c-005', position: 5, channel: 'serendipity' },
    ],
  },
  {
    id: 'briefing-uuid-002',
    briefing_date: '2026-02-26',
    items: [
      { content_id: 'c-006', position: 1, channel: 'tech' },
      { content_id: 'c-007', position: 2, channel: 'world' },
    ],
  },
];

// ─── H-01: 정상 조회 ─────────────────────────────────────────────────────────

describe('GET /api/briefings — 정상 조회 (H-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefings = SAMPLE_BRIEFINGS;
    mockBriefingsCount = 45;
    mockBriefingsError = null;
  });

  it('H-01: 인증된 사용자의 브리핑 목록 요청 시 200과 items, total, hasMore를 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.hasMore).toBe('boolean');
    expect(typeof body.data.limit).toBe('number');
    expect(typeof body.data.offset).toBe('number');
  });

  it('H-01-2: 각 아이템에 id, briefing_date, item_count, channels가 포함된다', async () => {
    mockBriefings = SAMPLE_BRIEFINGS;
    mockBriefingsCount = 2;

    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const firstItem = body.data.items[0];
    expect(firstItem.id).toBeDefined();
    expect(firstItem.briefing_date).toBe('2026-02-27');
    expect(firstItem.item_count).toBe(5);
    expect(Array.isArray(firstItem.channels)).toBe(true);
    expect(firstItem.channels).toContain('tech');
  });

  it('H-01-3: total=45, limit=20, offset=0, hasMore=true가 반환된다', async () => {
    mockBriefings = SAMPLE_BRIEFINGS;
    mockBriefingsCount = 45;

    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    expect(body.data.total).toBe(45);
    expect(body.data.limit).toBe(20);
    expect(body.data.offset).toBe(0);
    expect(body.data.hasMore).toBe(true);
  });

  it('H-01-4: 전체 데이터가 정확히 20건이면 hasMore=false이다', async () => {
    mockBriefings = SAMPLE_BRIEFINGS;
    mockBriefingsCount = 20;

    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    expect(body.data.hasMore).toBe(false);
  });

  it('H-01-5: 전체 데이터가 21건이면 hasMore=true이다', async () => {
    mockBriefings = SAMPLE_BRIEFINGS;
    mockBriefingsCount = 21;

    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    expect(body.data.hasMore).toBe(true);
  });

  it('H-01-6: 브리핑이 0건일 때 빈 배열과 total=0을 반환한다', async () => {
    mockBriefings = [];
    mockBriefingsCount = 0;

    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toEqual([]);
    expect(body.data.total).toBe(0);
    expect(body.data.hasMore).toBe(false);
  });
});

// ─── H-02: 미인증 ────────────────────────────────────────────────────────────

describe('GET /api/briefings — 미인증 (H-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('H-02: 미인증 사용자 요청 시 401과 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });
});

// ─── H-03: page 파라미터 검증 ────────────────────────────────────────────────

describe('GET /api/briefings — page 파라미터 검증 (H-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefings = SAMPLE_BRIEFINGS;
    mockBriefingsCount = 2;
    mockBriefingsError = null;
  });

  it('H-03-1: page=0이면 400과 INVALID_PARAMS를 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?page=0');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INVALID_PARAMS');
  });

  it('H-03-2: page=-1이면 400과 INVALID_PARAMS를 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?page=-1');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_PARAMS');
  });

  it('H-03-3: limit=0이면 400과 INVALID_PARAMS를 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?limit=0');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_PARAMS');
  });

  it('H-03-4: limit에 문자열이 전달되면 400을 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?limit=abc');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_PARAMS');
  });
});

// ─── H-04: limit 범위 검증 ───────────────────────────────────────────────────

describe('GET /api/briefings — limit 범위 검증 (H-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefings = SAMPLE_BRIEFINGS;
    mockBriefingsCount = 2;
    mockBriefingsError = null;
  });

  it('H-04: limit=100이면 400과 INVALID_PARAMS를 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?limit=100');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INVALID_PARAMS');
  });

  it('H-04-2: limit=51이면 400을 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?limit=51');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_PARAMS');
  });

  it('H-04-3: limit=50이면 정상 응답을 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/route');
    const request = new NextRequest('http://localhost/api/briefings?limit=50');

    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
