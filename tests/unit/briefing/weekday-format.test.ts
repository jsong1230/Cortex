// F-16 평일/주말 브리핑 분리 — 평일 메시지 포매팅 단위 테스트
// AC1: 평일 7~8개 아이템, 제목+1줄 요약+스코어 포맷

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  formatWeekdayBriefing,
  type BriefingItem,
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

function makeCanadaItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'canada-1',
    channel: 'canada',
    source: 'cbc',
    source_url: 'https://www.cbc.ca/news/canada/toronto/1',
    title: '토론토 교통 시스템 개편 발표',
    summary_ai: 'TTC가 2026년 하반기 요금 인상 및 노선 개편 계획 발표',
    score_initial: 0.81,
    ...overrides,
  };
}

function makeWeatherItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'weather-1',
    channel: 'canada',
    source: 'weather',
    source_url: 'https://openweathermap.org/toronto',
    title: '토론토 날씨',
    summary_ai: '맑음 -3°C',
    score_initial: 0.9,
    ...overrides,
  };
}

// ─── W-01: formatWeekdayBriefing 기본 구조 ───────────────────────────────────

describe('formatWeekdayBriefing', () => {
  beforeEach(() => {
    // 2026-03-02 월요일 KST 07:00
    vi.setSystemTime(new Date('2026-03-02T07:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('W-01-1: 날짜 헤더에 "모닝 브리핑"이 포함된다', () => {
    const message = formatWeekdayBriefing([makeTechItem()]);
    expect(message).toContain('모닝 브리핑');
  });

  it('W-01-2: 날짜 헤더가 🌅 YYYY.MM.DD 요일 모닝 브리핑 형식이다', () => {
    const message = formatWeekdayBriefing([makeTechItem()]);
    expect(message).toMatch(/🌅 2026\.03\.02 .+ 모닝 브리핑/);
  });

  it('W-01-3: 채널 헤더가 포함된다 (🖥️ TECH)', () => {
    const message = formatWeekdayBriefing([makeTechItem()]);
    expect(message).toContain('🖥️ TECH');
  });

  it('W-01-4: 아이템에 번호, 링크, 1줄 요약이 포함된다', () => {
    const item = makeTechItem({ score_initial: 0.85 });
    const message = formatWeekdayBriefing([item]);

    expect(message).toContain('1.');
    expect(message).toContain(`href="${item.source_url}"`);
    expect(message).toContain(item.title);
    expect(message).toContain(item.summary_ai);
  });

  it('W-01-5: 아이템에 스코어(★)가 표시된다', () => {
    const item = makeTechItem({ score_initial: 0.85 });
    const message = formatWeekdayBriefing([item]);

    expect(message).toContain('★8.5');
  });

  it('W-01-6: HTML <a href> 링크 형식이다', () => {
    const message = formatWeekdayBriefing([makeTechItem()]);
    expect(message).toMatch(/<a href="https:\/\/.+?">/);
    expect(message).toContain('</a>');
  });

  it('W-01-7: 날씨 아이템은 📍 날씨 형식으로 표시된다 (스코어 없음)', () => {
    const weatherItem = makeWeatherItem();
    const message = formatWeekdayBriefing([weatherItem]);

    expect(message).toContain('📍 날씨:');
    expect(message).toContain('맑음 -3°C');
    expect(message).not.toMatch(/\n1\. .*맑음/);
  });

  it('W-01-8: TORONTO 채널에 날씨와 뉴스가 혼합된 경우 날씨가 먼저 표시된다', () => {
    const weatherItem = makeWeatherItem();
    const newsItem = makeCanadaItem();
    const message = formatWeekdayBriefing([weatherItem, newsItem]);

    const weatherPos = message.indexOf('📍 날씨:');
    const newsPos = message.indexOf('1.');

    expect(weatherPos).toBeGreaterThanOrEqual(0);
    expect(newsPos).toBeGreaterThan(weatherPos);
  });

  it('W-01-9: WORLD 채널 아이템도 포함된다', () => {
    const items = [makeTechItem(), makeWorldItem()];
    const message = formatWeekdayBriefing(items);

    expect(message).toContain('🌍 WORLD');
    expect(message).toContain('한국 경제 성장률 전망');
  });

  it('W-01-10: 빈 배열 입력 시 날짜 헤더만 포함된 최소 메시지를 반환한다', () => {
    const message = formatWeekdayBriefing([]);

    expect(message).toContain('모닝 브리핑');
    expect(message).not.toContain('🖥️ TECH');
  });

  it('W-01-11: 빈 채널은 헤더 없이 생략된다', () => {
    const items = [makeTechItem()]; // world, culture, canada 없음
    const message = formatWeekdayBriefing(items);

    expect(message).not.toContain('🌍 WORLD');
    expect(message).not.toContain('🎬 CULTURE');
    expect(message).not.toContain('🍁 TORONTO');
  });

  it('W-01-12: summary_ai가 null인 경우 title을 요약으로 사용한다', () => {
    const item = makeTechItem({ summary_ai: null });
    const message = formatWeekdayBriefing([item]);

    expect(message).toContain(item.title);
  });
});
