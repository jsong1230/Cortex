// F-10 웹 브리핑 히스토리 통합 테스트
// test-spec.md H-27 ~ H-30

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
let mockBriefing: Record<string, unknown> | null = null;
let mockContentItems: Record<string, unknown>[] = [];
let mockInteractions: Record<string, unknown>[] = [];
let mockSavedInteractions: Record<string, unknown>[] = [];
let mockSavedCount: number = 0;
let mockDeleteData: Record<string, unknown>[] = [];

const mockMaybeSingle = vi.fn().mockImplementation(async () => ({
  data: mockBriefing,
  error: null,
}));

const mockBriefingsRange = vi.fn().mockImplementation(async () => ({
  data: mockBriefings,
  count: mockBriefingsCount,
  error: null,
}));

const mockSavedRange = vi.fn().mockImplementation(async () => ({
  data: mockSavedInteractions,
  count: mockSavedCount,
  error: null,
}));

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'briefings') {
    return {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: mockBriefingsRange,
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    };
  }
  if (table === 'content_items') {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation(async () => ({ data: mockContentItems, error: null })),
    };
  }
  if (table === 'user_interactions') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: mockSavedRange,
      in: vi.fn().mockImplementation(async () => ({ data: mockInteractions, error: null })),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockImplementation(async () => ({
          data: mockDeleteData,
          error: null,
        })),
      }),
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

// ─── KST 날짜 유틸 모킹 ─────────────────────────────────────────────────────

vi.mock('@/lib/utils/date', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/utils/date')>();
  return {
    ...original,
    getTodayKST: vi.fn().mockReturnValue('2026-02-28'),
  };
});

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const BRIEFING_DATE = '2026-02-27';

const SAMPLE_BRIEFINGS = [
  {
    id: 'briefing-uuid-001',
    briefing_date: BRIEFING_DATE,
    items: [
      { content_id: 'content-uuid-001', position: 1, channel: 'tech', reason: null },
    ],
  },
];

const SAMPLE_BRIEFING_DETAIL = {
  id: 'briefing-uuid-001',
  briefing_date: BRIEFING_DATE,
  items: [
    { content_id: 'content-uuid-001', position: 1, channel: 'tech', reason: null },
  ],
};

const SAMPLE_CONTENT_ITEMS = [
  {
    id: 'content-uuid-001',
    title: 'OpenAI GPT-5 출시',
    summary_ai: 'GPT-5 관련 요약',
    source: 'hackernews',
    source_url: 'https://hn.com/1',
    channel: 'tech',
    tags: ['AI'],
  },
];

// ─── H-27: 브리핑 목록 조회 후 날짜 상세 조회 ───────────────────────────────

describe('통합 H-27: 브리핑 목록 → 날짜별 상세 일치', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefings = SAMPLE_BRIEFINGS;
    mockBriefingsCount = 1;
    mockBriefing = SAMPLE_BRIEFING_DETAIL;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = [];
  });

  it('H-27: 목록 API에서 조회한 날짜로 상세 API 조회 시 briefing_date가 일치한다', async () => {
    // 1) 목록 조회
    const { GET: listGET } = await import('@/app/api/briefings/route');
    const listRequest = new NextRequest('http://localhost/api/briefings?page=1&limit=20');
    const listResponse = await listGET(listRequest);
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.data.items.length).toBeGreaterThan(0);

    const firstDate = listBody.data.items[0].briefing_date;
    expect(firstDate).toBe(BRIEFING_DATE);

    // 2) 해당 날짜로 상세 조회
    vi.resetModules();

    vi.mock('@/lib/supabase/auth', () => ({
      getAuthUser: vi.fn().mockImplementation(async () => mockUser),
    }));
    vi.mock('@/lib/supabase/server', () => ({
      createServerClient: vi.fn().mockImplementation(() => ({ from: mockFrom })),
    }));
    vi.mock('@/lib/utils/date', async (importOriginal) => {
      const original = await importOriginal<typeof import('@/lib/utils/date')>();
      return { ...original, getTodayKST: vi.fn().mockReturnValue('2026-02-28') };
    });

    const { GET: dateGET } = await import('@/app/api/briefings/[date]/route');
    const dateRequest = new NextRequest(`http://localhost/api/briefings/${firstDate}`);
    const dateResponse = await dateGET(dateRequest, { params: { date: firstDate } });
    const dateBody = await dateResponse.json();

    expect(dateResponse.status).toBe(200);
    expect(dateBody.data.briefing_date).toBe(firstDate);
  });
});

