// 범용 RSS 파서 — rss-parser 라이브러리 활용
// 네이버, 다음, 연합뉴스, BBC Korea, Toronto Star, CBC 등 RSS 피드 공통 처리

import Parser from 'rss-parser';
import type { CollectedItem, Channel } from './types';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Cortex-Bot/1.0 (Personal AI Briefing)',
  },
});

export type RssChannel = Channel;

/** RSS 수집 내부 형식 (테스트 호환성 유지) */
export interface RssCollectedItem {
  channel: RssChannel;
  source: string;
  sourceUrl: string;
  title: string;
  fullText?: string;
  publishedAt?: Date;
}

export interface RssFeedConfig {
  url: string;
  source: string;
  channel: RssChannel;
  limit?: number;  // 기본 20건
}

/**
 * RssCollectedItem -> CollectedItem 변환
 */
export function rssItemToCollectedItem(rssItem: RssCollectedItem): CollectedItem {
  return {
    channel: rssItem.channel,
    source: rssItem.source,
    source_url: rssItem.sourceUrl,
    title: rssItem.title,
    full_text: rssItem.fullText,
    published_at: rssItem.publishedAt,
  };
}

/**
 * RSS 피드 단일 수집 (최대 2회 재시도, 지수 백오프)
 */
export async function collectRssFeed(
  config: RssFeedConfig
): Promise<RssCollectedItem[]> {
  const limit = config.limit ?? 20;
  const maxRetries = 2;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const feed = await parser.parseURL(config.url);
      const items = feed.items.slice(0, limit);

      return items
        .filter((item) => item.link && item.title)
        .map((item) => ({
          channel: config.channel,
          source: config.source,
          sourceUrl: item.link!,
          title: item.title!,
          fullText: item.contentSnippet ?? item.content,
          publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        }));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
      }
    }
  }

  throw lastError ?? new Error(`RSS 수집 실패: ${config.source}`);
}

/**
 * 여러 RSS 피드 병렬 수집 (개별 실패 허용)
 */
export async function collectMultipleRssFeeds(
  configs: RssFeedConfig[]
): Promise<RssCollectedItem[]> {
  const results = await Promise.allSettled(
    configs.map((config) => collectRssFeed(config))
  );

  const collected: RssCollectedItem[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      collected.push(...result.value);
    } else {
      // 개별 피드 실패는 전체 파이프라인을 중단하지 않음
      console.error(`RSS 수집 실패 [${configs[index].source}]: ${result.reason?.message ?? 'Unknown error'}`);
    }
  });

  return collected;
}

