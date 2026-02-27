// WORLD 채널 오케스트레이터 — 네이버/다음/연합뉴스/BBC Korea 7개 RSS 병렬 수집
// design.md 섹션 6 참조

import type { ContentCollector, CollectorResult, CollectedItem, CollectorError } from './types';
import { safeCollect } from './utils';
import { collectMultipleRssFeeds } from './rss';
import type { RssFeedConfig } from './rss';

const WORLD_RSS_FEEDS: RssFeedConfig[] = [
  { url: 'https://news.naver.com/main/rss/politics.nhn', source: 'naver_politics', channel: 'world', limit: 20 },
  { url: 'https://news.naver.com/main/rss/economy.nhn', source: 'naver_economy', channel: 'world', limit: 20 },
  { url: 'https://news.naver.com/main/rss/society.nhn', source: 'naver_society', channel: 'world', limit: 20 },
  { url: 'https://news.naver.com/main/rss/it.nhn', source: 'naver_it', channel: 'world', limit: 20 },
  { url: 'https://news.daum.net/rss', source: 'daum_news', channel: 'world', limit: 50 },
  { url: 'https://www.yonhapnewstv.co.kr/browse/feed/', source: 'yonhap', channel: 'world', limit: 100 },
  { url: 'https://feeds.bbci.co.uk/korean/rss.xml', source: 'bbc_korea', channel: 'world', limit: 30 },
];

export interface ScoredItem {
  item: CollectedItem;
  crossSourceScore: number;  // 교차 소스 등장 횟수 기반 점수
}

/** 소스명 -> 카테고리 태그 추출 (테스트용 export) */
export function extractCategoryTag(source: string): string[] {
  const categoryMap: Record<string, string> = {
    naver_politics: 'politics',
    naver_economy: 'economy',
    naver_society: 'society',
    naver_it: 'it_science',
    daum_news: 'general',
    yonhap: 'general',
    bbc_korea: 'international',
  };
  const tag = categoryMap[source];
  return tag ? [tag] : [];
}

/**
 * 한국어/영어 불용어 제거 후 키워드 추출
 */
function extractKeywords(title: string): Set<string> {
  const koStopWords = new Set(['의', '를', '이', '가', '은', '는', '에', '도', '로', '과', '와', '을', '한', '그', '등', '및', '에서', '으로', '부터', '까지', '이며', '이고', '이나', '에도']);
  const enStopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'with', 'by', 'from']);

  const words = title
    .toLowerCase()
    .replace(/[^\w\sㄱ-힣]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !koStopWords.has(w) && !enStopWords.has(w));

  return new Set(words);
}

/**
 * 제목 기반 교차 소스 이슈 중복 가중치 계산
 * 동일 이슈가 여러 소스에서 반복 등장할수록 높은 점수
 */
export function scoreByCrossSourceAppearance(items: CollectedItem[]): ScoredItem[] {
  if (items.length === 0) return [];

  const keywordSets = items.map((item) => extractKeywords(item.title));

  // 각 아이템의 교차 소스 점수 계산
  // 유사 제목(키워드 교집합 비율 > 0.5)을 가진 소스 수를 카운트
  const scores = items.map((item, i) => {
    const kw1 = keywordSets[i];
    if (kw1.size === 0) return 1;

    let matchedSources = new Set<string>([item.source]);

    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const kw2 = keywordSets[j];
      if (kw2.size === 0) continue;

      // 교집합 비율: 교집합 / 작은 집합 크기
      const intersection = new Set(Array.from(kw1).filter((w) => kw2.has(w)));
      const minSize = Math.min(kw1.size, kw2.size);
      const ratio = intersection.size / minSize;

      if (ratio > 0.5) {
        matchedSources.add(items[j].source);
      }
    }

    return matchedSources.size;
  });

  const scoredItems: ScoredItem[] = items.map((item, i) => ({
    item,
    crossSourceScore: scores[i],
  }));

  // 교차 소스 점수 내림차순 정렬, 동일 점수 시 최신순
  scoredItems.sort((a, b) => {
    if (b.crossSourceScore !== a.crossSourceScore) {
      return b.crossSourceScore - a.crossSourceScore;
    }
    const aTime = a.item.published_at?.getTime() ?? 0;
    const bTime = b.item.published_at?.getTime() ?? 0;
    return bTime - aTime;
  });

  return scoredItems;
}

/**
 * WORLD 채널 수집기
 * 7개 RSS 피드 병렬 수집 후 교차 소스 가중치 기반 상위 15개 선별
 */
export class WorldCollector implements ContentCollector {
  name = 'world-collector';
  channel = 'world' as const;

  async collect(): Promise<CollectorResult> {
    const errors: CollectorError[] = [];

    // 모든 RSS 피드 병렬 수집 후 CollectedItem으로 변환 (개별 실패 허용)
    const { items, error } = await safeCollect(
      'world_rss_all',
      async (): Promise<CollectedItem[]> => {
        const rssItems = await collectMultipleRssFeeds(WORLD_RSS_FEEDS);
        return rssItems.map((rssItem): CollectedItem => ({
          channel: 'world' as const,
          source: rssItem.source,
          source_url: rssItem.sourceUrl,
          title: rssItem.title,
          full_text: rssItem.fullText,
          published_at: rssItem.publishedAt,
          tags: extractCategoryTag(rssItem.source),
        }));
      }
    );

    if (error) errors.push(error);

    // 교차 소스 이슈 중복 가중치 적용 후 상위 15개 선별
    const scored = scoreByCrossSourceAppearance(items);
    const selected = scored.slice(0, 15).map((s) => s.item);

    return {
      channel: 'world',
      items: selected,
      errors,
    };
  }

}
