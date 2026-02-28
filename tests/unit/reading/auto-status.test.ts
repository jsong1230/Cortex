// F-19 AC2 — 원문 링크 클릭 시 "읽는 중" 자동 전환 테스트
// interactions route에서 '웹열기'/'링크클릭' 발생 시 saved_items 상태 변경

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── 모킹 설정 ────────────────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// markAsReading 모킹 (F-19 reading-loop)
const mockMarkAsReading = vi.fn();

vi.mock('@/lib/reading-loop', () => ({
  markAsReading: mockMarkAsReading,
  saveItem: vi.fn(),
  markAsCompleted: vi.fn(),
  archiveExpiredItems: vi.fn(),
  getItemsNearingArchive: vi.fn(),
  getUnreadItems: vi.fn(),
  getMonthlyUnreadSummary: vi.fn(),
}));

// 학습 루프 모킹
vi.mock('@/lib/scoring', () => ({
  updateInterestScore: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/topic-extractor', () => ({
  extractTopicsFromTags: vi.fn().mockReturnValue([]),
  registerTopicsToProfile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/serendipity', () => ({
  isSerendipityItem: vi.fn().mockReturnValue(false),
}));

// Supabase server 모킹
const mockUpsertChain = {
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'interaction-uuid-001',
        interaction: '웹열기',
        content_id: 'content-uuid-001',
      },
      error: null,
    }),
  }),
};

const mockSavedItemsSelect = vi.fn();

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'saved_items') {
    return {
      select: mockSavedItemsSelect,
    };
  }
  return {
    upsert: vi.fn().mockReturnValue(mockUpsertChain),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'interaction-uuid-001', interaction: '웹열기', content_id: 'content-uuid-001' },
          error: null,
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── 테스트 데이터 ────────────────────────────────────────────────────────────

const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// ─── AC2: 웹열기 → 읽는 중 자동 전환 ────────────────────────────────────────

describe('POST /api/interactions — 웹열기 시 읽는 중 자동 전환 (AC2)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockMarkAsReading.mockResolvedValue({ status: 'reading' });

    // saved_items 레코드 존재 (읽는 중 전환 조건 충족)
    mockSavedItemsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'saved-item-uuid-001',
              content_id: 'content-uuid-001',
              status: 'saved',
            },
            error: null,
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('AS-01: interaction=웹열기 시 markAsReading이 호출된다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest({
      content_id: 'content-uuid-001',
      interaction: '웹열기',
      source: 'web',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    // markAsReading이 비동기 fire-and-forget으로 호출됨
    // 테스트에서 즉시 확인을 위해 짧게 대기
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockMarkAsReading).toHaveBeenCalledWith('content-uuid-001');
  });

  it('AS-02: interaction=링크클릭 시 markAsReading이 호출된다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest({
      content_id: 'content-uuid-001',
      interaction: '링크클릭',
      source: 'web',
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockMarkAsReading).toHaveBeenCalledWith('content-uuid-001');
  });

  it('AS-03: interaction=좋아요 시 markAsReading이 호출되지 않는다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = makeRequest({
      content_id: 'content-uuid-001',
      interaction: '좋아요',
      source: 'web',
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockMarkAsReading).not.toHaveBeenCalled();
  });
});
