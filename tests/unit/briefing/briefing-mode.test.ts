// F-16 평일/주말 브리핑 분리 — 모드 감지 + 아이템 선정 단위 테스트
// AC1: 평일 7~8개 아이템 선정, AC2: 주말 5개 엄선 아이템 선정

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  isWeekend,
  selectBriefingItems,
  type BriefingItem,
  type BriefingMode,
} from '@/lib/telegram';

// ─── 테스트 픽스처 ──────────────────────────────────────────────────────────

function makeTechItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'tech-1',
    channel: 'tech',
    source: 'hackernews',
    source_url: 'https://news.ycombinator.com/item?id=1',
    title: 'LLM 인프라 최적화 가이드',
    summary_ai: 'LLM 서빙 비용을 50% 절감하는 실전 전략',
    score_initial: 0.85,
    ...overrides,
  };
}

function makeWorldItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'world-1',
    channel: 'world',
    source: 'naver_news',
    source_url: 'https://n.news.naver.com/1',
    title: '한국 경제 성장률 전망',
    summary_ai: '2026년 한국 경제 성장률 2.3% 예상',
    score_initial: 0.72,
    ...overrides,
  };
}

function makeCultureItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'culture-1',
    channel: 'culture',
    source: 'melon',
    source_url: 'https://www.melon.com/song/detail.htm?songId=1',
    title: '아이유 - Love wins all',
    summary_ai: '아이유 신곡이 멜론 1위 달성',
    score_initial: 0.78,
    ...overrides,
  };
}

function makeCanadaItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'canada-1',
    channel: 'canada',
    source: 'cbc',
    source_url: 'https://www.cbc.ca/news/canada/toronto/1',
    title: '토론토 교통 시스템 개편 발표',
    summary_ai: 'TTC가 2026년 하반기 요금 인상 발표',
    score_initial: 0.81,
    ...overrides,
  };
}

// 충분한 입력 아이템 생성 (평일: 7~8개, 주말: 5개를 채울 수 있도록)
function makeLargeItemSet(): BriefingItem[] {
  return [
    makeTechItem({ id: 't1', score_initial: 0.95 }),
    makeTechItem({ id: 't2', score_initial: 0.90 }),
    makeTechItem({ id: 't3', score_initial: 0.85 }),
    makeTechItem({ id: 't4', score_initial: 0.80 }),
    makeWorldItem({ id: 'w1', score_initial: 0.88 }),
    makeWorldItem({ id: 'w2', score_initial: 0.75 }),
    makeWorldItem({ id: 'w3', score_initial: 0.65 }),
    makeCultureItem({ id: 'c1', score_initial: 0.78 }),
    makeCultureItem({ id: 'c2', score_initial: 0.70 }),
    makeCanadaItem({ id: 'ca1', score_initial: 0.92 }),
    makeCanadaItem({ id: 'ca2', score_initial: 0.83 }),
    makeCanadaItem({ id: 'ca3', score_initial: 0.74 }),
  ];
}

// ─── M-01: isWeekend (KST 주말 감지) ────────────────────────────────────────

describe('isWeekend', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('M-01-1: 토요일(KST)이면 true를 반환한다', () => {
    // 2026-03-07 토요일 KST 09:00
    vi.setSystemTime(new Date('2026-03-07T00:00:00+09:00'));
    expect(isWeekend()).toBe(true);
  });

  it('M-01-2: 일요일(KST)이면 true를 반환한다', () => {
    // 2026-03-08 일요일 KST 09:00
    vi.setSystemTime(new Date('2026-03-08T00:00:00+09:00'));
    expect(isWeekend()).toBe(true);
  });

  it('M-01-3: 월요일(KST)이면 false를 반환한다', () => {
    // 2026-03-09 월요일 KST 07:00
    vi.setSystemTime(new Date('2026-03-09T07:00:00+09:00'));
    expect(isWeekend()).toBe(false);
  });

  it('M-01-4: 금요일(KST)이면 false를 반환한다', () => {
    // 2026-03-06 금요일 KST 07:00
    vi.setSystemTime(new Date('2026-03-06T07:00:00+09:00'));
    expect(isWeekend()).toBe(false);
  });

  it('M-01-5: UTC 토요일이라도 KST로는 일요일인 경우 true를 반환한다', () => {
    // UTC 토요일 2026-03-07 16:00 = KST 일요일 2026-03-08 01:00
    vi.setSystemTime(new Date('2026-03-07T16:00:00Z'));
    expect(isWeekend()).toBe(true);
  });

  it('M-01-6: UTC 금요일이지만 KST로는 토요일인 경우 true를 반환한다', () => {
    // UTC 금요일 2026-03-06 16:00 = KST 토요일 2026-03-07 01:00
    vi.setSystemTime(new Date('2026-03-06T16:00:00Z'));
    expect(isWeekend()).toBe(true);
  });

  it('M-01-7: 특정 Date 객체를 인수로 전달할 수 있다', () => {
    const saturday = new Date('2026-03-07T00:00:00+09:00');
    expect(isWeekend(saturday)).toBe(true);

    const monday = new Date('2026-03-09T07:00:00+09:00');
    expect(isWeekend(monday)).toBe(false);
  });
});