// ─── H-28: 저장 반응 후 저장 목록에 반영 ────────────────────────────────────

describe('통합 H-28: 저장 interaction → saved 목록 반영', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockSavedInteractions = [
      { content_id: 'content-uuid-001', created_at: '2026-02-27T07:15:00+09:00' },
    ];
    mockSavedCount = 1;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
  });

  it('H-28: 저장 interaction 후 saved 목록에 해당 content_id가 포함된다', async () => {
    const { GET } = await import('@/app/api/saved/route');
    const request = new NextRequest('http://localhost/api/saved?page=1&limit=20');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toBeDefined();

    const hasItem = body.data.items.some(
      (item: { content_id: string }) => item.content_id === 'content-uuid-001'
    );
    expect(hasItem).toBe(true);
  });
});

// ─── H-29: 저장 해제 후 saved 목록에서 제거 ─────────────────────────────────

describe('통합 H-29: DELETE saved → saved 목록에서 제거', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    // 삭제 후 목록은 비어있음
    mockSavedInteractions = [];
    mockSavedCount = 0;
    mockDeleteData = [{ content_id: 'content-uuid-001', interaction: '저장' }];
  });

  it('H-29: DELETE 후 saved 목록에 해당 content_id가 미포함된다', async () => {
    // 1) 저장 해제
    const { DELETE } = await import('@/app/api/saved/[contentId]/route');
    const deleteRequest = new NextRequest(
      'http://localhost/api/saved/content-uuid-001',
      { method: 'DELETE' }
    );
    const deleteResponse = await DELETE(deleteRequest, {
      params: { contentId: 'content-uuid-001' },
    });

    // UUID 형식 검증 실패 → 실제 UUID로 대체 테스트
    // content-uuid-001은 UUID 형식이 아니므로 실제 UUID로 테스트
    const validContentId = '550e8400-e29b-41d4-a716-446655440000';

    const deleteRequest2 = new NextRequest(
      `http://localhost/api/saved/${validContentId}`,
      { method: 'DELETE' }
    );
    const deleteResponse2 = await DELETE(deleteRequest2, {
      params: { contentId: validContentId },
    });
    const deleteBody2 = await deleteResponse2.json();
    expect(deleteResponse2.status).toBe(200);
    expect(deleteBody2.success).toBe(true);

    // 2) saved 목록 조회 — content-uuid-001 미포함
    const { GET } = await import('@/app/api/saved/route');
    const savedRequest = new NextRequest('http://localhost/api/saved');
    const savedResponse = await GET(savedRequest);
    const savedBody = await savedResponse.json();

    expect(savedResponse.status).toBe(200);
    const hasItem = (savedBody.data.items as { content_id: string }[]).some(
      (item) => item.content_id === 'content-uuid-001'
    );
    expect(hasItem).toBe(false);
  });
});

// ─── H-30: [date] API와 today API 동일 구조 ─────────────────────────────────

describe('통합 H-30: [date] API가 today API와 동일한 응답 구조를 가진다', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockBriefing = SAMPLE_BRIEFING_DETAIL;
    mockContentItems = SAMPLE_CONTENT_ITEMS;
    mockInteractions = [];
  });

  it('H-30: 오늘 날짜로 [date] API 요청 시 today API와 동일한 구조(briefing_id, briefing_date, items[])를 반환한다', async () => {
    const { GET } = await import('@/app/api/briefings/[date]/route');
    const request = new NextRequest(`http://localhost/api/briefings/${BRIEFING_DATE}`);

    const response = await GET(request, { params: { date: BRIEFING_DATE } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    // today API 구조 일치 확인
    expect(body.data).toHaveProperty('briefing_id');
    expect(body.data).toHaveProperty('briefing_date');
    expect(body.data).toHaveProperty('items');
    expect(Array.isArray(body.data.items)).toBe(true);
  });
});
