// F-01: RSS 수집기 단위 테스트
// test-spec.md: RSS 수집기 섹션 참조

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted()로 mock spy를 팩토리 호이스팅 전에 초기화
const parseURLSpy = vi.hoisted(() => vi.fn());

// rss-parser mock: class 형태로 제공 (rss.ts에서 new Parser()로 사용)
vi.mock('rss-parser', () => {
  return {
    default: class MockParser {
      constructor(_opts?: unknown) {}
      parseURL = parseURLSpy;
    },
  };
});

import { collectRssFeed, collectMultipleRssFeeds } from '@/lib/collectors/rss';
import type { RssFeedConfig } from '@/lib/collectors/rss';

// feed items fixture 생성 헬퍼
function makeFeedItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Test Article ${i + 1}`,
    link: `https://example.com/article/${i + 1}`,
    contentSnippet: `Content snippet ${i + 1}`,
    pubDate: 'Mon, 28 Feb 2026 09:00:00 +0900',
  }));
}

describe('collectRssFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('정상 RSS 파싱 시 RssCollectedItem 배열을 반환한다', async () => {
    // Arrange
    parseURLSpy.mockResolvedValue({ items: makeFeedItems(10) });

    const config: RssFeedConfig = {
      url: 'https://example.com/feed',
      source: 'test_source',
      channel: 'tech',
    };

    // Act
    const result = await collectRssFeed(config);

    // Assert
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('limit 옵션 적용 시 지정된 수만큼만 반환한다', async () => {
    // Arrange
    parseURLSpy.mockResolvedValue({ items: makeFeedItems(20) });

    const config: RssFeedConfig = {
      url: 'https://example.com/feed',
      source: 'test_source',
      channel: 'tech',
      limit: 5,
    };

    // Act
    const result = await collectRssFeed(config);

    // Assert
    expect(result).toHaveLength(5);
  });

  it('link가 없는 아이템은 결과에서 제외된다', async () => {
    // Arrange
    parseURLSpy.mockResolvedValue({
      items: [
        { title: 'Valid Article', link: 'https://example.com/1', contentSnippet: 'content' },
        { title: 'No Link Article', link: undefined, contentSnippet: 'content' },
        { title: 'Another Valid', link: 'https://example.com/3', contentSnippet: 'content' },
      ],
    });

    const config: RssFeedConfig = {
      url: 'https://example.com/feed',
      source: 'test_source',
      channel: 'world',
    };

    // Act
    const result = await collectRssFeed(config);

    // Assert: link 없는 아이템 제외
    expect(result).toHaveLength(2);
  });

  it('pubDate가 있는 아이템의 publishedAt은 유효한 Date 객체이다', async () => {
    // Arrange
    parseURLSpy.mockResolvedValue({
      items: [{ title: 'Test', link: 'https://example.com', pubDate: 'Mon, 28 Feb 2026 09:00:00 +0900' }],
    });

    const config: RssFeedConfig = {
      url: 'https://example.com/feed',
      source: 'test_source',
      channel: 'world',
    };

    // Act
    const result = await collectRssFeed(config);

    // Assert
    expect(result[0].publishedAt).toBeInstanceOf(Date);
    expect(isNaN(result[0].publishedAt!.getTime())).toBe(false);
  });

  it('pubDate가 없는 아이템의 publishedAt은 undefined이다', async () => {
    // Arrange
    parseURLSpy.mockResolvedValue({
      items: [{ title: 'Test', link: 'https://example.com' }],
    });

    const config: RssFeedConfig = {
      url: 'https://example.com/feed',
      source: 'test_source',
      channel: 'world',
    };

    // Act
    const result = await collectRssFeed(config);

    // Assert
    expect(result[0].publishedAt).toBeUndefined();
  });
});

describe('collectMultipleRssFeeds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('3개 피드 모두 성공 시 합산된 아이템을 반환한다', async () => {
    // Arrange: 각 호출마다 5개 아이템 반환
    parseURLSpy.mockResolvedValue({ items: makeFeedItems(5) });

    const configs: RssFeedConfig[] = [
      { url: 'https://feed1.com', source: 'source1', channel: 'world' },
      { url: 'https://feed2.com', source: 'source2', channel: 'world' },
      { url: 'https://feed3.com', source: 'source3', channel: 'world' },
    ];

    // Act
    const result = await collectMultipleRssFeeds(configs);

    // Assert: 3개 피드 * 5개 아이템 = 15개
    expect(result.length).toBe(15);
  });

  it('일부 피드 실패 시 성공한 피드 데이터만 반환하고 console.error를 호출한다', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let callCount = 0;
    parseURLSpy.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.reject(new Error('피드 실패'));
      }
      return Promise.resolve({ items: makeFeedItems(5) });
    });

    const configs: RssFeedConfig[] = [
      { url: 'https://feed1.com', source: 'source1', channel: 'world' },
      { url: 'https://feed2.com', source: 'source2', channel: 'world' },
      { url: 'https://feed3.com', source: 'source3', channel: 'world' },
    ];

    // Act
    const result = await collectMultipleRssFeeds(configs);

    // Assert: 성공 2개 피드 * 5개 = 10개
    expect(result.length).toBe(10);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('모든 피드 실패 시 빈 배열을 반환하고 console.error를 3회 호출한다', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    parseURLSpy.mockRejectedValue(new Error('피드 실패'));

    const configs: RssFeedConfig[] = [
      { url: 'https://feed1.com', source: 'source1', channel: 'world' },
      { url: 'https://feed2.com', source: 'source2', channel: 'world' },
      { url: 'https://feed3.com', source: 'source3', channel: 'world' },
    ];

    // Act
    const result = await collectMultipleRssFeeds(configs);

    // Assert
    expect(result).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledTimes(3);
    consoleSpy.mockRestore();
  });
});
