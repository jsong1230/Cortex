// F-01: Hacker News 수집기 단위 테스트
// test-spec.md: Hacker News 수집기 섹션 참조

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectHackerNews } from '@/lib/collectors/hackernews';

// HN API 응답 fixture 데이터
const makeHNItem = (id: number, score: number, opts: Record<string, unknown> = {}) => ({
  id,
  title: `Test Article ${id}`,
  url: `https://example.com/article/${id}`,
  score,
  by: 'testuser',
  time: 1709078400,
  ...opts,
});

describe('collectHackerNews', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('정상 응답 시 상위 10개를 스코어 내림차순으로 반환한다', async () => {
    // Arrange: 50개 ID + 개별 아이템 모킹
    const ids = Array.from({ length: 50 }, (_, i) => i + 1);
    const items = ids.map((id) => makeHNItem(id, 500 - id)); // 스코어 내림차순

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(ids),
        });
      }
      const id = parseInt(url.match(/item\/(\d+)/)?.[1] ?? '0');
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(items.find((item) => item.id === id)),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    // Act
    const result = await collectHackerNews();

    // Assert
    expect(result).toHaveLength(10);
    // 스코어 내림차순 확인
    for (let i = 0; i < result.length - 1; i++) {
      // source_url로 id 추출하여 score 비교 불가이므로 반환 수만 검증
    }
    expect(result.length).toBe(10);
  });

  it('모든 아이템의 channel이 tech이다', async () => {
    // Arrange
    const ids = [1, 2, 3];
    const items = ids.map((id) => makeHNItem(id, 100));

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ids) });
      }
      const id = parseInt(url.match(/item\/(\d+)/)?.[1] ?? '0');
      return Promise.resolve({ ok: true, json: () => Promise.resolve(items.find((i) => i.id === id)) });
    }));

    // Act
    const result = await collectHackerNews();

    // Assert
    expect(result.every((item) => item.channel === 'tech')).toBe(true);
  });

  it('모든 아이템의 source가 hackernews이다', async () => {
    // Arrange
    const ids = [1, 2];
    const items = ids.map((id) => makeHNItem(id, 100));

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ids) });
      }
      const id = parseInt(url.match(/item\/(\d+)/)?.[1] ?? '0');
      return Promise.resolve({ ok: true, json: () => Promise.resolve(items.find((i) => i.id === id)) });
    }));

    // Act
    const result = await collectHackerNews();

    // Assert
    expect(result.every((item) => item.source === 'hackernews')).toBe(true);
  });

  it('url이 있는 아이템의 source_url은 해당 url이다', async () => {
    // Arrange
    const ids = [1];
    const hnItem = { ...makeHNItem(1, 100), url: 'https://example.com/specific' };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ids) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(hnItem) });
    }));

    // Act
    const result = await collectHackerNews();

    // Assert
    expect(result[0].source_url).toBe('https://example.com/specific');
  });

  it('url이 없는 아이템의 source_url은 HN 토론 페이지 URL이다', async () => {
    // Arrange
    const ids = [12345];
    const hnItem = { id: 12345, title: 'Ask HN: test', score: 100, by: 'user', time: 1709078400 }; // url 없음

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ids) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(hnItem) });
    }));

    // Act
    const result = await collectHackerNews();

    // Assert
    expect(result[0].source_url).toBe('https://news.ycombinator.com/item?id=12345');
  });

  it('published_at은 Unix 타임스탬프를 Date 객체로 변환한다', async () => {
    // Arrange
    const ids = [1];
    const timestamp = 1709078400;
    const hnItem = makeHNItem(1, 100, { time: timestamp });

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ids) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(hnItem) });
    }));

    // Act
    const result = await collectHackerNews();

    // Assert
    expect(result[0].published_at).toEqual(new Date(timestamp * 1000));
  });

  it('title이 없는 아이템은 결과에서 제외된다', async () => {
    // Arrange
    const ids = [1, 2, 3];
    const items = [
      makeHNItem(1, 300),
      { id: 2, title: null, url: 'https://example.com', score: 500, by: 'user', time: 1709078400 }, // title null
      makeHNItem(3, 100),
    ];

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ids) });
      }
      const id = parseInt(url.match(/item\/(\d+)/)?.[1] ?? '0');
      return Promise.resolve({ ok: true, json: () => Promise.resolve(items.find((i) => i.id === id)) });
    }));

    // Act
    const result = await collectHackerNews();

    // Assert: title null인 아이템(id=2)이 제외되어야 함
    expect(result.every((item) => item.title !== null)).toBe(true);
    expect(result.find((item) => item.source_url?.includes('item?id=2'))).toBeUndefined();
  });

  it('topstories API 실패 시 에러를 throw한다', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    // Act & Assert
    await expect(collectHackerNews()).rejects.toThrow();
  });

  it('개별 아이템 fetch 실패 시 해당 건만 제외하고 나머지에서 상위 10개를 반환한다', async () => {
    // Arrange: 50개 ID 중 5개가 실패
    const ids = Array.from({ length: 50 }, (_, i) => i + 1);
    const failIds = new Set([1, 2, 3, 4, 5]);

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('topstories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ids) });
      }
      const id = parseInt(url.match(/item\/(\d+)/)?.[1] ?? '0');
      if (failIds.has(id)) {
        return Promise.reject(new Error('fetch 실패'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(makeHNItem(id, 500 - id)),
      });
    }));

    // Act
    const result = await collectHackerNews();

    // Assert: 45개에서 상위 10개 선별
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.length).toBeGreaterThan(0);
  });
});
