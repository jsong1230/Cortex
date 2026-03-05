// F-07 텔레그램 봇 명령어 처리 — 단위 테스트
// test-spec.md U-07-01 ~ U-07-09

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Supabase 모킹 ──────────────────────────────────────────────────────────

// 각 테스트에서 체인 동작을 제어할 수 있는 변수
let mockSelectData: unknown[] = [];
let mockSelectError: { message: string } | null = null;
let mockInsertResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
};
let mockUpsertResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
};
let mockUpdateResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
};

// Supabase 쿼리 체인 빌더
function makeChain(resolveData: () => { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockImplementation(() => ({ select: vi.fn().mockResolvedValue(mockInsertResult) })),
    upsert: vi.fn().mockImplementation(() => Promise.resolve(mockUpsertResult)),
    update: vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue(mockUpdateResult),
    })),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(resolveData())),
    single: vi.fn().mockImplementation(() => Promise.resolve(resolveData())),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(resolveData())),
  };
  return chain;
}

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── sendMessage 모킹 ────────────────────────────────────────────────────────

const mockSendMessage = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/telegram', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  parseCallbackData: (data: string) => {
    const parts = data.split(':');
    if (parts.length !== 2) return null;
    return { action: parts[0], contentId: parts[1] };
  },
}));

// ─── 임포트 ──────────────────────────────────────────────────────────────────

import {
  parseCommand,
  handleGood,
  handleBad,
  handleSave,
  handleMore,
  handleKeyword,
  handleStats,
  handleMute,
  handleUnknown,
} from '@/lib/telegram-commands';

// ─── 테스트 픽스처 ──────────────────────────────────────────────────────────

const MOCK_BRIEFING_ID = 'briefing-uuid-001';
const MOCK_CONTENT_ID_1 = 'content-uuid-001';
const MOCK_CONTENT_ID_2 = 'content-uuid-002';

const mockBriefing = {
  id: MOCK_BRIEFING_ID,
  briefing_date: '2026-02-28',
  items: [
    { content_id: MOCK_CONTENT_ID_1, position: 1, channel: 'tech' },
    { content_id: MOCK_CONTENT_ID_2, position: 2, channel: 'world' },
  ],
  telegram_sent_at: '2026-02-28T07:00:00Z',
  created_at: '2026-02-28T07:00:00Z',
};

// ─── U-07-01: parseCommand ───────────────────────────────────────────────────

describe('parseCommand', () => {
  it('U-07-01-1: /good → { command: good, args: [] }', () => {
    const result = parseCommand('/good');
    expect(result).toEqual({ command: 'good', args: [] });
  });

  it('U-07-01-2: /bad → { command: bad, args: [] }', () => {
    const result = parseCommand('/bad');
    expect(result).toEqual({ command: 'bad', args: [] });
  });

  it('U-07-01-3: /save 3 → { command: save, args: [3] }', () => {
    const result = parseCommand('/save 3');
    expect(result).toEqual({ command: 'save', args: ['3'] });
  });

  it('U-07-01-4: /more → { command: more, args: [] }', () => {
    const result = parseCommand('/more');
    expect(result).toEqual({ command: 'more', args: [] });
  });

  it('U-07-01-5: /keyword LLM → { command: keyword, args: [LLM] }', () => {
    const result = parseCommand('/keyword LLM');
    expect(result).toEqual({ command: 'keyword', args: ['LLM'] });
  });

  it('U-07-01-6: /keyword React Server Components → { command: keyword, args: [React, Server, Components] }', () => {
    const result = parseCommand('/keyword React Server Components');
    expect(result).toEqual({ command: 'keyword', args: ['React', 'Server', 'Components'] });
  });

  it('U-07-01-7: /stats → { command: stats, args: [] }', () => {
    const result = parseCommand('/stats');
    expect(result).toEqual({ command: 'stats', args: [] });
  });

  it('U-07-01-8: /mute 3 → { command: mute, args: [3] }', () => {
    const result = parseCommand('/mute 3');
    expect(result).toEqual({ command: 'mute', args: ['3'] });
  });

  it('U-07-01-9: 슬래시 없는 일반 텍스트는 null을 반환한다', () => {
    const result = parseCommand('hello');
    expect(result).toBeNull();
  });

  it('U-07-01-10: 슬래시만 있는 경우 null을 반환한다', () => {
    const result = parseCommand('/');
    expect(result).toBeNull();
  });

  it('U-07-01-11: 대문자 /GOOD은 소문자로 정규화된다', () => {
    const result = parseCommand('/GOOD');
    expect(result).toEqual({ command: 'good', args: [] });
  });

  it('U-07-01-12: 앞뒤 공백을 trim한다', () => {
    const result = parseCommand('  /good  ');
    expect(result).toEqual({ command: 'good', args: [] });
  });

  it('U-07-01-13: 봇 명칭이 포함된 /good@CortexBot도 파싱된다', () => {
    const result = parseCommand('/good@CortexBot');
    expect(result).toEqual({ command: 'good', args: [] });
  });
});

