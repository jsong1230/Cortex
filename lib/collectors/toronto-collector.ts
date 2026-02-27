// TORONTO 채널 오케스트레이터 — Toronto Star + CBC + 날씨 3소스 병렬 수집
// design.md F-04 섹션 5 참조

import type { ContentCollector, CollectorResult, CollectedItem, CollectorError } from './types';
import { safeCollect } from './utils';
import { collectRssFeed } from './rss';
import type { RssFeedConfig, RssCollectedItem } from './rss';
import { filterTorontoNews } from './toronto-news';
import { getTorontoWeather } from './weather';

const TORONTO_RSS_FEEDS: RssFeedConfig[] = [
  { url: 'https://www.thestar.com/feeds', source: 'toronto_star', channel: 'canada', limit: 30 },
  { url: 'https://www.cbc.ca/cmlink/rss-canada', source: 'cbc_canada', channel: 'canada', limit: 30 },
];

const TORONTO_KEYWORDS = ['toronto', 'ontario', 'ttc', 'gta', 'york region'];

/**
 * TORONTO 채널 수집기
 * Toronto Star RSS + CBC Canada RSS + OpenWeatherMap 3개 소스 병렬 실행
 */
export class TorontoCollector implements ContentCollector {
  name = 'toronto-collector';
  channel = 'canada' as const;

  async collect(): Promise<CollectorResult> {
    const errors: CollectorError[] = [];
    const allItems: CollectedItem[] = [];

    // 3개 소스 병렬 실행 (각각 독립 try/catch)
    const [torontoStar, cbc, weather] = await Promise.all([
      safeCollect('toronto_star', () => this.collectTorontoStar()),
      safeCollect('cbc_canada', () => this.collectCBC()),
      safeCollect('weather_toronto', () => this.collectWeather()),
    ]);

    // 결과 합산
    for (const result of [torontoStar, cbc, weather]) {
      allItems.push(...result.items);
      if (result.error) errors.push(result.error);
    }

    return { channel: 'canada', items: allItems, errors };
  }

  /** Toronto Star RSS -> 토론토 키워드 필터 -> 상위 2개 */
  private async collectTorontoStar(): Promise<CollectedItem[]> {
    const rssItems = await collectRssFeed(TORONTO_RSS_FEEDS[0]);
    const mapped = rssItems.map((item) => this.rssToCollectedItem(item, 'toronto_star'));
    const filtered = filterTorontoNews(mapped, 2);
    return filtered.map((item) => ({
      ...item,
      tags: this.inferTags(item.title),
    }));
  }

  /** CBC Canada RSS -> 토론토 키워드 필터 -> 상위 2개 */
  private async collectCBC(): Promise<CollectedItem[]> {
    const rssItems = await collectRssFeed(TORONTO_RSS_FEEDS[1]);
    const mapped = rssItems.map((item) => this.rssToCollectedItem(item, 'cbc_canada'));
    const filtered = filterTorontoNews(mapped, 2);
    return filtered.map((item) => ({
      ...item,
      tags: this.inferTags(item.title),
    }));
  }

  /** 토론토 날씨 -> CollectedItem 변환 */
  private async collectWeather(): Promise<CollectedItem[]> {
    const weather = await getTorontoWeather();
    // 로컬 시간 기준 날짜 (YYYY-MM-DD)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return [{
      channel: 'canada',
      source: 'weather_toronto',
      source_url: `https://openweathermap.org/city/6167865?date=${today}`,
      title: `[토론토 날씨] ${weather.conditionKr} ${weather.temperature}C (체감 ${weather.feelsLike}C)`,
      full_text: `${weather.conditionKr} | ${weather.temperature}°C (최고 ${weather.tempMax}°C / 최저 ${weather.tempMin}°C) | 습도 ${weather.humidity}% | 풍속 ${weather.windSpeed}m/s`,
      published_at: new Date(),
      tags: ['weather', 'toronto'],
    }];
  }

  /** RSS 아이템 -> CollectedItem 변환 */
  private rssToCollectedItem(rssItem: RssCollectedItem, source: string): CollectedItem {
    return {
      channel: 'canada',
      source,
      source_url: rssItem.sourceUrl,
      title: rssItem.title,
      full_text: rssItem.fullText,
      published_at: rssItem.publishedAt,
    };
  }

  /** 제목 기반 태그 추론 */
  private inferTags(title: string): string[] {
    const lower = title.toLowerCase();
    const isTorontoSpecific = TORONTO_KEYWORDS.some((kw) => lower.includes(kw));
    return isTorontoSpecific ? ['toronto'] : ['canada'];
  }
}

/**
 * TorontoCollector 팩토리 함수 (테스트 모킹 친화적 패턴)
 */
export function createTorontoCollector(): ContentCollector {
  return new TorontoCollector();
}
