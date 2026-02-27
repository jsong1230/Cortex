/**
 * F-12 인증 — 인증 API 단위 테스트
 * RED 단계: 구현 전 실패하는 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// 테스트용 봇 토큰 (환경변수 모킹)
const TEST_BOT_TOKEN = 'test_bot_token_for_api_tests';

// 환경변수 모킹
vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN);
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// Supabase Admin mock
const mockCreateUser = vi.fn();
const mockListUsers = vi.fn();
const mockGenerateLink = vi.fn();
const mockSignOut = vi.fn();
const mockExchangeCodeForSession = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        listUsers: mockListUsers,
        generateLink: mockGenerateLink,
      },
      signOut: mockSignOut,
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signOut: mockSignOut,
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  })),
  createBrowserClient: vi.fn(),
}));

// next/headers mock
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  })),
}));

/**
 * 테스트용 유효한 hash 생성
 */
function computeValidHash(
  botToken: string,
  data: Record<string, string | number>
): string {
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');
  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

function createTelegramRequest(params: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/auth/telegram');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString(), { method: 'GET' });
}

describe('GET /api/auth/telegram', () => {
  const now = Math.floor(Date.now() / 1000);

  const baseData = {
    id: 123456789,
    first_name: 'JS',
    username: 'jsong1230',
    auth_date: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // TELEGRAM_CHAT_ID 허용 목록 설정 (테스트 사용자 ID와 일치)
    vi.stubEnv('TELEGRAM_CHAT_ID', '123456789');

    // 기본 mock 설정: listUsers → 사용자 없음
    mockListUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });
    mockCreateUser.mockResolvedValue({
      data: {
        user: {
          id: 'supabase-user-uuid',
          email: '123456789@telegram.cortex.local',
        },
      },
      error: null,
    });
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: { hashed_token: 'test-otp-token' },
        user: { id: 'supabase-user-uuid' },
      },
      error: null,
    });
  });

  it('A1: 유효한 텔레그램 데이터 → 세션 생성 후 / 로 리다이렉트한다', async () => {
    const hash = computeValidHash(TEST_BOT_TOKEN, baseData);
    const params = {
      id: String(baseData.id),
      first_name: baseData.first_name,
      username: baseData.username,
      auth_date: String(baseData.auth_date),
      hash,
    };

    const { GET } = await import('@/app/api/auth/telegram/route');
    const request = createTelegramRequest(params);
    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    // 성공 시 /api/auth/callback 또는 redirect URL로 이동
    expect(location).toBeTruthy();
  });

  it('A2: 잘못된 hash → 401 반환한다', async () => {
    const params = {
      id: String(baseData.id),
      first_name: baseData.first_name,
      username: baseData.username,
      auth_date: String(baseData.auth_date),
      hash: 'invalid_hash_value',
    };

    const { GET } = await import('@/app/api/auth/telegram/route');
    const request = createTelegramRequest(params);
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('A3: 만료된 auth_date (25시간 전) → 401 반환한다', async () => {
    const expiredAuthDate = now - 25 * 3600;
    const expiredData = { ...baseData, auth_date: expiredAuthDate };
    const hash = computeValidHash(TEST_BOT_TOKEN, expiredData);

    const params = {
      id: String(expiredData.id),
      first_name: expiredData.first_name,
      username: expiredData.username,
      auth_date: String(expiredAuthDate),
      hash,
    };

    const { GET } = await import('@/app/api/auth/telegram/route');
    const request = createTelegramRequest(params);
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('A4: redirect 파라미터 있으면 해당 URL로 리다이렉트한다', async () => {
    const hash = computeValidHash(TEST_BOT_TOKEN, baseData);
    const params = {
      id: String(baseData.id),
      first_name: baseData.first_name,
      username: baseData.username,
      auth_date: String(baseData.auth_date),
      hash,
      redirect: '/history',
    };

    const { GET } = await import('@/app/api/auth/telegram/route');
    const request = createTelegramRequest(params);
    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    // redirect 파라미터가 callback URL에 next 파라미터로 포함되어야 함 (URL 인코딩 포함)
    expect(location).toMatch(/history/);
  });

  it('A5: hash 파라미터 누락 → 400 반환한다', async () => {
    const params = {
      id: String(baseData.id),
      first_name: baseData.first_name,
      auth_date: String(baseData.auth_date),
      // hash 누락
    };

    const { GET } = await import('@/app/api/auth/telegram/route');
    const request = createTelegramRequest(params);
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('A6: 로그아웃 요청 → /login 으로 리다이렉트한다', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');
    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });
    const response = await POST(request);

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('A7: 세션 없어도 로그아웃 처리 완료 후 /login 리다이렉트한다', async () => {
    mockSignOut.mockResolvedValue({ error: new Error('no session') });

    const { POST } = await import('@/app/api/auth/logout/route');
    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });
    const response = await POST(request);

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('A8: GET 요청에 대한 export가 없다 (405 자동 처리)', async () => {
    const mod = await import('@/app/api/auth/logout/route');
    // GET export가 없어야 함 → Next.js가 자동으로 405 반환
    expect((mod as Record<string, unknown>).GET).toBeUndefined();
  });
});
