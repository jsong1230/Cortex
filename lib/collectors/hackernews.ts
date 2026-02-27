// Hacker News 수집기 — Firebase REST API
// https://hacker-news.firebaseio.com/v0/topstories.json

import type { CollectedItem } from './types';

const HN_BASE = 'https://hacker-news.firebaseio.com/v0';
const TOP_STORIES_LIMIT = 50;
const SELECT_LIMIT = 10;

interface HNItem {
  id: number;
  title?: string;
  url?: string;  // url 없으면 HN 토론 페이지
  score: number;
  by: string;
  time: number;
  descendants?: number;  // 댓글 수
}

/**
 * HN Top Stories 수집 (상위 TOP_STORIES_LIMIT개 중 SELECT_LIMIT개 선별)
 */
export async function collectHackerNews(): Promise<CollectedItem[]> {
  // 1. Top Story ID 목록 조회
  const idsResponse = await fetch(`${HN_BASE}/topstories.json`);
  if (!idsResponse.ok) {
    throw new Error(`HN top stories 조회 실패: ${idsResponse.status}`);
  }

  const allIds: number[] = await idsResponse.json();
  const targetIds = allIds.slice(0, TOP_STORIES_LIMIT);

  // 2. 개별 아이템 배치 조회 (10개씩 5배치, 동시 연결 과부하 방지)
  async function fetchInBatches<T>(
    items: T[],
    batchSize: number,
    fn: (item: T) => Promise<HNItem>
  ): Promise<PromiseSettledResult<HNItem>[]> {
    const results: PromiseSettledResult<HNItem>[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  }

  const results = await fetchInBatches(
    targetIds,
    10,
    (id) => fetch(`${HN_BASE}/item/${id}.json`).then((r) => r.json() as Promise<HNItem>)
  );
  const validItems = results
    .filter((r): r is PromiseFulfilledResult<HNItem> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((item): item is HNItem & { title: string } => Boolean(item && item.title && (item.url || item.id)));

  // 3. 점수 기준 정렬 후 상위 SELECT_LIMIT개 반환
  const sorted = validItems
    .sort((a, b) => b.score - a.score)
    .slice(0, SELECT_LIMIT);

  return sorted.map((item) => ({
    channel: 'tech' as const,
    source: 'hackernews',
    source_url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
    title: item.title,
    published_at: new Date(item.time * 1000),
  }));
}
