// F-20 AC6 — GET /api/settings/telegram 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── GET /api/settings/telegram ───────────────────────────────────────────────

describe('GET /api/settings/telegram (AC6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('AC6-GET-1: TELEGRAM_CHAT_ID 환경변수가 있으면 linked=true와 마스킹된 chat_id를 반환한다', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', '123456789');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'bot:token');

    const { GET } = await import('@/app/api/settings/telegram/route');
    const request = new NextRequest('http://localhost/api/settings/telegram');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.linked).toBe(true);
    expect(body.data).toHaveProperty('chat_id_masked');

    vi.unstubAllEnvs();
  });

  it('AC6-GET-2: TELEGRAM_CHAT_ID가 없으면 linked=false를 반환한다', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');

    const { GET } = await import('@/app/api/settings/telegram/route');
    const request = new NextRequest('http://localhost/api/settings/telegram');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.linked).toBe(false);
    expect(body.data.chat_id_masked).toBeNull();

    vi.unstubAllEnvs();
  });

  it('AC6-GET-3: chat_id가 있을 때 마스킹되어 반환된다 (앞 3자리 + 마스킹)', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', '987654321');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'bot:token');

    const { GET } = await import('@/app/api/settings/telegram/route');
    const request = new NextRequest('http://localhost/api/settings/telegram');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.chat_id_masked).toBeDefined();
    expect(typeof body.data.chat_id_masked).toBe('string');
    // 마스킹: 앞 3자리만 노출 (예: "987******")
    expect(body.data.chat_id_masked).toMatch(/^.{3}\*+$/);

    vi.unstubAllEnvs();
  });

  it('AC6-GET-4: 응답에 bot_username이 포함된다', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID', '123456789');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'bot:token');

    const { GET } = await import('@/app/api/settings/telegram/route');
    const request = new NextRequest('http://localhost/api/settings/telegram');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty('bot_username');

    vi.unstubAllEnvs();
  });
});
