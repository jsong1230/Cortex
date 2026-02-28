// F-11 통합 테스트 — 사용자 반응 수집 전체 흐름 (R-07, R-08)
// test-spec.md R-07-1 ~ R-07-4, R-08-1 ~ R-08-3

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
}));

// ─── 공통 DB 상태 ────────────────────────────────────────────────────────────

// 인메모리 반응 저장소 (통합 테스트용 가짜 DB)
let interactions: Array<{
  id: string;
  content_id: string;
  briefing_id: string | null;
  interaction: string;
  memo_text: string | null;
  source: string;
  created_at: string;
  content_items?: { title: string; channel: string };
}> = [];

let idCounter = 1;

function generateId(): string {
  return `interaction-uuid-${String(idCounter++).padStart(3, '0')}`;
}

// ─── Supabase server 모킹 — 통합 시나리오용 ────────────────────────────────

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'user_interactions') {
    return {
      // POST - upsert (비메모)
      upsert: vi.fn().mockImplementation((data: Record<string, unknown>, options?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
        const existing = interactions.find(
          (i) => i.content_id === data.content_id && i.interaction === data.interaction && data.interaction !== '메모'
        );

        if (existing && options?.ignoreDuplicates) {
          // 중복 — 기존 레코드 반환하지 않음 (ignoreDuplicates)
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }

        const newRecord = {
          id: generateId(),
          content_id: data.content_id as string,
          briefing_id: (data.briefing_id as string | null) ?? null,
          interaction: data.interaction as string,
          memo_text: (data.memo_text as string | null) ?? null,
          source: data.source as string,
          created_at: new Date().toISOString(),
        };
        interactions.push(newRecord);
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newRecord, error: null }),
          }),
        };
      }),

      // POST - insert (메모)
      insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        const newRecord = {
          id: generateId(),
          content_id: data.content_id as string,
          briefing_id: (data.briefing_id as string | null) ?? null,
          interaction: data.interaction as string,
          memo_text: (data.memo_text as string | null) ?? null,
          source: data.source as string,
          created_at: new Date().toISOString(),
        };
        interactions.push(newRecord);
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newRecord, error: null }),
          }),
        };
      }),

      // GET - select chain
      select: vi.fn().mockImplementation((fields: string) => {
        return {
          eq: vi.fn().mockImplementation((col: string, val: unknown) => ({
            eq: vi.fn().mockImplementation((col2: string, val2: unknown) => ({
              single: vi.fn().mockResolvedValue({
                data: interactions.find((i) => i.id === val) ?? null,
                error: null,
              }),
            })),
            single: vi.fn().mockResolvedValue({
              data: interactions.find((i) => i.id === val) ?? null,
              error: null,
            }),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockImplementation(async (from: number, to: number) => {
              const filtered = interactions.filter((i) => i.content_id === val);
              return {
                data: filtered.map((i) => ({ ...i, content_items: { title: '테스트 콘텐츠', channel: 'tech' } })),
                error: null,
                count: filtered.length,
              };
            }),
          })),
          in: vi.fn().mockImplementation((col: string, vals: unknown[]) => ({
            select: vi.fn().mockReturnThis(),
            data: interactions.filter((i) => (vals as string[]).includes(i.content_id)),
            error: null,
          })),
          order: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          range: vi.fn().mockImplementation(async (from: number, to: number) => ({
            data: interactions.slice(from, to + 1).map((i) => ({
              ...i,
              content_items: { title: '테스트 콘텐츠', channel: 'tech' },
            })),
            error: null,
            count: interactions.length,
          })),
        };
      }),

      // DELETE
      delete: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation((col: string, val: unknown) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(async () => {
              const idx = interactions.findIndex((i) => i.id === val);
              if (idx === -1) return { data: null, error: null };
              const [deleted] = interactions.splice(idx, 1);
              return { data: deleted, error: null };
            }),
          }),
        })),
      })),

      // UPDATE
      update: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
        eq: vi.fn().mockImplementation((col: string, val: unknown) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(async () => {
              const record = interactions.find((i) => i.id === val);
              if (!record) return { data: null, error: null };
              Object.assign(record, data);
              return { data: record, error: null };
            }),
          }),
        })),
      })),
    };
  }

  // briefings 테이블
  if (table === 'briefings') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  }

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockImplementation(async () => ({ data: [], error: null })),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// 학습 루프 모킹 (F-13): 기존 통합 테스트에 영향 없도록 no-op mock
vi.mock('@/lib/scoring', () => ({
  updateInterestScore: vi.fn().mockResolvedValue(undefined),
  calculateContentScore: vi.fn().mockReturnValue(0.5),
  calculateTechScore: vi.fn().mockImplementation((s: number) => s),
  EMA_ALPHA: 0.3,
  INTERACTION_WEIGHTS: {},
}));

