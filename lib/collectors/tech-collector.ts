// TECH 채널 오케스트레이터 — HN + GitHub + RSS 3소스 병렬 수집
// design.md 섹션 5.1 참조

import type { ContentCollector, CollectorResult, CollectedItem, CollectorError } from './types';
import { safeCollect } from './utils';
import { collectHackerNews } from './hackernews';
import { collectGitHubTrending } from './github';
import { collectMultipleRssFeeds, rssItemToCollectedItem } from './rss';
import type { RssFeedConfig } from './rss';

// TECH 채널 전용 RSS 피드 설정 (사용자가 직접 추가하는 RSS)
const TECH_RSS_FEEDS: RssFeedConfig[] = [
  // 초기에는 비어 있음 — 사용자가 F-20(설정 페이지) 구현 후 추가
];

/**
 * TECH RSS 피드 수집 (CollectedItem[] 반환)
 * TECH_RSS_FEEDS가 비어있으면 빈 배열 반환
 */
async function collectTechRssFeeds(): Promise<CollectedItem[]> {
  const rssItems = await collectMultipleRssFeeds(TECH_RSS_FEEDS);
  return rssItems.map(rssItemToCollectedItem);
}

/**
 * TECH 채널 수집기
 * HN + GitHub Trending + 사용자 RSS 3개 소스 병렬 실행
 */
export class TechCollector implements ContentCollector {
  name = 'tech-collector';
  channel = 'tech' as const;

  async collect(): Promise<CollectorResult> {
    const errors: CollectorError[] = [];
    const allItems: CollectedItem[] = [];

    // 3개 소스 병렬 실행 (각각 독립 try/catch)
    const [hn, github, rss] = await Promise.all([
      safeCollect('hackernews', () => collectHackerNews()),
      safeCollect('github_trending', () => collectGitHubTrending()),
      safeCollect('rss_tech', () => collectTechRssFeeds()),
    ]);

    // 결과 합산
    allItems.push(...hn.items, ...github.items, ...rss.items);
    if (hn.error) errors.push(hn.error);
    if (github.error) errors.push(github.error);
    if (rss.error) errors.push(rss.error);

    return { channel: 'tech', items: allItems, errors };
  }
}

/**
 * TechCollector 팩토리 함수 (테스트 모킹 친화적 패턴)
 */
export function createTechCollector(): ContentCollector {
  return new TechCollector();
}
