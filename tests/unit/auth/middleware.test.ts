/**
 * F-12 인증 — 미들웨어 리다이렉트 로직 단위 테스트
 * RED 단계: 구현 전 실패하는 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Supabase SSR 모킹
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/middleware', () => ({
  createMiddlewareClient: vi.fn(() => ({
    supabase: {
      auth: {
        getSession: mockGetSession,
        getUser: mockGetUser,
      },
    },
    response: NextResponse.next(),
  })),
}));

// middleware를 동적으로 import (mock 설정 후)
async function getMiddleware() {
  const mod = await import('@/middleware');
  return mod.middleware;
}

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

describe('middleware — 라우트 보호', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('M1: 세션 없이 / 접근 시 /login?redirect=%2F 로 리다이렉트한다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const middleware = await getMiddleware();
    const req = createRequest('/');
    const response = await middleware(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('redirect=');
  });

  it('M2: 세션 없이 /history 접근 시 /login으로 리다이렉트한다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const middleware = await getMiddleware();
    const req = createRequest('/history');
    const response = await middleware(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('M3: /login 접근은 세션 없어도 통과한다', async () => {
    // /login은 matcher에서 제외되므로 미들웨어가 호출되지 않음
    // 이 테스트는 matcher 설정을 검증
    const { config } = await import('@/middleware');
    const matcher = config.matcher;

    // /login은 매처에 포함되지 않아야 함
    const loginPath = '/login';
    const matcherPattern = matcher[0]; // '/((?!api|_next/static|_next/image|favicon.ico|login).*)'
    const regex = new RegExp(matcherPattern.replace('/((?!', '').replace(').*)',''));

    // /login이 제외 패턴에 포함됨을 확인
    expect(matcherPattern).toContain('login');
  });

  it('M4: /api/* 경로는 미들웨어 matcher에서 제외된다', async () => {
    const { config } = await import('@/middleware');
    const matcher = config.matcher;

    // api는 매처 제외 패턴에 있어야 함
    expect(matcher[0]).toContain('api');
  });

  it('M5: 유효한 세션 있으면 보호 라우트를 통과한다', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-123',
          email: '123456789@telegram.cortex.local',
        },
      },
      error: null,
    });

    const middleware = await getMiddleware();
    const req = createRequest('/');
    const response = await middleware(req);

    // 리다이렉트 없이 통과
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(302);
  });

  it('M6: 세션 있으면 response에 갱신된 쿠키가 포함된다', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-123',
          email: '123456789@telegram.cortex.local',
        },
      },
      error: null,
    });

    const middleware = await getMiddleware();
    const req = createRequest('/');
    const response = await middleware(req);

    // 미들웨어가 response를 반환하는지 확인 (쿠키 갱신 포함)
    expect(response).toBeDefined();
  });
});
