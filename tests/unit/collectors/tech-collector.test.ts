// F-01: TechCollector 오케스트레이터 단위 테스트
// test-spec.md: TechCollector 오케스트레이터 섹션 참조

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CollectedItem } from '@/lib/collectors/types';

// 각 소스 수집 함수 모킹
vi.mock('@/lib/collectors/hackernews', () => ({
  collectHackerNews: vi.fn(),
}));
vi.mock('@/lib/collectors/github', () => ({
  collectGitHubTrending: vi.fn(),
}));
vi.mock('@/lib/collectors/rss', () => ({
  collectMultipleRssFeeds: vi.fn().mockResolvedValue([
    { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/1', title: 'RSS 1' },
    { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/2', title: 'RSS 2' },
    { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/3', title: 'RSS 3' },
    { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/4', title: 'RSS 4' },
    { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/5', title: 'RSS 5' },
  ]),
  collectRssFeed: vi.fn(),
  rssItemToCollectedItem: (item: Record<string, unknown>) => ({
    channel: item.channel,
    source: item.source,
    source_url: item.sourceUrl,
    title: item.title,
  }),
  RSS_FEEDS: [],
}));

import { TechCollector } from '@/lib/collectors/tech-collector';
import { collectHackerNews } from '@/lib/collectors/hackernews';
import { collectGitHubTrending } from '@/lib/collectors/github';
import { collectMultipleRssFeeds } from '@/lib/collectors/rss';

// CollectedItem fixture 생성 헬퍼
const makeTechItems = (count: number, source: string): CollectedItem[] =>
  Array.from({ length: count }, (_, i) => ({
    channel: 'tech' as const,
    source,
    source_url: `https://example.com/${source}/${i + 1}`,
    title: `${source} Article ${i + 1}`,
    published_at: new Date(),
  }));

// RSS mock 기본 5개 fixture
const makeRssItems = () => [
  { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/1', title: 'RSS 1' },
  { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/2', title: 'RSS 2' },
  { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/3', title: 'RSS 3' },
  { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/4', title: 'RSS 4' },
  { channel: 'tech', source: 'rss_tech', sourceUrl: 'https://rss.com/5', title: 'RSS 5' },
];

describe('TechCollector', () => {
  let collector: TechCollector;

  beforeEach(() => {
    collector = new TechCollector();
    vi.clearAllMocks();
    // RSS mock 기본값 재설정 (vi.clearAllMocks 후 초기화되므로)
    vi.mocked(collectMultipleRssFeeds).mockResolvedValue(makeRssItems() as ReturnType<typeof collectMultipleRssFeeds> extends Promise<infer T> ? T : never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('name, channel 속성', () => {
    it('이름이 tech-collector이다', () => {
      expect(collector.name).toBe('tech-collector');
    });

    it('채널이 tech이다', () => {
      expect(collector.channel).toBe('tech');
    });
  });

  describe('collect()', () => {
    it('3개 소스 모두 성공 시 합산된 아이템을 반환하고 errors는 빈 배열이다', async () => {
      // Arrange
      vi.mocked(collectHackerNews).mockResolvedValue(makeTechItems(10, 'hackernews'));
      vi.mocked(collectGitHubTrending).mockResolvedValue(makeTechItems(20, 'github_trending'));
      // RSS는 내부 함수를 통해 호출되므로 별도 모킹 필요 없음

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items.length).toBe(35);
      expect(result.errors).toHaveLength(0);
    });

    it('HN 실패 시 나머지 소스 데이터 포함 + errors에 1개 기록된다', async () => {
      // Arrange
      vi.mocked(collectHackerNews).mockRejectedValue(new Error('HN 실패'));
      vi.mocked(collectGitHubTrending).mockResolvedValue(makeTechItems(20, 'github_trending'));

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items.length).toBe(25); // GitHub 20 + RSS 5
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].source).toBe('hackernews');
    });

    it('GitHub 실패 시 나머지 소스 데이터 포함 + errors에 1개 기록된다', async () => {
      // Arrange
      vi.mocked(collectHackerNews).mockResolvedValue(makeTechItems(10, 'hackernews'));
      vi.mocked(collectGitHubTrending).mockRejectedValue(new Error('GitHub 실패'));

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items.length).toBe(15); // HN 10 + RSS 5
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].source).toBe('github_trending');
    });

    it('3개 소스 모두 실패 시 빈 배열 + errors에 3개 기록된다', async () => {
      // Arrange
      vi.mocked(collectHackerNews).mockRejectedValue(new Error('HN 실패'));
      vi.mocked(collectGitHubTrending).mockRejectedValue(new Error('GitHub 실패'));
      vi.mocked(collectMultipleRssFeeds).mockRejectedValue(new Error('RSS 실패'));

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.errors).toHaveLength(3);
    });

    it('모든 아이템의 channel이 tech이다', async () => {
      // Arrange
      vi.mocked(collectHackerNews).mockResolvedValue(makeTechItems(5, 'hackernews'));
      vi.mocked(collectGitHubTrending).mockResolvedValue(makeTechItems(5, 'github_trending'));

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items.every((item) => item.channel === 'tech')).toBe(true);
    });

    it('3개 소스를 병렬로 실행하여 전체 소요 시간이 ~100ms이다', async () => {
      // Arrange: 각 소스가 100ms 지연
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      vi.mocked(collectHackerNews).mockImplementation(async () => {
        await delay(100);
        return makeTechItems(5, 'hackernews');
      });
      vi.mocked(collectGitHubTrending).mockImplementation(async () => {
        await delay(100);
        return makeTechItems(5, 'github_trending');
      });

      // Act
      const start = Date.now();
      await collector.collect();
      const elapsed = Date.now() - start;

      // Assert: 병렬 실행이므로 ~100ms (순차 실행이면 ~300ms)
      expect(elapsed).toBeLessThan(250);
    });

    it('CollectorResult의 channel은 tech이다', async () => {
      // Arrange
      vi.mocked(collectHackerNews).mockResolvedValue([]);
      vi.mocked(collectGitHubTrending).mockResolvedValue([]);

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.channel).toBe('tech');
    });
  });
});

// safeCollect 유틸리티 테스트
describe('safeCollect', () => {
  it('정상 실행 시 items를 반환하고 error는 undefined이다', async () => {
    // Arrange
    const { safeCollect } = await import('@/lib/collectors/utils');
    const items = makeTechItems(3, 'hackernews');
    const fn = vi.fn().mockResolvedValue(items);

    // Act
    const result = await safeCollect('hackernews', fn);

    // Assert
    expect(result.items).toEqual(items);
    expect(result.error).toBeUndefined();
  });

  it('함수 throw 시 빈 배열과 error 객체를 반환한다', async () => {
    // Arrange
    const { safeCollect } = await import('@/lib/collectors/utils');
    const fn = vi.fn().mockRejectedValue(new Error('수집 실패'));

    // Act
    const result = await safeCollect('hackernews', fn);

    // Assert
    expect(result.items).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error?.source).toBe('hackernews');
    expect(result.error?.message).toBe('수집 실패');
    expect(result.error?.timestamp).toBeInstanceOf(Date);
  });

  it('비동기 reject 시 빈 배열과 error 객체를 반환한다', async () => {
    // Arrange
    const { safeCollect } = await import('@/lib/collectors/utils');
    const fn = vi.fn().mockImplementation(() => Promise.reject(new Error('비동기 실패')));

    // Act
    const result = await safeCollect('test_source', fn);

    // Assert
    expect(result.items).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error?.source).toBe('test_source');
    expect(result.error?.message).toBe('비동기 실패');
  });
});
