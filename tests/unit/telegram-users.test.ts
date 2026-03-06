// lib/telegram-users.ts 단위 테스트
// getUserByTelegramId / getActiveUsers / upsertTelegramUser

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase 모킹 ───────────────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({ from: mockFrom })),
}));

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeSelectChain(data: unknown, error: unknown = null) {
  mockSingle.mockResolvedValue({ data, error });
  mockOrder.mockResolvedValue({ data, error });
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, order: mockOrder });
  mockFrom.mockReturnValue({ select: mockSelect });
}

function makeUpsertChain(data: unknown, error: unknown = null) {
  mockSingle.mockResolvedValue({ data, error });
  mockSelect.mockReturnValue({ single: mockSingle });
  mockUpsert.mockReturnValue({ select: mockSelect });
  mockFrom.mockReturnValue({ upsert: mockUpsert });
}

const sampleUser = {
  id: 'uuid-001',
  telegram_id: 123456,
  chat_id: 789012,
  first_name: '지수',
  username: 'jsong',
  is_active: true,
};

// ─── getUserByTelegramId ─────────────────────────────────────────────────────

describe('getUserByTelegramId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('등록된 사용자가 있으면 TelegramUserRecord를 반환한다', async () => {
    makeSelectChain(sampleUser);
    const { getUserByTelegramId } = await import('@/lib/telegram-users');
    const result = await getUserByTelegramId(123456);
    expect(result).toEqual(sampleUser);
  });

  it('DB에 사용자가 없으면 null을 반환한다', async () => {
    makeSelectChain(null, { message: 'No rows' });
    const { getUserByTelegramId } = await import('@/lib/telegram-users');
    const result = await getUserByTelegramId(999999);
    expect(result).toBeNull();
  });

  it('data가 null이면 null을 반환한다', async () => {
    makeSelectChain(null);
    const { getUserByTelegramId } = await import('@/lib/telegram-users');
    const result = await getUserByTelegramId(123456);
    expect(result).toBeNull();
  });

  it('telegram_id 필터로 쿼리한다', async () => {
    makeSelectChain(sampleUser);
    const { getUserByTelegramId } = await import('@/lib/telegram-users');
    await getUserByTelegramId(123456);
    expect(mockFrom).toHaveBeenCalledWith('telegram_users');
    expect(mockEq).toHaveBeenCalledWith('telegram_id', 123456);
  });
});

// ─── getActiveUsers ──────────────────────────────────────────────────────────

describe('getActiveUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('활성 사용자 목록을 반환한다', async () => {
    const users = [sampleUser, { ...sampleUser, id: 'uuid-002', telegram_id: 234567 }];
    makeSelectChain(users);
    const { getActiveUsers } = await import('@/lib/telegram-users');
    const result = await getActiveUsers();
    expect(result).toEqual(users);
    expect(result).toHaveLength(2);
  });

  it('등록된 사용자가 없으면 빈 배열을 반환한다', async () => {
    makeSelectChain([], null);
    const { getActiveUsers } = await import('@/lib/telegram-users');
    const result = await getActiveUsers();
    expect(result).toEqual([]);
  });

  it('DB 에러 시 빈 배열을 반환한다', async () => {
    makeSelectChain(null, { message: 'DB error' });
    const { getActiveUsers } = await import('@/lib/telegram-users');
    const result = await getActiveUsers();
    expect(result).toEqual([]);
  });

  it('is_active=true 필터로 쿼리한다', async () => {
    makeSelectChain([]);
    const { getActiveUsers } = await import('@/lib/telegram-users');
    await getActiveUsers();
    expect(mockFrom).toHaveBeenCalledWith('telegram_users');
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
  });
});

// ─── upsertTelegramUser ──────────────────────────────────────────────────────

describe('upsertTelegramUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('신규 사용자를 등록하고 레코드를 반환한다', async () => {
    makeUpsertChain(sampleUser);
    const { upsertTelegramUser } = await import('@/lib/telegram-users');
    const result = await upsertTelegramUser({
      telegramId: 123456,
      chatId: 789012,
      firstName: '지수',
      username: 'jsong',
    });
    expect(result).toEqual(sampleUser);
  });

  it('기존 사용자 재등록 시에도 동일하게 반환한다 (UPSERT)', async () => {
    const updated = { ...sampleUser, first_name: '지수2' };
    makeUpsertChain(updated);
    const { upsertTelegramUser } = await import('@/lib/telegram-users');
    const result = await upsertTelegramUser({
      telegramId: 123456,
      chatId: 789012,
      firstName: '지수2',
    });
    expect(result.first_name).toBe('지수2');
  });

  it('firstName/username 미제공 시 null로 저장된다', async () => {
    const userNoName = { ...sampleUser, first_name: null, username: null };
    makeUpsertChain(userNoName);
    const { upsertTelegramUser } = await import('@/lib/telegram-users');
    const result = await upsertTelegramUser({ telegramId: 123456, chatId: 789012 });
    expect(result.first_name).toBeNull();
    expect(result.username).toBeNull();
  });

  it('DB 에러 시 에러를 throw한다', async () => {
    makeUpsertChain(null, { message: 'unique violation' });
    const { upsertTelegramUser } = await import('@/lib/telegram-users');
    await expect(
      upsertTelegramUser({ telegramId: 123456, chatId: 789012 }),
    ).rejects.toThrow('사용자 등록 실패');
  });

  it('telegram_users 테이블에 UPSERT한다', async () => {
    makeUpsertChain(sampleUser);
    const { upsertTelegramUser } = await import('@/lib/telegram-users');
    await upsertTelegramUser({ telegramId: 123456, chatId: 789012 });
    expect(mockFrom).toHaveBeenCalledWith('telegram_users');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ telegram_id: 123456, chat_id: 789012, is_active: true }),
      { onConflict: 'telegram_id' },
    );
  });
});

// ─── handleStart (telegram-commands.ts) ─────────────────────────────────────

describe('handleStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('등록 성공 시 환영 메시지를 반환한다', async () => {
    vi.doMock('@/lib/telegram-users', () => ({
      getUserByTelegramId: vi.fn(),
      getActiveUsers: vi.fn(),
      upsertTelegramUser: vi.fn().mockResolvedValue(sampleUser),
    }));
    const { handleStart } = await import('@/lib/telegram-commands');
    const result = await handleStart({ telegramId: 123456, chatId: 789012, firstName: '지수' });
    expect(result).toContain('지수');
    expect(result).toContain('등록');
  });

  it('first_name 없으면 username을 이름으로 사용한다', async () => {
    const noName = { ...sampleUser, first_name: null, username: 'jsong' };
    vi.doMock('@/lib/telegram-users', () => ({
      getUserByTelegramId: vi.fn(),
      getActiveUsers: vi.fn(),
      upsertTelegramUser: vi.fn().mockResolvedValue(noName),
    }));
    const { handleStart } = await import('@/lib/telegram-commands');
    const result = await handleStart({ telegramId: 123456, chatId: 789012 });
    expect(result).toContain('jsong');
  });

  it('등록 실패 시 오류 메시지를 반환한다', async () => {
    vi.doMock('@/lib/telegram-users', () => ({
      getUserByTelegramId: vi.fn(),
      getActiveUsers: vi.fn(),
      upsertTelegramUser: vi.fn().mockRejectedValue(new Error('DB error')),
    }));
    const { handleStart } = await import('@/lib/telegram-commands');
    const result = await handleStart({ telegramId: 123456, chatId: 789012 });
    expect(result).toContain('오류');
  });
});
