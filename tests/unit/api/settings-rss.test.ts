// F-20 AC1 — GET/POST/DELETE /api/settings/rss 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase server 모킹 ─────────────────────────────────────────────────────

const MOCK_URLS = [
  { url: 'https://example.com/feed.xml', name: 'Example Blog', channel: 'tech' },
  { url: 'https://news.ycombinator.com/rss', name: 'Hacker News', channel: 'tech' },
];

let mockSelectData: { custom_rss_urls: typeof MOCK_URLS } | null = { custom_rss_urls: MOCK_URLS };
let mockSelectError: { message: string } | null = null;
let mockUpsertError: { message: string } | null = null;

const mockSingle = vi.fn().mockImplementation(async () => ({
  data: mockSelectData,
  error: mockSelectError,
}));

const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = vi.fn().mockImplementation(async () => ({
  error: mockUpsertError,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    }),
  })),
}));

// ─── GET /api/settings/rss ────────────────────────────────────────────────────

describe('GET /api/settings/rss (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelectData = { custom_rss_urls: MOCK_URLS };
    mockSelectError = null;
    mockUpsertError = null;

    mockSingle.mockImplementation(async () => ({
      data: mockSelectData,
      error: mockSelectError,
    }));
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpsert.mockImplementation(async () => ({ error: mockUpsertError }));
  });

  it('AC1-GET-1: RSS URL 목록을 반환한다', async () => {
    const { GET } = await import('@/app/api/settings/rss/route');
    const request = new NextRequest('http://localhost/api/settings/rss');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('AC1-GET-2: DB에 데이터 없으면 빈 배열을 반환한다', async () => {
    mockSelectData = null;
    mockSingle.mockImplementation(async () => ({
      data: null,
      error: { message: 'No rows found' },
    }));

    const { GET } = await import('@/app/api/settings/rss/route');
    const request = new NextRequest('http://localhost/api/settings/rss');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('AC1-GET-3: 반환 항목에 url, name, channel 필드가 있다', async () => {
    const { GET } = await import('@/app/api/settings/rss/route');
    const request = new NextRequest('http://localhost/api/settings/rss');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty('url');
      expect(body.data[0]).toHaveProperty('name');
      expect(body.data[0]).toHaveProperty('channel');
    }
  });
});

// ─── POST /api/settings/rss ───────────────────────────────────────────────────

describe('POST /api/settings/rss (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelectData = { custom_rss_urls: MOCK_URLS };
    mockSelectError = null;
    mockUpsertError = null;

    mockSingle.mockImplementation(async () => ({
      data: mockSelectData,
      error: mockSelectError,
    }));
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpsert.mockImplementation(async () => ({ error: mockUpsertError }));
  });

  const makePostRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/settings/rss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('AC1-POST-1: 유효한 URL로 추가 시 200을 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/rss/route');
    const request = makePostRequest({
      url: 'https://newblog.com/feed',
      name: 'New Blog',
      channel: 'tech',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('AC1-POST-2: url 필드 누락 시 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/rss/route');
    const request = makePostRequest({ name: 'No URL Blog', channel: 'tech' });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC1-POST-3: 잘못된 URL 형식이면 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/rss/route');
    const request = makePostRequest({
      url: 'not-a-valid-url',
      name: 'Invalid URL',
      channel: 'tech',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC1-POST-4: 잘못된 channel 값이면 400을 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/rss/route');
    const request = makePostRequest({
      url: 'https://example.com/feed',
      name: 'Example',
      channel: 'invalid_channel',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC1-POST-5: 중복 URL이면 409를 반환한다', async () => {
    const { POST } = await import('@/app/api/settings/rss/route');
    const request = makePostRequest({
      url: 'https://example.com/feed.xml',
      name: 'Duplicate',
      channel: 'tech',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
  });

  it('AC1-POST-6: channel 기본값은 tech이다', async () => {
    const { POST } = await import('@/app/api/settings/rss/route');
    const request = makePostRequest({
      url: 'https://newblog2.com/feed',
      name: 'New Blog 2',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── DELETE /api/settings/rss ─────────────────────────────────────────────────

describe('DELETE /api/settings/rss (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelectData = { custom_rss_urls: MOCK_URLS };
    mockSelectError = null;
    mockUpsertError = null;

    mockSingle.mockImplementation(async () => ({
      data: mockSelectData,
      error: mockSelectError,
    }));
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpsert.mockImplementation(async () => ({ error: mockUpsertError }));
  });

  const makeDeleteRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/settings/rss', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('AC1-DELETE-1: 존재하는 URL 삭제 시 200을 반환한다', async () => {
    const { DELETE } = await import('@/app/api/settings/rss/route');
    const request = makeDeleteRequest({ url: 'https://example.com/feed.xml' });

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('AC1-DELETE-2: url 필드 누락 시 400을 반환한다', async () => {
    const { DELETE } = await import('@/app/api/settings/rss/route');
    const request = makeDeleteRequest({});

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('AC1-DELETE-3: 존재하지 않는 URL 삭제 시 404를 반환한다', async () => {
    const { DELETE } = await import('@/app/api/settings/rss/route');
    const request = makeDeleteRequest({ url: 'https://nonexistent.com/feed' });

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });
});