// ─── U-07-02: handleGood ────────────────────────────────────────────────────

describe('handleGood', () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
    mockFrom.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = '12345';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('U-07-02-1: 최신 브리핑 존재 시 좋아요 반응을 기록하고 성공 메시지를 반환한다', async () => {
    // getLatestBriefing은 배열로 반환됨 (data가 배열인 쿼리 결과)
    const briefingChain = makeChain(() => ({ data: [mockBriefing], error: null }));
    mockInsertResult = { data: [{ id: 'interaction-1' }], error: null };
    mockFrom.mockReturnValue(briefingChain);

    const result = await handleGood();

    expect(result).toContain('좋아요');
    expect(mockFrom).toHaveBeenCalledWith('briefings');
  });

  it('U-07-02-2: 브리핑이 없으면 안내 메시지를 반환한다', async () => {
    const chain = makeChain(() => ({ data: [], error: null }));
    mockFrom.mockReturnValue(chain);

    const result = await handleGood();

    expect(result).toContain('브리핑');
  });
});

// ─── U-07-03: handleBad ─────────────────────────────────────────────────────

describe('handleBad', () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
    mockFrom.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = '12345';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('U-07-03-1: 최신 브리핑 존재 시 싫어요 반응을 기록하고 후속 질문이 포함된 응답을 반환한다', async () => {
    const chain = makeChain(() => ({ data: [mockBriefing], error: null }));
    mockInsertResult = { data: [{ id: 'interaction-1' }], error: null };
    mockFrom.mockReturnValue(chain);

    const result = await handleBad();

    expect(result).toContain('싫어요');
    expect(result).toContain('/keyword');
  });

  it('U-07-03-2: 브리핑이 없으면 안내 메시지를 반환한다', async () => {
    const chain = makeChain(() => ({ data: [], error: null }));
    mockFrom.mockReturnValue(chain);

    const result = await handleBad();

    expect(result).toContain('브리핑');
  });
});

// ─── U-07-04: handleSave ────────────────────────────────────────────────────

describe('handleSave', () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
    mockFrom.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = '12345';
    vi.setSystemTime(new Date('2026-02-28T07:00:00+09:00'));
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.useRealTimers();
  });

  it('U-07-04-1: 유효한 N=1 입력 시 첫 번째 아이템을 저장하고 성공 메시지를 반환한다', async () => {
    // getTodayBriefing은 배열을 반환 (data가 배열인 쿼리 결과)
    const chain = makeChain(() => ({ data: [mockBriefing], error: null }));
    mockInsertResult = { data: [{ id: 'interaction-1' }], error: null };
    mockFrom.mockReturnValue(chain);

    const result = await handleSave(1);

    expect(result).toContain('저장');
    expect(mockFrom).toHaveBeenCalledWith('briefings');
  });

  it('U-07-04-2: N=0은 유효하지 않은 번호로 처리한다', async () => {
    const result = await handleSave(0);
    expect(result).toContain('유효하지 않은');
  });

  it('U-07-04-3: N이 범위를 초과하면 유효하지 않은 번호로 처리한다', async () => {
    // 브리핑은 있지만 position=99인 아이템 없음 → "유효하지 않은 번호"
    const chain = makeChain(() => ({ data: [mockBriefing], error: null }));
    mockFrom.mockReturnValue(chain);

    const result = await handleSave(99);
    expect(result).toContain('유효하지 않은');
  });

  it('U-07-04-4: 오늘 브리핑이 없으면 안내 메시지를 반환한다', async () => {
    const chain = makeChain(() => ({ data: [], error: null }));
    mockFrom.mockReturnValue(chain);

    const result = await handleSave(1);
    expect(result).toContain('브리핑');
  });
});

// ─── U-07-05: handleMore ────────────────────────────────────────────────────

