// F-20 AC6 — GET /api/settings/telegram 단위 테스트 (멀티유저)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Supabase auth 모킹 ──────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-uuid-001' };
let mockTelegramUserId: string | null = 'telegram-user-uuid-001';

vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: vi.fn().mockImplementation(async () => mockUser),
  getTelegramUserId: vi.fn().mockImplementation(async () => mockTelegramUserId),
}));

// ─── Supabase server 모킹 ────────────────────────────────────────────────────

let mockTelegramUserData: { chat_id: number } | null = { chat_id: 123456789 };
let mockTelegramUserError: { message: string } | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTelegramUserData,
              error: mockTelegramUserError,
            }),
          }),
        }),
      }),
    }),
  })),
}));

// ─── GET /api/settings/telegram ───────────────────────────────────────────────

describe('GET /api/settings/telegram (AC6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-uuid-001' };
    mockTelegramUserId = 'telegram-user-uuid-001';
    mockTelegramUserData = { chat_id: 123456789 };
    mockTelegramUserError = null;
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('AC6-GET-1: telegram_users에 chat_id가 있으면 linked=true와 마스킹된 chat_id를 반환한다', async () => {
    const { GET } = await import('@/app/api/settings/telegram/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.linked).toBe(true);
    expect(body.data.chat_id_masked).toBeDefined();
    // 앞 3자리 + 마스킹
    expect(body.data.chat_id_masked).toMatch(/^.{3}\*+$/);
  });

  it('AC6-GET-2: telegram_users에 데이터가 없으면 linked=false를 반환한다', async () => {
    mockTelegramUserId = null;
    mockTelegramUserData = null;

    const { GET } = await import('@/app/api/settings/telegram/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.linked).toBe(false);
    expect(body.data.chat_id_masked).toBeNull();
  });

  it('AC6-GET-3: 인증 없으면 401 AUTH_REQUIRED를 반환한다', async () => {
    mockUser = null;

    const { GET } = await import('@/app/api/settings/telegram/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('AC6-GET-4: 응답에 bot_username이 포함된다 (환경변수 있음)', async () => {
    vi.stubEnv('TELEGRAM_BOT_USERNAME', 'MyBot');

    const { GET } = await import('@/app/api/settings/telegram/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.bot_username).toBe('MyBot');

    vi.unstubAllEnvs();
  });

  it('AC6-GET-5: 환경변수가 없으면 기본값 CortexBot을 반환한다', async () => {
    // 환경변수를 설정하지 않은 상태

    const { GET } = await import('@/app/api/settings/telegram/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.bot_username).toBe('CortexBot');
  });

  it('AC6-GET-6: chat_id 길이가 3 이하이면 마스킹 패턴이 다르다', async () => {
    mockTelegramUserData = { chat_id: 12 };

    const { GET } = await import('@/app/api/settings/telegram/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.chat_id_masked).toBe('12***');
  });
});
