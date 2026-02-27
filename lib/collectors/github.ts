// GitHub Trending 수집기 — HTML 파싱 (cheerio)
// 주의: UI 변경 시 파싱 로직 깨질 수 있음

import * as cheerio from 'cheerio';
import type { CollectedItem } from './types';

const GITHUB_TRENDING_URL = 'https://github.com/trending?since=daily';
const TRENDING_LIMIT = 20;

/**
 * GitHub Trending 페이지 파싱
 * 오늘 트렌딩 리포지토리 목록 수집 (article.Box-row 셀렉터)
 */
export async function collectGitHubTrending(): Promise<CollectedItem[]> {
  const response = await fetch(GITHUB_TRENDING_URL, {
    headers: {
      'User-Agent': 'Cortex-Bot/1.0 (Personal AI Briefing)',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Trending 페이지 조회 실패: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];

  $('article.Box-row').each((index, el) => {
    if (index >= TRENDING_LIMIT) return false;

    const repoPath = $(el).find('h2 a').attr('href')?.trim();
    const description = $(el).find('p').text().trim();
    const language = $(el).find('[itemprop="programmingLanguage"]').text().trim();

    if (!repoPath) return;

    items.push({
      channel: 'tech',
      source: 'github_trending',
      source_url: `https://github.com${repoPath}`,
      title: `${repoPath.slice(1)}: ${description || '(설명 없음)'}`,
      full_text: [description, language].filter(Boolean).join(' | ') || undefined,
      published_at: new Date(),
      tags: language ? [language] : [],
    });
  });

  return items;
}
