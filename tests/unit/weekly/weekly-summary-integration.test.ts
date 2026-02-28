// F-24 주간 AI 요약 — 통합 테스트
// generateWeeklySummary + formatWeeklyDigest F-24 섹션 통합 검증
// AC1 + AC2 + AC3 모두 커버

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Claude API 모킹 ────────────────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  },
}));

import {
  generateWeeklySummary,
  type WeeklySummaryData,
  type SerendipityReport,
} from '@/lib/weekly-summary';

import {
  formatWeeklyDigest,
  type WeeklyDigestData,
} from '@/lib/weekly-digest';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeClaudeTextResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    usage: { input_tokens: 300, output_tokens: 100 },
  };
}

/** 통합 Supabase mock — content_items, briefings, user_interactions 모두 포함 */
function makeFullSupabaseMock() {
  const techItems = [
    { title: 'LLM 인프라 최적화', tags: ['llm', 'infrastructure'], channel: 'tech' },
    { title: 'Rust 채택 증가', tags: ['rust', 'systems'], channel: 'tech' },
  ];

  const briefings = [
    {
      id: 'b1',
      briefing_date: '2026-03-04',
      items: [
        { content_id: 's1', channel: 'serendipity', title: '요리 레시피', tags: ['cooking'] },
        { content_id: 'c1', channel: 'tech', title: 'LLM 기사' },
      ],
    },
  ];

  const interactionsForSerendipity = [
    { content_id: 's1', action: 'like' },
  ];

  const interactionsForFocus = [
    {
      content_id: 'c1',
      action: 'like',
      content_items: { tags: ['llm', 'ai'] },
    },
    {
      content_id: 'c2',
      action: 'like',
      content_items: { tags: ['llm', 'performance'] },
    },
  ];

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'content_items') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: techItems, error: null }),
        };
      }
      if (table === 'briefings') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: briefings, error: null }),
        };
      }
      if (table === 'user_interactions') {
        // 세렌디피티 효과 측정용과 포커스 코멘트용을 구분 없이 반환
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockImplementation(() =>
            Promise.resolve({
              data: [...interactionsForSerendipity, ...interactionsForFocus],
              error: null,
            }),
          ),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  };
}

// ─── generateWeeklySummary 테스트 ─────────────────────────────────────────────

describe('generateWeeklySummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    vi.setSystemTime(new Date('2026-03-07T09:00:00+09:00'));
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.useRealTimers();
  });

  it('INT-01: WeeklySummaryData 구조를 반환한다', async () => {
    const supabase = makeFullSupabaseMock();

    // Claude API 2회 호출 (techTrends + focusComment)
    mockCreate
      .mockResolvedValueOnce(
        makeClaudeTextResponse(
          '1. LLM 기술 동향.\n2. Rust 시스템.\n3. 클라우드 최적화.',
        ),
      )
      .mockResolvedValueOnce(
        makeClaudeTextResponse('이번 주 당신의 관심은 LLM 인프라에 집중됐어요.'),
      );

    const summary = await generateWeeklySummary(supabase);

    // AC1: techTrendsSummary가 문자열이어야 함
    expect(typeof summary.techTrendsSummary).toBe('string');

    // AC2: serendipityEffect가 SerendipityReport 구조를 가져야 함
    expect(typeof summary.serendipityEffect.totalSerendipityItems).toBe('number');
    expect(typeof summary.serendipityEffect.positiveReactions).toBe('number');
    expect(Array.isArray(summary.serendipityEffect.discoveredTopics)).toBe(true);
    expect(typeof summary.serendipityEffect.effectScore).toBe('number');

    // AC3: focusComment가 문자열이어야 함
    expect(typeof summary.focusComment).toBe('string');
  });

  it('INT-02: 모든 컴포넌트가 독립적으로 실패해도 전체 함수는 완료된다', async () => {
    // Claude API 호출이 모두 실패하는 시나리오
    mockCreate.mockRejectedValue(new Error('Claude 완전 실패'));

    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    // briefings query도 실패하도록
    const supabase = {
      from: vi.fn().mockReturnValue({
        ...queryBuilder,
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };

    // throw 없이 완료돼야 함
    const summary = await generateWeeklySummary(supabase);
    expect(summary).toBeDefined();
    expect(typeof summary.techTrendsSummary).toBe('string');
    expect(typeof summary.focusComment).toBe('string');
  });
});

// ─── formatWeeklyDigest F-24 섹션 통합 테스트 ────────────────────────────────

