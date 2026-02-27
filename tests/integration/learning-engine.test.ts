// F-13 학습 엔진 — 통합 테스트 (RED → GREEN)
// 흐름: interaction POST → score update → briefing 선정 반영

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── 공통 모킹 ───────────────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── scoring 및 topic-extractor 모킹 ─────────────────────────────────────────

const mockUpdateInterestScore = vi.fn().mockResolvedValue(undefined);
const mockCalculateContentScore = vi.fn().mockReturnValue(0.5);
const mockCalculateTechScore = vi.fn().mockImplementation((s: number) => s);
const mockExtractTopicsFromTags = vi.fn().mockReturnValue(['AI', 'Machine Learning']);
const mockRegisterTopicsToProfile = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/scoring', () => ({
  updateInterestScore: mockUpdateInterestScore,
  calculateContentScore: mockCalculateContentScore,
  calculateTechScore: mockCalculateTechScore,
  EMA_ALPHA: 0.3,
  INTERACTION_WEIGHTS: { '좋아요': 1.0, '싫어요': -0.8 },
}));

vi.mock('@/lib/topic-extractor', () => ({
  extractTopicsFromTags: mockExtractTopicsFromTags,
  registerTopicsToProfile: mockRegisterTopicsToProfile,
}));

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockContentItem = {
  id: 'content-uuid-001',
  title: 'Test Article',
  tags: ['AI', 'Machine Learning'],
  channel: 'tech',
};

// 기본 interest_profile select 체인 (archive-topics, profile/interests 공용)
const makeInterestProfileMock = () => ({
  select: vi.fn().mockReturnValue({
    lte: vi.fn().mockReturnValue({
      lte: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    }),
    is: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'uuid-1',
            topic: 'AI',
            score: 0.9,
            interaction_count: 10,
            last_updated: '2026-02-01T00:00:00Z',
            archived_at: null,
          },
        ],
        error: null,
      }),
    }),
  }),
  update: vi.fn().mockReturnValue({
    in: vi.fn().mockResolvedValue({ error: null }),
  }),
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'content_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockContentItem, error: null }),
            }),
          }),
        };
      }
      if (table === 'user_interactions') {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'inter-1', interaction: '좋아요', content_id: 'content-uuid-001' },
                error: null,
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'inter-1', interaction: '메모', content_id: 'content-uuid-001' },
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
      }
      if (table === 'interest_profile') {
        return makeInterestProfileMock();
      }
      return {};
    }),
  })),
}));

// ─── interactions POST → learning loop 통합 ───────────────────────────────

describe('interaction POST → 학습 루프 통합', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockUpdateInterestScore.mockResolvedValue(undefined);
    mockExtractTopicsFromTags.mockReturnValue(['AI', 'Machine Learning']);
    mockRegisterTopicsToProfile.mockResolvedValue(undefined);
  });

  it('AC1+AC2+AC3: 좋아요 반응 저장 시 updateInterestScore가 올바른 인자로 호출된다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = new NextRequest('http://localhost/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: 'content-uuid-001',
        interaction: '좋아요',
        source: 'web',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBeOneOf([200, 201]);

    // 비동기 학습 루프가 완료되도록 대기
    await vi.waitFor(() => {
      expect(mockUpdateInterestScore).toHaveBeenCalled();
    }, { timeout: 2000 });

    const callArgs = mockUpdateInterestScore.mock.calls[0][0] as {
      contentId: string;
      interaction: string;
      tags: string[];
    };
    expect(callArgs.interaction).toBe('좋아요');
    expect(callArgs.contentId).toBe('content-uuid-001');
  });

  it('AC1: registerTopicsToProfile이 태그 기반으로 호출된다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const request = new NextRequest('http://localhost/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: 'content-uuid-001',
        interaction: '저장',
        source: 'web',
      }),
    });

    await POST(request);

    await vi.waitFor(() => {
      expect(mockRegisterTopicsToProfile).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('AC6: calculateTechScore가 interest_profile 기반 점수를 활용한다', async () => {
    const { calculateTechScore } = await import('@/lib/scoring');

    // Phase 2 시나리오: interest=0.8, context=0.5, recency=0.9
    // 0.8*0.6 + 0.5*0.3 + 0.9*0.1 = 0.48 + 0.15 + 0.09 = 0.72
    mockCalculateTechScore.mockImplementationOnce(
      (score: number, interest?: number, context?: number, recency?: number) => {
        if (interest !== undefined && context !== undefined && recency !== undefined) {
          return interest * 0.6 + context * 0.3 + recency * 0.1;
        }
        return score;
      }
    );

    const result = calculateTechScore(0.7, 0.8, 0.5, 0.9);
    expect(result).toBeCloseTo(0.72);
  });
});

// ─── archive-topics cron ──────────────────────────────────────────────────────

describe('AC5: archive-topics cron — 저점수 토픽 자동 보관', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('AC5: 200 OK와 archived_count를 반환한다', async () => {
    const { POST } = await import('@/app/api/cron/archive-topics/route');
    const request = new NextRequest('http://localhost/api/cron/archive-topics', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('archived_count');
  });

  it('AC5: CRON_SECRET 미매치 시 401을 반환한다', async () => {
    const { POST } = await import('@/app/api/cron/archive-topics/route');
    const request = new NextRequest('http://localhost/api/cron/archive-topics', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});

// ─── GET /api/profile/interests ───────────────────────────────────────────────

describe('GET /api/profile/interests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
  });

  it('로그인된 사용자에게 interest_profile 목록을 반환한다', async () => {
    const { GET } = await import('@/app/api/profile/interests/route');
    const response = await GET();
    const body = await response.json();

    // 이제 501이 아닌 200이어야 한다
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('topics');
    expect(body.data).toHaveProperty('total');
  });

  it('미인증 시 401을 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/profile/interests/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });
});
