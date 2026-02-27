// 네이버 실시간 검색어 + 데이터랩 API 수집기
// design.md 섹션 2.1, 2.2 참조

import * as cheerio from 'cheerio';
import type { CollectedItem } from './types';

const NAVER_DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search';
const REALTIME_LIMIT = 5;
const DATALAB_LIMIT = 10;

/**
 * 네이버 실시간 급상승 검색어 수집 (HTML 파싱)
 * 파싱 실패 시 빈 배열 반환 (안정성 낮음)
 */
export async function collectNaverRealtime(): Promise<CollectedItem[]> {
  const response = await fetch('https://www.naver.com', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`네이버 실시간 검색어 조회 실패: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const today = new Date().toISOString().slice(0, 10);

  const items: CollectedItem[] = [];

  // 실시간 급상승 검색어 파싱 (네이버 메인 .PM_CL_realtimeKeyword_rolling 또는 .ah_roll_area)
  $('a.ah_a, .ah_roll_area a, .realtime_keyword a').each((index, el) => {
    if (index >= REALTIME_LIMIT) return false;

    const keyword = $(el).find('.ah_k, .txt').text().trim() || $(el).text().trim();
    if (!keyword) return;

    items.push({
      channel: 'culture',
      source: 'naver_realtime',
      source_url: `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&date=${today}`,
      title: keyword,
      tags: ['realtime_search'],
      published_at: new Date(),
    });
  });

  return items;
}

/**
 * 네이버 데이터랩 검색 트렌드 조회
 * NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수 필요
 */
export async function collectNaverDatalabTrend(): Promise<CollectedItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다. 데이터랩 수집을 건너뜁니다.');
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const body = {
    startDate: weekAgo,
    endDate: today,
    timeUnit: 'date',
    keywordGroups: [
      { groupName: '트렌드', keywords: ['AI', '드라마', '영화', '음악', '스포츠'] },
    ],
  };

  const response = await fetch(NAVER_DATALAB_URL, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`네이버 데이터랩 API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  const results = data.results ?? [];

  return results.slice(0, DATALAB_LIMIT).map((result: { title: string }) => ({
    channel: 'culture' as const,
    source: 'naver_datalab',
    source_url: `https://search.naver.com/search.naver?query=${encodeURIComponent(result.title)}&date=${today}`,
    title: result.title,
    tags: ['datalab', 'shopping_trend'],
    published_at: new Date(),
  }));
}
