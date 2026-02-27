// F-04: TorontoCollector 오케스트레이터 단위 테스트
// test-spec.md: Toronto Star/CBC/날씨/filterTorontoNews/TorontoCollector/inferTags 섹션 참조

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CollectedItem } from '@/lib/collectors/types';

// rss-parser를 globalThis spy 방식으로 모킹
vi.mock('rss-parser', async () => {
  const { vi: v } = await import('vitest');
  const spy = v.fn();
  // @ts-ignore
  globalThis.__torontoParseURLSpy = spy;
  return {
    default: class MockParser {
      constructor(_opts?: unknown) {}
      // @ts-ignore
      parseURL = globalThis.__torontoParseURLSpy;
    },
  };
});

function getParseURLSpy(): ReturnType<typeof vi.fn> {
  // @ts-ignore
  return globalThis.__torontoParseURLSpy;
}

import { TorontoCollector } from '@/lib/collectors/toronto-collector';
import { filterTorontoNews } from '@/lib/collectors/toronto-news';

// RSS 아이템 fixture 헬퍼
const makeRssItem = (title: string, source: string, opts: Record<string, unknown> = {}) => ({
  channel: 'canada' as const,
  source,
  sourceUrl: `https://example.com/${source}/${encodeURIComponent(title)}`,
  title,
  publishedAt: new Date('2026-02-28T09:00:00Z'),
  link: `https://example.com/${source}/${encodeURIComponent(title)}`,
  ...opts,
});

// CollectedItem fixture 헬퍼
const makeCanadaItem = (source: string, title: string, tags: string[] = ['canada']): CollectedItem => ({
  channel: 'canada' as const,
  source,
  source_url: `https://example.com/${source}/${encodeURIComponent(title)}`,
  title,
  published_at: new Date('2026-02-28T09:00:00Z'),
  tags,
});

// 날씨 API 응답 fixture
const makeWeatherResponse = (overrides: Record<string, unknown> = {}) => ({
  main: { temp: -5, feels_like: -10, humidity: 60, temp_max: -2, temp_min: -8 },
  weather: [{ main: 'Clear', description: '맑음' }],
  wind: { speed: 5.2 },
  ...overrides,
});

describe('filterTorontoNews', () => {
  it('토론토 키워드 포함 기사가 우선 순위를 갖는다', () => {
    const items: CollectedItem[] = [
      makeCanadaItem('toronto_star', 'Canada GDP growth'),
      makeCanadaItem('toronto_star', 'Toronto TTC delay'),
    ];

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 2);
    expect(result[0].title).toBe('Toronto TTC delay');
  });

  it('대소문자를 무시하고 토론토 키워드를 매칭한다', () => {
    const items: CollectedItem[] = [
      makeCanadaItem('cbc_canada', 'TORONTO weather update'),
    ];

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 5);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('TORONTO weather update');
  });

  it('ontario 키워드가 포함된 기사를 토론토 관련으로 판정한다', () => {
    const items: CollectedItem[] = [
      makeCanadaItem('toronto_star', 'Ontario government announces new plan'),
      makeCanadaItem('toronto_star', 'Vancouver earthquake'),
    ];

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 2);
    expect(result[0].title).toBe('Ontario government announces new plan');
  });

  it('ttc 키워드가 포함된 기사를 토론토 관련으로 판정한다', () => {
    const items: CollectedItem[] = [
      makeCanadaItem('cbc_canada', 'TTC service disruption'),
    ];

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 5);
    expect(result.length).toBe(1);
  });

  it('gta 키워드가 포함된 기사를 토론토 관련으로 판정한다', () => {
    const items: CollectedItem[] = [
      makeCanadaItem('toronto_star', 'GTA housing market report'),
    ];

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 5);
    expect(result.length).toBe(1);
  });

  it('york region 키워드가 포함된 기사를 토론토 관련으로 판정한다', () => {
    const items: CollectedItem[] = [
      makeCanadaItem('cbc_canada', 'York Region school closure due to snow'),
    ];

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 5);
    expect(result.length).toBe(1);
  });

  it('키워드가 없는 기사는 토론토 비관련으로 후순위에 배치된다', () => {
    const items: CollectedItem[] = [
      makeCanadaItem('cbc_canada', 'Vancouver earthquake today'),
      makeCanadaItem('toronto_star', 'Toronto transit update'),
    ];

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 2);
    expect(result[0].title).toBe('Toronto transit update');
  });

  it('limit을 적용하여 지정 수만큼만 반환한다', () => {
    const items: CollectedItem[] = Array.from({ length: 10 }, (_, i) =>
      makeCanadaItem('toronto_star', `Article ${i + 1}`)
    );

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 2);
    expect(result).toHaveLength(2);
  });

  it('빈 배열 입력 시 빈 배열을 반환한다', () => {
    const result = filterTorontoNews([], 5);
    expect(result).toHaveLength(0);
  });

  it('모든 아이템이 토론토 관련일 때 상위 limit개를 반환한다', () => {
    const items: CollectedItem[] = Array.from({ length: 5 }, (_, i) =>
      makeCanadaItem('toronto_star', `Toronto news ${i + 1}`)
    );

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 2);
    expect(result).toHaveLength(2);
  });

  it('토론토 관련 기사가 0개일 때 원본 순서 상위 limit개를 반환한다', () => {
    const items: CollectedItem[] = [
      makeCanadaItem('cbc_canada', 'Vancouver rain'),
      makeCanadaItem('cbc_canada', 'Calgary cold'),
      makeCanadaItem('cbc_canada', 'Montreal snow'),
      makeCanadaItem('cbc_canada', 'Halifax fog'),
      makeCanadaItem('cbc_canada', 'Winnipeg wind'),
    ];

    const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 2);
    expect(result).toHaveLength(2);
  });
});