// ─── M-02: BriefingMode 타입 ─────────────────────────────────────────────────

describe('BriefingMode 타입', () => {
  it('M-02-1: BriefingMode는 weekday 또는 weekend 값을 가진다', () => {
    const weekday: BriefingMode = 'weekday';
    const weekend: BriefingMode = 'weekend';

    expect(weekday).toBe('weekday');
    expect(weekend).toBe('weekend');
  });
});

// ─── M-03: selectBriefingItems 평일 모드 ─────────────────────────────────────

describe('selectBriefingItems — weekday mode', () => {
  it('M-03-1: 평일 모드에서 TECH는 최대 3개를 반환한다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekday');
    const techItems = result.filter((i) => i.channel === 'tech');

    expect(techItems.length).toBe(3);
  });

  it('M-03-2: 평일 모드에서 WORLD는 최대 2개를 반환한다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekday');
    const worldItems = result.filter((i) => i.channel === 'world');

    expect(worldItems.length).toBe(2);
  });

  it('M-03-3: 평일 모드에서 CULTURE는 최대 1개를 반환한다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekday');
    const cultureItems = result.filter((i) => i.channel === 'culture');

    expect(cultureItems.length).toBe(1);
  });

  it('M-03-4: 평일 모드에서 TORONTO는 최대 2개를 반환한다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekday');
    const canadaItems = result.filter((i) => i.channel === 'canada');

    expect(canadaItems.length).toBe(2);
  });

  it('M-03-5: 평일 모드에서 세렌디피티 1개 포함 총 아이템 수는 8개(3+2+1+2+1)이다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekday');

    // tech:3 + world:2 + culture:1 + canada:2 + serendipity:1 = 9
    // 실제 채널 아이템만 카운트: 3+2+1+2 = 8
    const mainItems = result.filter((i) => i.channel !== 'serendipity');
    expect(mainItems.length).toBe(8);
  });

  it('M-03-6: 기존 인수 없는 호출(하위 호환)은 평일 모드처럼 동작한다', () => {
    const items = makeLargeItemSet();
    // mode 인수 없이 호출
    const result = selectBriefingItems(items);
    const techItems = result.filter((i) => i.channel === 'tech');

    // 평일 mode 기본값: tech 3개
    expect(techItems.length).toBe(3);
  });
});

// ─── M-04: selectBriefingItems 주말 모드 ─────────────────────────────────────

describe('selectBriefingItems — weekend mode', () => {
  it('M-04-1: 주말 모드에서 TECH는 최대 2개를 반환한다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekend');
    const techItems = result.filter((i) => i.channel === 'tech');

    expect(techItems.length).toBe(2);
  });

  it('M-04-2: 주말 모드에서 WORLD는 최대 1개를 반환한다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekend');
    const worldItems = result.filter((i) => i.channel === 'world');

    expect(worldItems.length).toBe(1);
  });

  it('M-04-3: 주말 모드에서 CULTURE는 최대 1개를 반환한다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekend');
    const cultureItems = result.filter((i) => i.channel === 'culture');

    expect(cultureItems.length).toBe(1);
  });

  it('M-04-4: 주말 모드에서 TORONTO는 최대 1개를 반환한다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekend');
    const canadaItems = result.filter((i) => i.channel === 'canada');

    expect(canadaItems.length).toBe(1);
  });

  it('M-04-5: 주말 모드에서 세렌디피티 제외 메인 아이템 수는 5개(2+1+1+1)이다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekend');
    const mainItems = result.filter((i) => i.channel !== 'serendipity');

    expect(mainItems.length).toBe(5);
  });

  it('M-04-6: 주말 모드에서 score_initial이 높은 아이템이 우선 선정된다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekend');
    const techItems = result.filter((i) => i.channel === 'tech');

    // t1(0.95), t2(0.90) 이 선정되어야 함
    const ids = techItems.map((i) => i.id);
    expect(ids).toContain('t1');
    expect(ids).toContain('t2');
    expect(ids).not.toContain('t3');
  });

  it('M-04-7: 주말 모드에서도 세렌디피티 1개가 포함된다', () => {
    const items = makeLargeItemSet();
    const result = selectBriefingItems(items, 'weekend');
    const serendipity = result.filter((i) => i.channel === 'serendipity');

    expect(serendipity.length).toBe(1);
  });
});
