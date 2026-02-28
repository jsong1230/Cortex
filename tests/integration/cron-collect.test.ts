// F-05 통합 테스트 — cron/collect route + summarizer 연동
// test-spec.md I-01 ~ I-10

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Claude API 모킹
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Supabase 모킹 — thenable 체인 (Supabase JS v2 쿼리 빌더 시뮬레이션)
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation(
        (resolve: (value: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [], error: null }),
      ),
    }),
  }),
}));

// 수집기 모킹
vi.mock('@/lib/collectors/tech-collector', () => ({
  TechCollector: vi.fn().mockImplementation(() => ({
    name: 'tech-collector',
    channel: 'tech',
    collect: vi.fn().mockResolvedValue({
      channel: 'tech',
      items: [
        {
          id: 'tech-1',
          channel: 'tech',
          source: 'hackernews',
          source_url: 'https://example.com/tech-1',
          title: 'Tech 아이템 1',
          full_text: 'Tech 아이템 1의 내용',
        },
      ],
      errors: [],
    }),
  })),
}));

vi.mock('@/lib/collectors/world-collector', () => ({
  WorldCollector: vi.fn().mockImplementation(() => ({
    name: 'world-collector',
    channel: 'world',
    collect: vi.fn().mockResolvedValue({
      channel: 'world',
      items: [
        {
          id: 'world-1',
          channel: 'world',
          source: 'naver_news',
          source_url: 'https://example.com/world-1',
          title: 'World 아이템 1',
        },
      ],
      errors: [],
    }),
  })),
}));

vi.mock('@/lib/collectors/culture-collector', () => ({
  CultureCollector: vi.fn().mockImplementation(() => ({
    name: 'culture-collector',
    channel: 'culture',
    collect: vi.fn().mockResolvedValue({
      channel: 'culture',
      items: [],
      errors: [],
    }),
  })),
}));

vi.mock('@/lib/collectors/toronto-collector', () => ({
  TorontoCollector: vi.fn().mockImplementation(() => ({
    name: 'toronto-collector',
    channel: 'canada',
    collect: vi.fn().mockResolvedValue({
      channel: 'canada',
      items: [],
      errors: [],
    }),
  })),
}));

import { GET } from '@/app/api/cron/collect/route';

// 인증 헬퍼
function makeAuthorizedRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/collect', {
    method: 'POST',
    headers: {
      authorization: `Bearer test-cron-secret`,
    },
  });
}

describe('GET /api/cron/collect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
  });

  // I-02: Cron Secret 미제공 시 401
  it('I-02: Cron Secret 헤더가 없으면 401을 반환한다', async () => {
    const request = new NextRequest('http://localhost/api/cron/collect', {
      method: 'POST',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  // I-03: 잘못된 Cron Secret 시 401
  it('I-03: 잘못된 Cron Secret이면 401을 반환한다', async () => {
    const request = new NextRequest('http://localhost/api/cron/collect', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-secret',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  // I-01: 정상 수집 + 요약 흐름 (Claude 모킹)
  it('I-01: 올바른 Cron Secret으로 요청 시 200과 success: true를 반환한다', async () => {
    const request = makeAuthorizedRequest();

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