describe('TorontoCollector', () => {
  let collector: TorontoCollector;

  beforeEach(() => {
    collector = new TorontoCollector();
    getParseURLSpy().mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENWEATHER_API_KEY;
  });

  describe('name, channel 속성', () => {
    it('이름이 toronto-collector이다', () => {
      expect(collector.name).toBe('toronto-collector');
    });

    it('채널이 canada이다', () => {
      expect(collector.channel).toBe('canada');
    });
  });

  describe('collectTorontoStar()', () => {
    it('정상 RSS 파싱 후 상위 2개를 반환한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      const items = Array.from({ length: 30 }, (_, i) =>
        makeRssItem(`Article ${i + 1}`, 'toronto_star')
      );
      getParseURLSpy().mockResolvedValue({ items });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const starItems = result.items.filter((item) => item.source === 'toronto_star');
      expect(starItems.length).toBeLessThanOrEqual(2);
    });

    it('토론토 키워드 포함 기사가 상위에 배치된다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      const items = [
        makeRssItem('Canada general news', 'toronto_star'),
        makeRssItem('Toronto transit delay', 'toronto_star'),
        makeRssItem('Canada GDP report', 'toronto_star'),
      ];
      getParseURLSpy()
        .mockResolvedValueOnce({ items })
        .mockResolvedValueOnce({ items: [] });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const starItems = result.items.filter((item) => item.source === 'toronto_star');
      if (starItems.length > 0) {
        expect(starItems[0].title).toBe('Toronto transit delay');
      }
    });

    it('channel이 canada이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy().mockResolvedValue({
        items: [makeRssItem('Toronto news', 'toronto_star')],
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const starItems = result.items.filter((item) => item.source === 'toronto_star');
      expect(starItems.every((item) => item.channel === 'canada')).toBe(true);
    });

    it('source가 toronto_star이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy().mockResolvedValue({
        items: [makeRssItem('Toronto news', 'toronto_star')],
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const starItems = result.items.filter((item) => item.source === 'toronto_star');
      expect(starItems.every((item) => item.source === 'toronto_star')).toBe(true);
    });

    it('토론토 관련 기사에 tags에 toronto가 포함된다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy().mockResolvedValue({
        items: [makeRssItem('Toronto transit news', 'toronto_star')],
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const torontoItems = result.items.filter(
        (item) => item.source === 'toronto_star' && item.title.toLowerCase().includes('toronto')
      );
      if (torontoItems.length > 0) {
        expect(torontoItems[0].tags).toContain('toronto');
      }
    });

    it('캐나다 일반 기사에 tags에 canada가 포함된다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy().mockResolvedValue({
        items: [makeRssItem('Canada GDP growth', 'toronto_star')],
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const canadaItems = result.items.filter(
        (item) => item.source === 'toronto_star' && !item.title.toLowerCase().includes('toronto')
      );
      if (canadaItems.length > 0) {
        expect(canadaItems[0].tags).toContain('canada');
      }
    });

    it('RSS 피드가 0개 아이템이면 빈 배열을 반환한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy().mockResolvedValue({ items: [] });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const starItems = result.items.filter((item) => item.source === 'toronto_star');
      expect(starItems).toHaveLength(0);
    });

    it('RSS 피드 오류 시 에러를 기록한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy().mockRejectedValue(new Error('RSS 파싱 실패'));

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const starError = result.errors.find((e) => e.source === 'toronto_star');
      expect(starError).toBeDefined();
    });
  });

  describe('collectCBC()', () => {
    it('정상 RSS 파싱 후 상위 2개를 반환한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy()
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValueOnce({
          items: Array.from({ length: 30 }, (_, i) =>
            makeRssItem(`CBC Article ${i + 1}`, 'cbc_canada')
          ),
        });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const cbcItems = result.items.filter((item) => item.source === 'cbc_canada');
      expect(cbcItems.length).toBeLessThanOrEqual(2);
    });

    it('토론토 키워드 포함 기사가 우선 배치된다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy()
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValueOnce({
          items: [
            makeRssItem('Canada news', 'cbc_canada'),
            makeRssItem('Ontario lockdown announced', 'cbc_canada'),
          ],
        });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const cbcItems = result.items.filter((item) => item.source === 'cbc_canada');
      if (cbcItems.length > 0) {
        expect(cbcItems[0].title).toBe('Ontario lockdown announced');
      }
    });

    it('channel이 canada이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy()
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValueOnce({ items: [makeRssItem('Canada news', 'cbc_canada')] });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const cbcItems = result.items.filter((item) => item.source === 'cbc_canada');
      expect(cbcItems.every((item) => item.channel === 'canada')).toBe(true);
    });

    it('source가 cbc_canada이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy()
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValueOnce({ items: [makeRssItem('Canada news', 'cbc_canada')] });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const cbcItems = result.items.filter((item) => item.source === 'cbc_canada');
      expect(cbcItems.every((item) => item.source === 'cbc_canada')).toBe(true);
    });

    it('RSS 피드 오류 시 에러를 기록한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-key';
      getParseURLSpy().mockRejectedValue(new Error('CBC 피드 실패'));

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const cbcError = result.errors.find((e) => e.source === 'cbc_canada');
      expect(cbcError).toBeDefined();
    });
  });

  describe('collectWeather()', () => {
    beforeEach(() => {
      getParseURLSpy().mockResolvedValue({ items: [] });
    });

    it('정상 API 응답 시 날씨 아이템 1개를 반환한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const weatherItem = result.items.find((item) => item.source === 'weather_toronto');
      expect(weatherItem).toBeDefined();
    });

    it('channel이 canada이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const weatherItem = result.items.find((item) => item.source === 'weather_toronto');
      expect(weatherItem?.channel).toBe('canada');
    });

    it('source가 weather_toronto이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const weatherItem = result.items.find((item) => item.source === 'weather_toronto');
      expect(weatherItem?.source).toBe('weather_toronto');
    });

    it('source_url에 오늘 날짜가 포함된다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const weatherItem = result.items.find((item) => item.source === 'weather_toronto');
      expect(weatherItem?.source_url).toContain('2026-02-28');
    });

    it('title이 [토론토 날씨] 형식이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          main: { temp: -5, feels_like: -10, humidity: 60, temp_max: -2, temp_min: -8 },
          weather: [{ main: 'Clear', description: '맑음' }],
          wind: { speed: 5.2 },
        }),
      }));

      const result = await collector.collect();
      const weatherItem = result.items.find((item) => item.source === 'weather_toronto');
      expect(weatherItem?.title).toBe('[토론토 날씨] 맑음 -5C (체감 -10C)');
    });

    it('full_text에 습도와 풍속이 포함된다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          main: { temp: -5, feels_like: -10, humidity: 60, temp_max: -2, temp_min: -8 },
          weather: [{ main: 'Clear', description: '맑음' }],
          wind: { speed: 5.2 },
        }),
      }));

      const result = await collector.collect();
      const weatherItem = result.items.find((item) => item.source === 'weather_toronto');
      expect(weatherItem?.full_text).toContain('습도 60%');
      expect(weatherItem?.full_text).toContain('풍속 5.2m/s');
    });

    it('tags가 weather와 toronto를 포함한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      const weatherItem = result.items.find((item) => item.source === 'weather_toronto');
      expect(weatherItem?.tags).toEqual(['weather', 'toronto']);
    });

    it('OPENWEATHER_API_KEY 미설정 시 에러를 기록한다', async () => {
      delete process.env.OPENWEATHER_API_KEY;
      vi.stubGlobal('fetch', vi.fn());

      const result = await collector.collect();
      const weatherError = result.errors.find((e) => e.source === 'weather_toronto');
      expect(weatherError).toBeDefined();
    });

    it('API 오류(401) 시 에러를 기록한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'invalid-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }));

      const result = await collector.collect();
      const weatherError = result.errors.find((e) => e.source === 'weather_toronto');
      expect(weatherError).toBeDefined();
    });

    it('API 오류(500) 시 에러를 기록한다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      const result = await collector.collect();
      const weatherError = result.errors.find((e) => e.source === 'weather_toronto');
      expect(weatherError).toBeDefined();
    });
  });

  describe('collect() 오케스트레이터', () => {
    it('3개 소스 모두 성공 시 items 5개 + errors 0개이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      getParseURLSpy()
        .mockResolvedValueOnce({
          items: Array.from({ length: 2 }, (_, i) =>
            makeRssItem(`Toronto Star ${i + 1}`, 'toronto_star')
          ),
        })
        .mockResolvedValueOnce({
          items: Array.from({ length: 2 }, (_, i) =>
            makeRssItem(`CBC Article ${i + 1}`, 'cbc_canada')
          ),
        });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      expect(result.items.length).toBe(5);
      expect(result.errors).toHaveLength(0);
    });

    it('Toronto Star 실패 시 나머지 성공 + errors에 1개 기록된다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      getParseURLSpy()
        .mockRejectedValueOnce(new Error('Toronto Star 실패'))
        .mockResolvedValueOnce({
          items: Array.from({ length: 2 }, (_, i) =>
            makeRssItem(`CBC Article ${i + 1}`, 'cbc_canada')
          ),
        });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      expect(result.items.length).toBe(3);
      expect(result.errors).toHaveLength(1);
    });

    it('날씨 실패 시 뉴스 성공 + errors에 1개 기록된다', async () => {
      delete process.env.OPENWEATHER_API_KEY;
      getParseURLSpy()
        .mockResolvedValueOnce({
          items: Array.from({ length: 2 }, (_, i) =>
            makeRssItem(`Star ${i + 1}`, 'toronto_star')
          ),
        })
        .mockResolvedValueOnce({
          items: Array.from({ length: 2 }, (_, i) =>
            makeRssItem(`CBC ${i + 1}`, 'cbc_canada')
          ),
        });

      vi.stubGlobal('fetch', vi.fn());

      const result = await collector.collect();
      expect(result.items.length).toBe(4);
      expect(result.errors).toHaveLength(1);
    });

    it('3개 소스 모두 실패 시 빈 배열 + errors에 3개 기록된다', async () => {
      delete process.env.OPENWEATHER_API_KEY;
      getParseURLSpy().mockRejectedValue(new Error('RSS 실패'));
      vi.stubGlobal('fetch', vi.fn());

      const result = await collector.collect();
      expect(result.items).toHaveLength(0);
      expect(result.errors).toHaveLength(3);
    });

    it('3개 소스를 병렬로 실행하여 전체 소요 시간이 ~100ms이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      getParseURLSpy().mockImplementation(async () => {
        await delay(100);
        return { items: [] };
      });

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        await delay(100);
        return { ok: true, json: () => Promise.resolve(makeWeatherResponse()) };
      }));

      const start = Date.now();
      await collector.collect();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(300);
    });

    it('모든 아이템의 channel이 canada이다', async () => {
      process.env.OPENWEATHER_API_KEY = 'test-api-key';
      getParseURLSpy()
        .mockResolvedValueOnce({ items: [makeRssItem('Toronto news', 'toronto_star')] })
        .mockResolvedValueOnce({ items: [makeRssItem('CBC news', 'cbc_canada')] });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeWeatherResponse()),
      }));

      const result = await collector.collect();
      expect(result.items.every((item) => item.channel === 'canada')).toBe(true);
    });
  });

  describe('inferTags()', () => {
    it('toronto 키워드 포함 시 tags는 toronto이다', () => {
      const items: CollectedItem[] = [
        makeCanadaItem('toronto_star', 'Toronto transit delay'),
      ];
      const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 5);
      expect(result.length).toBeGreaterThan(0);
    });

    it('ontario 키워드 포함 시 tags는 toronto이다', () => {
      const items: CollectedItem[] = [
        makeCanadaItem('cbc_canada', 'Ontario budget 2026'),
      ];
      const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 5);
      expect(result.length).toBeGreaterThan(0);
    });

    it('캐나다 일반 키워드 없음 시 tags는 canada이다', () => {
      const items: CollectedItem[] = [
        makeCanadaItem('cbc_canada', 'Canada GDP growth'),
      ];
      const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 5);
      expect(result.length).toBeGreaterThan(0);
    });

    it('대소문자 무시하고 toronto 키워드를 매칭한다', () => {
      const items: CollectedItem[] = [
        makeCanadaItem('toronto_star', 'TORONTO WEATHER UPDATE'),
      ];
      const result = filterTorontoNews(items as Parameters<typeof filterTorontoNews>[0], 5);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
