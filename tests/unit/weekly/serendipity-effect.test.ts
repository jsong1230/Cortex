// F-24 주간 AI 요약 — 세렌디피티 효과 측정 단위 테스트
// AC2: 세렌디피티 효과(예상 밖 관심사 발견)가 측정되어 보고된다

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { measureSerendipityEffect, type SerendipityReport } from '@/lib/weekly-summary';

// ─── Supabase mock 빌더 ───────────────────────────────────────────────────────

interface BriefingRow {
  id: string;
  briefing_date: string;
  items: Array<{
    content_id: string;
    channel: string;
    title: string;
    tags?: string[];
  }>;
}

interface InteractionRow {
  content_id: string;
  action: string;
}

function makeSupabaseMock(opts: {
  briefings?: BriefingRow[];
  briefingsError?: Error;
  interactions?: InteractionRow[];
  interactionsError?: Error;
}) {
  const { briefings = [], briefingsError, interactions = [], interactionsError } = opts;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'briefings') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: briefingsError ? null : briefings,
            error: briefingsError ?? null,
          }),
        };
      }
      if (table === 'user_interactions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({
            data: interactionsError ? null : interactions,
            error: interactionsError ?? null,
          }),
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

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe('measureSerendipityEffect', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-03-07T09:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('AC2-1: 세렌디피티 아이템이 없으면 effectScore=0인 리포트를 반환한다', async () => {
    const supabase = makeSupabaseMock({
      briefings: [
        {
          id: 'b1',
          briefing_date: '2026-03-04',
          items: [
            { content_id: 'c1', channel: 'tech', title: 'Tech Article' },
            { content_id: 'c2', channel: 'world', title: 'World Article' },
          ],
        },
      ],
    });

    const report = await measureSerendipityEffect(supabase);

    expect(report.totalSerendipityItems).toBe(0);
    expect(report.effectScore).toBe(0);
    expect(report.positiveReactions).toBe(0);
    expect(Array.isArray(report.discoveredTopics)).toBe(true);
  });

  it('AC2-2: 세렌디피티 아이템에 좋아요가 있으면 effectScore > 0이 된다', async () => {
    const supabase = makeSupabaseMock({
      briefings: [
        {
          id: 'b1',
          briefing_date: '2026-03-04',
          items: [
            {
              content_id: 's1',
              channel: 'serendipity',
              title: 'Serendipity Article',
              tags: ['cooking', 'food'],
            },
            { content_id: 'c1', channel: 'tech', title: 'Tech Article' },
          ],
        },
      ],
      interactions: [
        { content_id: 's1', action: 'like' },
      ],
    });

    const report = await measureSerendipityEffect(supabase);

    expect(report.totalSerendipityItems).toBe(1);
    expect(report.positiveReactions).toBe(1);
    expect(report.effectScore).toBeGreaterThan(0);
  });

  it('AC2-3: effectScore는 0~100 사이의 숫자이다', async () => {
    const supabase = makeSupabaseMock({
      briefings: [
        {
          id: 'b1',
          briefing_date: '2026-03-05',
          items: [
            {
              content_id: 's1',
              channel: 'serendipity',
              title: 'Serendipity 1',
              tags: ['cooking'],
            },
            {
              content_id: 's2',
              channel: 'serendipity',
              title: 'Serendipity 2',
              tags: ['music'],
            },
          ],
        },
      ],
      interactions: [
        { content_id: 's1', action: 'like' },
      ],
    });

    const report = await measureSerendipityEffect(supabase);

    expect(report.effectScore).toBeGreaterThanOrEqual(0);
    expect(report.effectScore).toBeLessThanOrEqual(100);
  });

  it('AC2-4: 세렌디피티 아이템에 반응한 태그가 discoveredTopics에 포함된다', async () => {
    const supabase = makeSupabaseMock({
      briefings: [
        {
          id: 'b1',
          briefing_date: '2026-03-04',
          items: [
            {
              content_id: 's1',
              channel: 'serendipity',
              title: 'Cooking Article',
              tags: ['cooking', 'food'],
            },
          ],
        },
      ],
      interactions: [
        { content_id: 's1', action: 'like' },
      ],
    });

    const report = await measureSerendipityEffect(supabase);

    expect(report.discoveredTopics.length).toBeGreaterThan(0);
    // cooking 또는 food가 discovered topics에 포함돼야 함
    const hasExpectedTopic = report.discoveredTopics.some(
      (t) => t === 'cooking' || t === 'food',
    );
    expect(hasExpectedTopic).toBe(true);
  });

  it('AC2-5: 데이터가 없어도(빈 briefings) SerendipityReport 구조를 반환한다', async () => {
    const supabase = makeSupabaseMock({ briefings: [] });

    const report = await measureSerendipityEffect(supabase);

    expect(typeof report.totalSerendipityItems).toBe('number');
    expect(typeof report.positiveReactions).toBe('number');
    expect(Array.isArray(report.discoveredTopics)).toBe(true);
    expect(typeof report.effectScore).toBe('number');
  });

  it('AC2-6: DB 조회 실패 시 기본 리포트를 반환한다 (graceful degradation)', async () => {
    const supabase = makeSupabaseMock({
      briefingsError: new Error('DB 연결 실패'),
    });

    const report = await measureSerendipityEffect(supabase);

    // 에러가 throw되지 않고 기본 리포트가 반환돼야 함
    expect(report).toBeDefined();
    expect(report.effectScore).toBe(0);
  });

  it('AC2-7: totalSerendipityItems는 이번 주 브리핑의 serendipity 채널 아이템 수이다', async () => {
    const supabase = makeSupabaseMock({
      briefings: [
        {
          id: 'b1',
          briefing_date: '2026-03-04',
          items: [
            { content_id: 's1', channel: 'serendipity', title: 'S1', tags: ['x'] },
            { content_id: 's2', channel: 'serendipity', title: 'S2', tags: ['y'] },
            { content_id: 'c1', channel: 'tech', title: 'Tech' },
          ],
        },
        {
          id: 'b2',
          briefing_date: '2026-03-05',
          items: [
            { content_id: 's3', channel: 'serendipity', title: 'S3', tags: ['z'] },
          ],
        },
      ],
    });

    const report = await measureSerendipityEffect(supabase);

    expect(report.totalSerendipityItems).toBe(3);
  });
});
