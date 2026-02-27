// F-16 평일/주말 브리핑 분리 — Weekly Digest 섹션 단위 테스트
// AC3: 토요일 브리핑에 Weekly Digest 섹션 포함

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  formatWeeklyDigest,
  type WeeklyDigestData,
} from '@/lib/weekly-digest';

// ─── 테스트 픽스처 ──────────────────────────────────────────────────────────

function makeDigestData(overrides: Partial<WeeklyDigestData> = {}): WeeklyDigestData {
  return {
    topLikedItems: [
      {
        title: 'LLM 인프라 최적화 가이드',
        source_url: 'https://news.ycombinator.com/item?id=1',
        channel: 'tech',
        like_count: 3,
      },
      {
        title: '한국 경제 성장률 전망',
        source_url: 'https://n.news.naver.com/1',
        channel: 'world',
        like_count: 2,
      },
      {
        title: '아이유 신곡 멜론 1위',
        source_url: 'https://www.melon.com/song/detail.htm?songId=1',
        channel: 'culture',
        like_count: 1,
      },
    ],
    unreadReminders: [
      {
        title: 'Claude 3.7 Sonnet 발표',
        source_url: 'https://anthropic.com/news/claude-3-7-sonnet',
        saved_at: '2026-02-24',
      },
    ],
    weeklyWeatherSummary: '이번 주 토론토: 월~수 눈, 목~금 맑음, 주말 영하권 유지',
    aiComment: '이번 주는 LLM 인프라와 클라우드 비용에 관심이 집중됐네요.',
    ...overrides,
  };
}

// ─── D-01: formatWeeklyDigest 기본 구조 ──────────────────────────────────────

describe('formatWeeklyDigest', () => {
  beforeEach(() => {
    // 2026-03-07 토요일 KST 09:00
    vi.setSystemTime(new Date('2026-03-07T09:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('D-01-1: Weekly Digest 섹션 헤더가 포함된다', () => {
    const digest = formatWeeklyDigest(makeDigestData());
    expect(digest).toContain('Weekly Digest');
  });

  it('D-01-2: 이번 주 좋아요 Top 3 섹션이 포함된다', () => {
    const digest = formatWeeklyDigest(makeDigestData());
    expect(digest).toContain('이번 주 좋아요');
  });

  it('D-01-3: Top 3 아이템 제목이 포함된다', () => {
    const data = makeDigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toContain('LLM 인프라 최적화 가이드');
    expect(digest).toContain('한국 경제 성장률 전망');
    expect(digest).toContain('아이유 신곡 멜론 1위');
  });

  it('D-01-4: Top 3 아이템에 링크가 포함된다', () => {
    const data = makeDigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toContain('href="https://news.ycombinator.com/item?id=1"');
  });

  it('D-01-5: 미완독 리마인더 섹션이 포함된다', () => {
    const digest = formatWeeklyDigest(makeDigestData());
    expect(digest).toContain('미완독');
  });

  it('D-01-6: 미완독 아이템 제목이 포함된다', () => {
    const data = makeDigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toContain('Claude 3.7 Sonnet 발표');
  });

  it('D-01-7: 토론토 주간 날씨 요약이 포함된다', () => {
    const data = makeDigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toContain('이번 주 토론토');
  });

  it('D-01-8: AI 한줄 코멘트가 포함된다', () => {
    const data = makeDigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toContain(data.aiComment);
  });

  it('D-01-9: topLikedItems가 빈 배열이면 좋아요 Top 3 섹션은 생략된다', () => {
    const data = makeDigestData({ topLikedItems: [] });
    const digest = formatWeeklyDigest(data);

    // 빈 경우 섹션이 없어야 함 (또는 "없음" 표시)
    const hasTop3 = digest.includes('이번 주 좋아요') && digest.includes('LLM');
    expect(hasTop3).toBe(false);
  });

  it('D-01-10: unreadReminders가 빈 배열이면 미완독 섹션은 생략된다', () => {
    const data = makeDigestData({ unreadReminders: [] });
    const digest = formatWeeklyDigest(data);

    expect(digest).not.toContain('Claude 3.7 Sonnet 발표');
  });

  it('D-01-11: weeklyWeatherSummary가 없으면 날씨 섹션이 생략된다', () => {
    const data = makeDigestData({ weeklyWeatherSummary: undefined });
    const digest = formatWeeklyDigest(data);

    expect(digest).not.toContain('이번 주 토론토');
  });

  it('D-01-12: aiComment가 없으면 AI 코멘트 섹션이 생략된다', () => {
    const data = makeDigestData({ aiComment: undefined });
    const digest = formatWeeklyDigest(data);

    expect(digest).not.toContain('이번 주는 LLM 인프라와');
  });

  it('D-01-13: HTML 형식으로 반환된다 (a href 포함)', () => {
    const data = makeDigestData();
    const digest = formatWeeklyDigest(data);

    expect(digest).toMatch(/<a href="https:\/\/.+?">/);
  });
});

// ─── D-02: WeeklyDigestData 타입 검증 ────────────────────────────────────────

describe('WeeklyDigestData 타입', () => {
  it('D-02-1: topLikedItems는 title, source_url, channel, like_count를 가진다', () => {
    const data = makeDigestData();
    const item = data.topLikedItems[0];

    expect(typeof item.title).toBe('string');
    expect(typeof item.source_url).toBe('string');
    expect(typeof item.channel).toBe('string');
    expect(typeof item.like_count).toBe('number');
  });

  it('D-02-2: unreadReminders는 title, source_url, saved_at을 가진다', () => {
    const data = makeDigestData();
    const reminder = data.unreadReminders[0];

    expect(typeof reminder.title).toBe('string');
    expect(typeof reminder.source_url).toBe('string');
    expect(typeof reminder.saved_at).toBe('string');
  });

  it('D-02-3: weeklyWeatherSummary와 aiComment는 선택 필드이다', () => {
    // 타입 검증: 없어도 동작해야 함
    const minimalData: WeeklyDigestData = {
      topLikedItems: [],
      unreadReminders: [],
    };
    expect(() => formatWeeklyDigest(minimalData)).not.toThrow();
  });
});
