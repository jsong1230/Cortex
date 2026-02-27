// YouTube Data API v3 — 한국 트렌딩 영상 수집
// GET https://www.googleapis.com/youtube/v3/videos

import type { CollectedItem } from './types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const TRENDING_TOP = 10;
const SELECT_LIMIT = 2;
const DESCRIPTION_MAX_LENGTH = 500;

/**
 * YouTube 트렌딩 영상 공통 수집 내부 함수
 */
async function fetchYouTubeTrending(limit: number): Promise<CollectedItem[]> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_DATA_API_KEY가 설정되지 않았습니다. 유튜브 수집을 건너뜁니다.');
    return [];
  }

  const params = new URLSearchParams({
    part: 'snippet,statistics',
    chart: 'mostPopular',
    regionCode: 'KR',
    maxResults: String(limit),
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
  if (!response.ok) {
    throw new Error(`YouTube API 호출 실패: ${response.status}`);
  }

  const data = await response.json();

  return (data.items ?? []).map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown>;
    const description = String(snippet.description ?? '');
    return {
      channel: 'culture' as const,
      source: 'youtube_trending',
      source_url: `https://www.youtube.com/watch?v=${item.id}`,
      title: String(snippet.title ?? ''),
      full_text: description.length > DESCRIPTION_MAX_LENGTH
        ? description.slice(0, DESCRIPTION_MAX_LENGTH)
        : description || undefined,
      published_at: new Date(snippet.publishedAt as string),
      tags: ['youtube'],
    };
  });
}

/**
 * 한국 유튜브 트렌딩 영상 상위 2개 수집
 * YOUTUBE_DATA_API_KEY 환경변수 필요
 */
export async function collectYouTubeTrendingTop2(): Promise<CollectedItem[]> {
  const items = await fetchYouTubeTrending(TRENDING_TOP);
  // API가 이미 인기순으로 반환하므로 상위 2개 슬라이스
  return items.slice(0, SELECT_LIMIT);
}

/** 하위 호환용 — 공통 내부 함수로 위임 */
export async function collectYouTubeTrending(limit = 10): Promise<CollectedItem[]> {
  return fetchYouTubeTrending(limit);
}
