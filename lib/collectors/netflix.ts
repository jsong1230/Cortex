// 넷플릭스 한국 TOP 10 수집기 — HTML 파싱 (cheerio)
// 주의: 파싱 안정성 낮음, HTML 구조 변경 잦음

import * as cheerio from 'cheerio';
import type { CollectedItem } from './types';

const NETFLIX_TOP10_URL = 'https://www.netflix.com/tudum/top10';

/**
 * 넷플릭스 한국 TOP 10에서 1위 콘텐츠 수집
 * 파싱 실패 시 빈 배열 반환 (safeCollect로 감싸서 사용)
 */
export async function collectNetflixTop1(): Promise<CollectedItem[]> {
  const response = await fetch(NETFLIX_TOP10_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`넷플릭스 TOP 10 조회 실패: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // 넷플릭스 1위 콘텐츠 파싱 (다양한 셀렉터 시도)
  const titleEl = $(
    '.top-10-rank-number-one .title, ' +
    '.top10-title:first, ' +
    '[data-rank="1"] .show-title, ' +
    '.top-10-list li:first-child .title-treatment, ' +
    'h3.title:first'
  ).first();

  const title = titleEl.text().trim();

  if (!title) {
    // HTML 구조 변경으로 파싱 실패 시 빈 배열 반환
    return [];
  }

  const contentUrl = titleEl.closest('a').attr('href');
  const fullUrl = contentUrl
    ? contentUrl.startsWith('http')
      ? contentUrl
      : `https://www.netflix.com${contentUrl}`
    : NETFLIX_TOP10_URL;

  return [{
    channel: 'culture',
    source: 'netflix_kr',
    source_url: fullUrl,
    title: `[넷플릭스 1위] ${title}`,
    tags: ['netflix', 'streaming'],
    published_at: new Date(),
  }];
}