describe('formatWeeklyDigest F-24 섹션', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-03-07T09:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** F-24 필드가 포함된 WeeklyDigestData 생성 */
  function makeF24DigestData(overrides: Partial<WeeklyDigestData> = {}): WeeklyDigestData {
    return {
      topLikedItems: [
        {
          title: 'LLM 인프라 최적화 가이드',
          source_url: 'https://news.ycombinator.com/item?id=1',
          channel: 'tech',
          like_count: 3,
        },
      ],
      unreadReminders: [],
      // F-24 신규 필드
      techTrends: '1. LLM 기술 동향이 주목.\n2. Rust 채택 급증.\n3. 클라우드 비용 절감.',
      serendipityEffect: {
        totalSerendipityItems: 5,
        positiveReactions: 3,
        discoveredTopics: ['cooking', 'music'],
        effectScore: 60,
      },
      focusComment: '이번 주 당신의 관심은 LLM 인프라에 집중됐어요.',
      ...overrides,
    };
  }

  it('AC1-F: techTrends가 있으면 "이번 주 기술 트렌드" 섹션이 포함된다', () => {
    const data = makeF24DigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toContain('기술 트렌드');
    expect(digest).toContain('LLM 기술 동향이 주목');
  });

  it('AC2-F: serendipityEffect가 있으면 "세렌디피티 효과" 섹션이 포함된다', () => {
    const data = makeF24DigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toContain('세렌디피티');
  });

  it('AC2-F2: serendipityEffect의 effectScore가 표시된다', () => {
    const data = makeF24DigestData();
    const digest = formatWeeklyDigest(data);

    // effectScore 60%가 표시돼야 함
    expect(digest).toMatch(/60/);
  });

  it('AC3-F: focusComment가 있으면 "주간 포커스" 섹션이 포함된다', () => {
    const data = makeF24DigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toContain('이번 주 당신의 관심은 LLM 인프라에 집중됐어요.');
  });

  it('AC1-F-empty: techTrends가 없거나 빈 문자열이면 기술 트렌드 섹션이 생략된다', () => {
    const data = makeF24DigestData({ techTrends: undefined });
    const digest = formatWeeklyDigest(data);

    // "기술 트렌드" 섹션이 없어야 함 (기존 Weekly Digest 구조는 유지)
    const hasTechTrendsSection =
      digest.includes('기술 트렌드') && digest.includes('LLM 기술 동향이 주목');
    expect(hasTechTrendsSection).toBe(false);
  });

  it('AC2-F-empty: serendipityEffect가 없으면 세렌디피티 섹션이 생략된다', () => {
    const data = makeF24DigestData({ serendipityEffect: undefined });
    const digest = formatWeeklyDigest(data);

    // 세렌디피티 효과 섹션이 없어야 함
    // (세렌디피티 아이템이 0개인 경우와 필드 자체가 없는 경우 둘 다 생략)
    expect(digest).not.toContain('60%');
  });

  it('AC3-F-empty: focusComment가 없으면 포커스 섹션이 생략된다', () => {
    const data = makeF24DigestData({ focusComment: undefined });
    const digest = formatWeeklyDigest(data);

    expect(digest).not.toContain('LLM 인프라에 집중됐어요.');
  });

  it('INT-F-backward: F-24 필드 없이도 기존 F-16 섹션은 정상 동작한다', () => {
    // F-24 필드를 포함하지 않는 기존 WeeklyDigestData
    const legacyData: WeeklyDigestData = {
      topLikedItems: [
        {
          title: '레거시 아이템',
          source_url: 'https://example.com',
          channel: 'tech',
          like_count: 1,
        },
      ],
      unreadReminders: [],
      aiComment: '기존 AI 코멘트입니다.',
    };

    // F-16 기존 기능이 깨지지 않아야 함
    const digest = formatWeeklyDigest(legacyData);
    expect(digest).toContain('Weekly Digest');
    expect(digest).toContain('레거시 아이템');
    expect(digest).toContain('기존 AI 코멘트입니다.');
  });
});

// ─── WeeklySummaryData 타입 검증 ──────────────────────────────────────────────

describe('WeeklySummaryData 타입', () => {
  it('TYPE-01: WeeklySummaryData는 techTrendsSummary, serendipityEffect, focusComment를 가진다', () => {
    const data: WeeklySummaryData = {
      techTrendsSummary: '1. 트렌드1\n2. 트렌드2\n3. 트렌드3',
      serendipityEffect: {
        totalSerendipityItems: 3,
        positiveReactions: 2,
        discoveredTopics: ['cooking'],
        effectScore: 67,
      },
      focusComment: '이번 주 당신의 관심은 LLM에 집중됐어요.',
    };

    expect(typeof data.techTrendsSummary).toBe('string');
    expect(typeof data.serendipityEffect.effectScore).toBe('number');
    expect(typeof data.focusComment).toBe('string');
  });

  it('TYPE-02: SerendipityReport는 4개 필드를 모두 가진다', () => {
    const report: SerendipityReport = {
      totalSerendipityItems: 5,
      positiveReactions: 3,
      discoveredTopics: ['cooking', 'music', 'sports'],
      effectScore: 60,
    };

    expect(report.totalSerendipityItems).toBe(5);
    expect(report.positiveReactions).toBe(3);
    expect(report.discoveredTopics).toHaveLength(3);
    expect(report.effectScore).toBe(60);
  });
});
