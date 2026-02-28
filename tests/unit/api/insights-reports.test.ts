// F-22 API 단위 테스트
// GET /api/insights/reports — 월간 리포트 목록
// GET /api/insights/reports/[month] — 특정 월 리포트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

let mockReportsData: Record<string, unknown>[] = [];
let mockReportsCount: number = 0;
let mockReportsError: { message: string } | null = null;
let mockSingleData: Record<string, unknown> | null = null;
let mockSingleError: { message: string } | null = null;

const mockSingle = vi.fn().mockImplementation(async () => ({
  data: mockSingleData,
  error: mockSingleError,
}));

const mockEqForSingle = vi.fn().mockReturnValue({ single: mockSingle });

const mockRangeImpl = vi.fn().mockImplementation(async () => ({
  data: mockReportsData,
  count: mockReportsCount,
  error: mockReportsError,
}));

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'monthly_reports') {
    return {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: mockRangeImpl,
      eq: mockEqForSingle,
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 샘플 데이터 ─────────────────────────────────────────────────────────

const SAMPLE_REPORTS = [
  {
    id: 'report-uuid-001',
    report_month: '2026-01',
    content: '## 2026년 1월 리포트\n내용입니다.',
    summary: '1월 요약입니다.',
    top_topics: [{ topic: 'llm', readCount: 3, score: 0.9 }],
    generated_at: '2026-02-01T01:00:00Z',
    telegram_sent_at: '2026-02-01T01:05:00Z',
  },
  {
    id: 'report-uuid-002',
    report_month: '2025-12',
    content: '## 2025년 12월 리포트\n내용입니다.',
    summary: '12월 요약입니다.',
    top_topics: [{ topic: 'cloud-cost', readCount: 2, score: 0.7 }],
    generated_at: '2026-01-01T01:00:00Z',
    telegram_sent_at: null,
  },
];

// ─── GET /api/insights/reports 테스트 ─────────────────────────────────────

describe('GET /api/insights/reports — 월간 리포트 목록 (IR-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockReportsData = SAMPLE_REPORTS;
    mockReportsCount = 2;
    mockReportsError = null;
    mockSingleData = null;
    mockSingleError = null;

    mockRangeImpl.mockImplementation(async () => ({
      data: mockReportsData,
      count: mockReportsCount,
      error: mockReportsError,
    }));
    mockSingle.mockImplementation(async () => ({ data: mockSingleData, error: mockSingleError }));
    mockEqForSingle.mockReturnValue({ single: mockSingle });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'monthly_reports') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: mockRangeImpl,
          eq: mockEqForSingle,
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    vi.resetModules();
  });

  it('IR-01: 인증된 사용자의 요청 시 200과 리포트 목록을 반환한다', async () => {
    const { GET } = await import('@/app/api/insights/reports/route');
    const request = new NextRequest('http://localhost/api/insights/reports');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('IR-02: 각 리포트 아이템에 id, report_month, summary, top_topics, generated_at이 포함된다', async () => {
    const { GET } = await import('@/app/api/insights/reports/route');
    const request = new NextRequest('http://localhost/api/insights/reports');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const firstItem = body.data.items[0];
    expect(firstItem.id).toBeDefined();
    expect(firstItem.report_month).toBe('2026-01');
    expect(typeof firstItem.summary).toBe('string');
    expect(Array.isArray(firstItem.top_topics)).toBe(true);
    expect(firstItem.generated_at).toBeDefined();
  });

  it('IR-03: 미인증 사용자 요청 시 401과 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/insights/reports/route');
    const request = new NextRequest('http://localhost/api/insights/reports');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('IR-04: total, hasMore, limit, offset이 응답에 포함된다', async () => {
    const { GET } = await import('@/app/api/insights/reports/route');
    const request = new NextRequest('http://localhost/api/insights/reports?page=1&limit=10');

    const response = await GET(request);
    const body = await response.json();

    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.hasMore).toBe('boolean');
    expect(typeof body.data.limit).toBe('number');
    expect(typeof body.data.offset).toBe('number');
  });

  it('IR-05: 리포트가 0건일 때 빈 배열과 total=0을 반환한다', async () => {
    mockReportsData = [];
    mockReportsCount = 0;

    mockRangeImpl.mockImplementation(async () => ({
      data: [],
      count: 0,
      error: null,
    }));

    const { GET } = await import('@/app/api/insights/reports/route');
    const request = new NextRequest('http://localhost/api/insights/reports');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toEqual([]);
    expect(body.data.total).toBe(0);
    expect(body.data.hasMore).toBe(false);
  });
});

// ─── GET /api/insights/reports/[month] 테스트 ─────────────────────────────

describe('GET /api/insights/reports/[month] — 특정 월 리포트 조회 (IR-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockSingleData = SAMPLE_REPORTS[0];
    mockSingleError = null;

    mockSingle.mockImplementation(async () => ({ data: mockSingleData, error: mockSingleError }));
    mockEqForSingle.mockReturnValue({ single: mockSingle });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'monthly_reports') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: mockRangeImpl,
          eq: mockEqForSingle,
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    vi.resetModules();
  });

  it('IR-10: 유효한 month로 요청 시 200과 전체 리포트 content를 반환한다', async () => {
    const { GET } = await import('@/app/api/insights/reports/[month]/route');
    const request = new NextRequest('http://localhost/api/insights/reports/2026-01');

    const response = await GET(request, { params: Promise.resolve({ month: '2026-01' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.report_month).toBe('2026-01');
    expect(typeof body.data.content).toBe('string');
  });

  it('IR-11: 존재하지 않는 month 요청 시 404를 반환한다', async () => {
    mockSingleData = null;
    mockSingleError = { message: '레코드 없음' };

    mockSingle.mockImplementation(async () => ({ data: null, error: mockSingleError }));

    const { GET } = await import('@/app/api/insights/reports/[month]/route');
    const request = new NextRequest('http://localhost/api/insights/reports/2020-01');

    const response = await GET(request, { params: Promise.resolve({ month: '2020-01' }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('REPORT_NOT_FOUND');
  });

  it('IR-12: 미인증 사용자 요청 시 401을 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/insights/reports/[month]/route');
    const request = new NextRequest('http://localhost/api/insights/reports/2026-01');

    const response = await GET(request, { params: Promise.resolve({ month: '2026-01' }) });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('IR-13: month 포맷이 잘못된 경우 400을 반환한다 (YYYY-MM 아닌 경우)', async () => {
    const { GET } = await import('@/app/api/insights/reports/[month]/route');
    const request = new NextRequest('http://localhost/api/insights/reports/2026-1');

    const response = await GET(request, { params: Promise.resolve({ month: '2026-1' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('IR-14: 응답에 id, report_month, content, summary, top_topics, generated_at이 포함된다', async () => {
    const { GET } = await import('@/app/api/insights/reports/[month]/route');
    const request = new NextRequest('http://localhost/api/insights/reports/2026-01');

    const response = await GET(request, { params: Promise.resolve({ month: '2026-01' }) });
    const body = await response.json();

    expect(body.data.id).toBeDefined();
    expect(body.data.report_month).toBe('2026-01');
    expect(typeof body.data.content).toBe('string');
    expect(typeof body.data.summary).toBe('string');
    expect(Array.isArray(body.data.top_topics)).toBe(true);
    expect(body.data.generated_at).toBeDefined();
  });
});