describe('handleMore', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-02-28T07:00:00+09:00'));
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('U-07-05-1: 오늘 날짜 기반 웹 URL을 포함한 텍스트를 반환한다', () => {
    const result = handleMore();
    expect(result).toContain('2026-02-28');
  });

  it('U-07-05-2: URL에 YYYY-MM-DD 형식의 날짜가 포함된다', () => {
    const result = handleMore();
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('U-07-05-3: NEXT_PUBLIC_SITE_URL 환경변수가 있으면 해당 URL을 사용한다', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://my-cortex.com';
    const result = handleMore();
    expect(result).toContain('https://my-cortex.com');
  });
});

// ─── U-07-06: handleKeyword ─────────────────────────────────────────────────

describe('handleKeyword', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockUpsertResult = { data: [{ id: 'topic-1' }], error: null };
  });

  it('U-07-06-1: 신규 키워드를 interest_profile에 UPSERT하고 성공 메시지를 반환한다', async () => {
    const chain = makeChain(() => ({ data: [{ id: 'topic-1' }], error: null }));
    chain.upsert = vi.fn().mockResolvedValue(mockUpsertResult);
    mockFrom.mockReturnValue(chain);

    const result = await handleKeyword('LLM');

    expect(result).toContain('LLM');
    expect(mockFrom).toHaveBeenCalledWith('interest_profile');
  });

  it('U-07-06-2: 빈 키워드 입력 시 안내 메시지를 반환한다', async () => {
    const result = await handleKeyword('');
    expect(result).toContain('키워드');
  });

  it('U-07-06-3: 공백만 있는 키워드는 빈 키워드로 처리한다', async () => {
    const result = await handleKeyword('   ');
    expect(result).toContain('키워드');
  });
});

// ─── U-07-07: handleStats ───────────────────────────────────────────────────

describe('handleStats', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    vi.setSystemTime(new Date('2026-02-28T07:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('U-07-07-1: 이번 달 통계를 조회하고 토픽과 아티클 수를 포함한 텍스트를 반환한다', async () => {
    const mockTopics = [
      { topic: 'LLM', score: 0.85 },
      { topic: 'Kubernetes', score: 0.72 },
    ];
    const mockInteractions = [
      { id: '1' },
      { id: '2' },
      { id: '3' },
    ];

    // interest_profile 조회와 user_interactions 조회를 구별
    mockFrom.mockImplementation((table: string) => {
      if (table === 'interest_profile') {
        return makeChain(() => ({ data: mockTopics, error: null }));
      }
      if (table === 'user_interactions') {
        return makeChain(() => ({ data: mockInteractions, error: null }));
      }
      return makeChain(() => ({ data: [], error: null }));
    });

    const result = await handleStats();

    expect(result).toContain('통계');
    expect(result).toContain('LLM');
  });

  it('U-07-07-2: 반응이 없으면 안내 메시지를 반환한다', async () => {
    mockFrom.mockImplementation(() => makeChain(() => ({ data: [], error: null })));

    const result = await handleStats();

    expect(result).toContain('통계');
  });

  it('U-07-07-3: 응답에 이모지가 포함된다', async () => {
    mockFrom.mockImplementation(() => makeChain(() => ({ data: [], error: null })));

    const result = await handleStats();

    expect(result).toMatch(/[📊🔥📚]/);
  });
});

// ─── U-07-08: handleMute ────────────────────────────────────────────────────

describe('handleMute', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockUpsertResult = { data: null, error: null };
  });

  it('U-07-08-1: N=3 입력 시 3일간 뮤트 설정을 저장하고 안내 메시지를 반환한다', async () => {
    const chain = makeChain(() => ({ data: null, error: null }));
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await handleMute(3);

    expect(result).toContain('3');
    expect(result).toContain('중단');
    expect(mockFrom).toHaveBeenCalledWith('cortex_settings');
  });

  it('U-07-08-2: N=0 입력 시 뮤트를 해제하고 재개 메시지를 반환한다', async () => {
    const chain = makeChain(() => ({ data: null, error: null }));
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await handleMute(0);

    expect(result).toContain('재개');
  });
});

// ─── U-07-09: handleUnknown ─────────────────────────────────────────────────

describe('handleUnknown', () => {
  it('U-07-09-1: 알 수 없는 명령어 입력 시 도움말을 반환한다', () => {
    const result = handleUnknown('unknown');
    expect(result).toContain('알 수 없는');
  });

  it('U-07-09-2: 도움말에 모든 지원 명령어가 포함된다', () => {
    const result = handleUnknown('xyz');
    expect(result).toContain('/good');
    expect(result).toContain('/bad');
    expect(result).toContain('/save');
    expect(result).toContain('/more');
    expect(result).toContain('/keyword');
    expect(result).toContain('/stats');
    expect(result).toContain('/mute');
  });
});
