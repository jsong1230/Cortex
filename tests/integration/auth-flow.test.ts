/**
 * F-12 인증 — 전체 인증 흐름 통합 테스트
 * RED 단계: 구현 전 실패하는 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const TEST_BOT_TOKEN = 'integration_test_bot_token';

vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN);
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// Supabase mock
const mockGetUser = vi.fn();
const mockCreateUser = vi.fn();
const mockListUsers = vi.fn();
const mockGenerateLink = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        listUsers: mockListUsers,
        generateLink: mockGenerateLink,
      },
      signOut: mockSignOut,
    },
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: mockSignOut,
    },
  })),
  createBrowserClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  })),
}));

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

describe('전체 인증 흐름 통합 테스트', () => {
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    // TELEGRAM_CHAT_ID 미설정 → 모든 사용자 허용 (통합 테스트에서는 다양한 ID 사용)
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
  });

  it('I1: 비인증 사용자가 / 접근 시 /login으로 리다이렉트된다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { middleware } = await import('@/middleware');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('I2: 유효한 텔레그램 데이터로 /api/auth/telegram 호출 시 세션 생성된다', async () => {
    const userData = {
      id: 987654321,
      first_name: 'Integration',
      username: 'jsong1230',
      auth_date: now,
    };
    const hash = computeValidHash(TEST_BOT_TOKEN, userData);

    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockCreateUser.mockResolvedValue({
      data: {
        user: { id: 'supabase-uuid', email: '987654321@telegram.cortex.local' },
      },
      error: null,
    });
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: { hashed_token: 'otp-token-xyz' },
        user: { id: 'supabase-uuid' },
      },
      error: null,
    });

    const { GET } = await import('@/app/api/auth/telegram/route');
    const url = new URL('http://localhost:3000/api/auth/telegram');
    url.searchParams.set('id', String(userData.id));
    url.searchParams.set('first_name', userData.first_name);
    url.searchParams.set('username', userData.username);
    url.searchParams.set('auth_date', String(userData.auth_date));
    url.searchParams.set('hash', hash);

    const request = new Request(url.toString());
    const response = await GET(request);

    // 302 리다이렉트 = 성공
    expect(response.status).toBe(302);
  });

  it('I3: 세션 쿠키 있으면 보호 라우트 접근 가능하다', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-with-session',
          email: '123456789@telegram.cortex.local',
        },
      },
      error: null,
    });

    const { middleware } = await import('@/middleware');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await middleware(request);

    // 리다이렉트가 없어야 함
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(302);
  });

  it('I4: 로그아웃 후 /login으로 리다이렉트된다', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const { POST } = await import('@/app/api/auth/logout/route');
    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });
    const response = await POST(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('I5: Supabase Admin API로 신규 텔레그램 사용자가 생성된다', async () => {
    const userData = {
      id: 111222333,
      first_name: 'NewUser',
      auth_date: now,
    };
    const hash = computeValidHash(TEST_BOT_TOKEN, userData);

    // 기존 사용자 없음
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockCreateUser.mockResolvedValue({
      data: {
        user: { id: 'new-supabase-uuid', email: '111222333@telegram.cortex.local' },
      },
      error: null,
    });
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: { hashed_token: 'new-otp-token' },
        user: { id: 'new-supabase-uuid' },
      },
      error: null,
    });

    const { GET } = await import('@/app/api/auth/telegram/route');
    const url = new URL('http://localhost:3000/api/auth/telegram');
    url.searchParams.set('id', String(userData.id));
    url.searchParams.set('first_name', userData.first_name);
    url.searchParams.set('auth_date', String(userData.auth_date));
    url.searchParams.set('hash', hash);

    const request = new Request(url.toString());
    await GET(request);

    // createUser가 호출되었는지 확인
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: '111222333@telegram.cortex.local',
      })
    );
  });
});