vi.mock('@/lib/topic-extractor', () => ({
  extractTopicsFromTags: vi.fn().mockReturnValue([]),
  registerTopicsToProfile: vi.fn().mockResolvedValue(undefined),
}));

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

const makePostRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeGetRequest = (queryParams = '') =>
  new NextRequest(`http://localhost/api/interactions${queryParams ? '?' + queryParams : ''}`);

const makeDeleteRequest = (id: string) =>
  new NextRequest(`http://localhost/api/interactions/${id}`, { method: 'DELETE' });

const makePutRequest = (id: string, body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/interactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeStatsRequest = (queryParams = '') =>
  new NextRequest(`http://localhost/api/interactions/stats${queryParams ? '?' + queryParams : ''}`);

// ─── R-07: 웹 + 텔레그램 통합 반응 흐름 ─────────────────────────────────────

describe('사용자 반응 수집 통합 흐름 (R-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    interactions = [];
    idCounter = 1;
    mockUser = { id: 'user-uuid-001' };
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('R-07-1: 웹에서 좋아요 → GET 이력 조회 시 items에 포함된다', async () => {
    const { POST, GET } = await import('@/app/api/interactions/route');

    // 좋아요 저장
    const postResponse = await POST(
      makePostRequest({ content_id: 'content-uuid-001', interaction: '좋아요', source: 'web' })
    );
    const postBody = await postResponse.json();
    expect(postResponse.status).toBe(201);
    expect(postBody.success).toBe(true);

    // 이력 조회
    const getResponse = await GET(makeGetRequest('content_id=content-uuid-001'));
    const getBody = await getResponse.json();
    expect(getResponse.status).toBe(200);
    expect(getBody.data.items.length).toBeGreaterThan(0);
  });

  it('R-07-3: 반응 저장 → 삭제 시 반응이 제거된다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const { DELETE } = await import('@/app/api/interactions/[id]/route');

    // 반응 저장
    const postResponse = await POST(
      makePostRequest({ content_id: 'content-uuid-001', interaction: '저장', source: 'web' })
    );
    const postBody = await postResponse.json();
    expect(postResponse.status).toBe(201);
    const interactionId = postBody.data.id;

    // 반응 삭제
    const deleteResponse = await DELETE(
      makeDeleteRequest(interactionId),
      { params: { id: interactionId } }
    );
    const deleteBody = await deleteResponse.json();
    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.success).toBe(true);
  });

  it('R-07-4: 메모 생성 → 수정 시 메모 텍스트가 반영된다', async () => {
    const { POST } = await import('@/app/api/interactions/route');
    const { PUT } = await import('@/app/api/interactions/[id]/route');

    // 메모 생성
    const postResponse = await POST(
      makePostRequest({
        content_id: 'content-uuid-001',
        interaction: '메모',
        memo_text: '원본 메모',
        source: 'web',
      })
    );
    const postBody = await postResponse.json();
    expect(postResponse.status).toBe(201);
    const memoId = postBody.data.id;

    // 메모 수정
    const putResponse = await PUT(
      makePutRequest(memoId, { memo_text: '수정된 메모' }),
      { params: { id: memoId } }
    );
    const putBody = await putResponse.json();
    expect(putResponse.status).toBe(200);
    expect(putBody.data.memo_text).toBe('수정된 메모');
  });
});

// ─── R-08: 스킵 자동 기록 (send-briefing Cron) ───────────────────────────────

describe('스킵 자동 기록 — send-briefing Cron (R-08)', () => {
  const MOCK_CRON_SECRET = 'test-cron-secret-456';

  beforeEach(() => {
    vi.clearAllMocks();
    interactions = [];
    idCounter = 1;
    process.env.CRON_SECRET = MOCK_CRON_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = '123456789';
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('R-08-3: 어제 브리핑이 없으면 스킵 로직을 건너뛰고 에러 없이 처리된다', async () => {
    // 어제 브리핑 없음 — briefings 테이블에서 null 반환
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 1 } }),
      text: () => Promise.resolve('{"ok":true}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    // content_items도 빈 배열 반환
    mockFrom.mockImplementation((table: string) => {
      if (table === 'content_items') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'briefings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: [{ id: 'briefing-new' }], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
      };
    });

    const { GET } = await import('@/app/api/cron/send-briefing/route');
    const request = new NextRequest('http://localhost/api/cron/send-briefing', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MOCK_CRON_SECRET}` },
    });

    const response = await GET(request);
    // 아이템이 없으므로 200 OK (스킵 안내) 또는 200 OK (정상 처리)
    expect(response.status).not.toBe(500);

    vi.unstubAllGlobals();
  });
});
