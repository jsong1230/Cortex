// 토론토 뉴스 필터링 유틸리티
// 토론토/온타리오 관련 키워드 기사 우선 정렬

import type { CollectedItem } from './types';

const TORONTO_KEYWORDS = ['toronto', 'ontario', 'ttc', 'gta', 'york region'];

/**
 * 토론토 로컬 뉴스 필터링
 * CollectedItem 배열에서 Toronto 관련 기사 우선 정렬 후 limit개 반환
 */
export function filterTorontoNews(
  items: CollectedItem[],
  limit = 5
): CollectedItem[] {
  const scored = items.map((item) => {
    const titleLower = item.title.toLowerCase();
    const isTorontoSpecific = TORONTO_KEYWORDS.some((kw) =>
      titleLower.includes(kw)
    );
    return { item, score: isTorontoSpecific ? 1 : 0 };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}
