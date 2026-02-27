// 멜론 실시간 차트 수집기 — HTML 파싱 (cheerio)
// 주의: User-Agent 필수, UI 변경 시 파싱 깨짐

import * as cheerio from 'cheerio';
import type { CollectedItem } from './types';

const MELON_CHART_URL = 'https://www.melon.com/chart/index.htm';
const CHART_LIMIT = 5;

/**
 * 멜론 실시간 차트 TOP 5 수집
 */
export async function collectMelonChart(): Promise<CollectedItem[]> {
  const response = await fetch(MELON_CHART_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.melon.com/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`멜론 차트 조회 실패: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const today = new Date().toISOString().slice(0, 10);

  const items: CollectedItem[] = [];

  // 멜론 차트 파싱 (tr.lst50, tr.lst100 또는 .lst_wrap .list_wrap tbody tr)
  $('tr.lst50, tr.lst100, .lst_wrap tbody tr, .wrap_song_info').each((index, el) => {
    if (index >= CHART_LIMIT) return false;

    const rank = index + 1;
    const songId = $(el).find('.btn_icon_detail').attr('data-song-no') ||
                   $(el).find('[data-song-no]').attr('data-song-no') ||
                   $(el).find('input[name="input_song_id"]').attr('value') ||
                   String(index + 1);

    const songName = $(el).find('.rank01 span a, .ellipsis.rank01 a, .rank01 a').text().trim() ||
                     $(el).find('.song_name').text().trim();
    const artistName = $(el).find('.rank02 a, .ellipsis.rank02 a, .rank02 span').first().text().trim() ||
                       $(el).find('.artist_name').text().trim();

    if (!songName || !artistName) return;

    items.push({
      channel: 'culture',
      source: 'melon',
      source_url: `https://www.melon.com/song/detail.htm?songId=${songId}&date=${today}`,
      title: `${rank}. ${artistName} - ${songName}`,
      tags: ['music', 'melon'],
      published_at: new Date(),
    });
  });

  return items;
}
