// F-21 GET /api/insights/landscape 단위 테스트
// 토픽별 현재 스코어 + 30일 히스토리 반환 검증

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

// interest_profile 조회 결과
let mockProfileData: Record<string, unknown>[] | null = null;
let mockProfileError: { message: string } | null = null;

// score_history 조회 결과
let mockHistoryData: Record<string, unknown>[] | null = null;
let mockHistoryError: { message: string } | null = null;

// from() 호출 추적용
let fromCallCount = 0;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: string) => {
      fromCallCount++;
      if (table === 'interest_profile') {
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockProfileData,
                error: mockProfileError,
              }),
            }),
          }),
        };
      }
      // score_history
      return {
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockHistoryData,
              error: mockHistoryError,
            }),
          }),
        }),
      };
    }),
  })),
}));

// ─── 기본 테스트 데이터 ──────────────────────────────────────────────────────

const SAMPLE_PROFILE = [
  { id: 'id-1', topic: 'TypeScript', score: 0.85, interaction_count: 10, last_updated: '2026-02-28T00:00:00Z' },
  { id: 'id-2', topic: 'React', score: 0.7, interaction_count: 8, last_updated: '2026-02-28T00:00:00Z' },
];

const SAMPLE_HISTORY = [
  { id: 'h-1', topic: 'TypeScript', score: 0.8, recorded_at: '2026-02-01T00:00:00Z' },
  { id: 'h-2', topic: 'TypeScript', score: 0.82, recorded_at: '2026-02-15T00:00:00Z' },
  { id: 'h-3', topic: 'React', score: 0.65, recorded_at: '2026-02-01T00:00:00Z' },
];

// ─── L-01: GET — 정상 응답 ──────────────────────────────────────────────────

describe('GET /api/insights/landscape (L-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockProfileData = SAMPLE_PROFILE;
    mockProfileError = null;
    mockHistoryData = SAMPLE_HISTORY;
    mockHistoryError = null;
    fromCallCount = 0;
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('L-01-1: 200 OK와 topics 배열을 반환한다', async () => {
    const { GET } = await import('@/app/api/insights/landscape/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.topics)).toBe(true);
  });

  it('L-01-2: 각 토픽에 topic, score, interactionCount, history 필드가 있다', async () => {
    const { GET } = await import('@/app/api/insights/landscape/route');
    const res = await GET();
    const body = await res.json();

    const topic = body.data.topics[0];
    expect(topic).toHaveProperty('topic');
    expect(topic).toHaveProperty('score');
    expect(topic).toHaveProperty('interactionCount');
    expect(topic).toHaveProperty('history');
  });

  it('L-01-3: history는 { date, score } 배열이다', async () => {
    const { GET } = await import('@/app/api/insights/landscape/route');
    const res = await GET();
    const body = await res.json();

    const tsHistory = body.data.topics.find(
      (t: { topic: string }) => t.topic === 'TypeScript'
    )?.history;

    expect(Array.isArray(tsHistory)).toBe(true);
    if (tsHistory.length > 0) {
      expect(tsHistory[0]).toHaveProperty('date');
      expect(tsHistory[0]).toHaveProperty('score');
    }
  });

  it('L-01-4: 토픽 히스토리가 해당 토픽의 것만 포함된다', async () => {
    const { GET } = await import('@/app/api/insights/landscape/route');
    const res = await GET();
    const body = await res.json();

    const tsEntry = body.data.topics.find(
      (t: { topic: string }) => t.topic === 'TypeScript'
    );
    const reactEntry = body.data.topics.find(
      (t: { topic: string }) => t.topic === 'React'
    );

    // TypeScript는 2개 히스토리, React는 1개 히스토리
    expect(tsEntry?.history?.length).toBe(2);
    expect(reactEntry?.history?.length).toBe(1);
  });

  it('L-01-5: 인증 없으면 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;
    const { GET } = await import('@/app/api/insights/landscape/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('L-01-6: interest_profile DB 에러 시 500을 반환한다', async () => {
    mockProfileError = { message: 'DB error' };
    mockProfileData = null;
    const { GET } = await import('@/app/api/insights/landscape/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
