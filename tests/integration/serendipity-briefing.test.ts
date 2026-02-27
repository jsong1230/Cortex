// F-23 세렌디피티 — briefing 통합 테스트
// AC1: 전 채널에서 랜덤 선정
// AC2: 역가중치 적용
// AC3: 매일 브리핑에 1개 세렌디피티 아이템 포함

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectBriefingItems, type BriefingItem } from '@/lib/telegram';
import { buildSerendipityPool, selectSerendipityItem } from '@/lib/serendipity';

// 테스트 픽스처
function makeItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'item-default',
    channel: 'tech',
    source: 'hackernews',
    source_url: 'https://news.ycombinator.com/1',
    title: '기본 아이템',
    summary_ai: '기본 요약',
    score_initial: 0.7,
    tags: [],
    ...overrides,
  };
}

const mockItems: BriefingItem[] = [
  makeItem({ id: 'tech-1', channel: 'tech', tags: ['llm'], score_initial: 0.9 }),
  makeItem({ id: 'tech-2', channel: 'tech', tags: ['cloud'], score_initial: 0.8 }),
  makeItem({ id: 'tech-3', channel: 'tech', tags: ['rust'], score_initial: 0.75 }),
  makeItem({ id: 'world-1', channel: 'world', tags: ['economy'], score_initial: 0.7 }),
  makeItem({ id: 'world-2', channel: 'world', tags: ['politics'], score_initial: 0.65 }),
  makeItem({ id: 'culture-1', channel: 'culture', tags: ['music'], score_initial: 0.6 }),
  makeItem({ id: 'canada-1', channel: 'canada', source: 'weather', tags: ['weather'], score_initial: 0.9 }),
  makeItem({ id: 'canada-2', channel: 'canada', tags: ['toronto'], score_initial: 0.8 }),
];

describe('selectBriefingItems — 세렌디피티 포함 (AC3)', () => {
  it('AC3-1: 아이템이 있으면 결과에 channel=serendipity 아이템이 1개 포함된다', () => {
    const result = selectBriefingItems(mockItems, 'weekday');
    const serendipityItems = result.filter((item) => item.channel === 'serendipity');
    expect(serendipityItems).toHaveLength(1);
  });

  it('AC3-2: 주말 모드에서도 세렌디피티 아이템이 1개 포함된다', () => {
    const result = selectBriefingItems(mockItems, 'weekend');
    const serendipityItems = result.filter((item) => item.channel === 'serendipity');
    expect(serendipityItems).toHaveLength(1);
  });

  it('AC3-3: 세렌디피티 아이템은 기존 필드(id, title, source_url 등)를 보존한다', () => {
    const result = selectBriefingItems(mockItems, 'weekday');
    const serendipityItem = result.find((item) => item.channel === 'serendipity');
    expect(serendipityItem).toBeDefined();
    expect(serendipityItem!.id).toBeTruthy();
    expect(serendipityItem!.title).toBeTruthy();
    expect(serendipityItem!.source_url).toBeTruthy();
  });

  it('AC3-4: 아이템이 없으면 세렌디피티 아이템도 없다', () => {
    const result = selectBriefingItems([], 'weekday');
    const serendipityItems = result.filter((item) => item.channel === 'serendipity');
    expect(serendipityItems).toHaveLength(0);
  });
});

describe('buildSerendipityPool', () => {
  it('AC1-1: 전 채널에서 후보 풀을 생성한다', () => {
    const pool = buildSerendipityPool(mockItems);
    // 이미 serendipity 채널인 아이템은 제외됨
    expect(pool.length).toBeGreaterThan(0);
    // 기존 아이템들이 포함됨
    const poolIds = pool.map((c) => c.id);
    expect(poolIds).toContain('tech-1');
    expect(poolIds).toContain('world-1');
    expect(poolIds).toContain('canada-1');
  });

  it('AC1-2: 이미 channel=serendipity인 아이템은 풀에서 제외된다', () => {
    const itemsWithSerendipity = [
      ...mockItems,
      makeItem({ id: 'already-serendipity', channel: 'serendipity' }),
    ];
    const pool = buildSerendipityPool(itemsWithSerendipity);
    const poolIds = pool.map((c) => c.id);
    expect(poolIds).not.toContain('already-serendipity');
  });

  it('AC2-1: 풀의 각 후보에 inverseWeight 필드가 존재한다', () => {
    const profile = new Map<string, number>([['llm', 0.9]]);
    const pool = buildSerendipityPool(mockItems, profile);
    for (const candidate of pool) {
      expect(candidate.inverseWeight).toBeGreaterThan(0);
      expect(typeof candidate.inverseWeight).toBe('number');
    }
  });

  it('AC2-2: 관심도 높은 태그를 가진 아이템은 더 낮은 inverseWeight를 갖는다', () => {
    const profile = new Map<string, number>([['llm', 0.95], ['cloud', 0.9]]);
    const pool = buildSerendipityPool(mockItems, profile);
    const techLlm = pool.find((c) => c.id === 'tech-1'); // tags: ['llm']
    const cultureMusic = pool.find((c) => c.id === 'culture-1'); // tags: ['music'] — 프로필 없음
    expect(techLlm).toBeDefined();
    expect(cultureMusic).toBeDefined();
    // llm은 관심도 높음 → 낮은 역가중치
    // music은 프로필 없음 → 높은 역가중치
    expect(techLlm!.inverseWeight).toBeLessThan(cultureMusic!.inverseWeight);
  });
});

describe('selectSerendipityItem — 주요 선정 아이템 제외 (AC3)', () => {
  it('AC3-5: excludeIds에 포함된 아이템은 세렌디피티로 선정되지 않는다', () => {
    const profile = new Map<string, number>();
    const candidates = mockItems.map((item) => ({
      ...item,
      inverseWeight: 1.0,
    }));
    // tech 아이템 모두 제외
    const excludeIds = new Set(['tech-1', 'tech-2', 'tech-3']);
    const result = selectSerendipityItem(candidates, profile, excludeIds);
    expect(result).not.toBeNull();
    expect(excludeIds.has(result!.id)).toBe(false);
  });
});
