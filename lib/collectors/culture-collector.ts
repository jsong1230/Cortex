// CULTURE 채널 오케스트레이터 — 5개 소스 병렬 수집
// design.md F-03 섹션 5 참조

import type { ContentCollector, CollectorResult, CollectedItem, CollectorError } from './types';
import { safeCollect } from './utils';
import { collectNaverRealtime, collectNaverDatalabTrend } from './naver';
import { collectNetflixTop1 } from './netflix';
import { collectMelonChart } from './melon';
import { collectYouTubeTrendingTop2 } from './youtube';

/**
 * CULTURE 채널 수집기
 * 네이버 실검 + 데이터랩 + 넷플릭스 + 멜론 + 유튜브 5개 소스 병렬 실행
 */
export class CultureCollector implements ContentCollector {
  name = 'culture-collector';
  channel = 'culture' as const;

  async collect(): Promise<CollectorResult> {
    const errors: CollectorError[] = [];
    const allItems: CollectedItem[] = [];

    // 5개 소스 병렬 실행 (각각 독립 try/catch)
    const [realtime, datalab, netflix, melon, youtube] = await Promise.all([
      safeCollect('naver_realtime', () => collectNaverRealtime()),
      safeCollect('naver_datalab', () => collectNaverDatalabTrend()),
      safeCollect('netflix_kr', () => collectNetflixTop1()),
      safeCollect('melon', () => collectMelonChart()),
      safeCollect('youtube_trending', () => collectYouTubeTrendingTop2()),
    ]);

    // 결과 합산
    for (const result of [realtime, datalab, netflix, melon, youtube]) {
      allItems.push(...result.items);
      if (result.error) errors.push(result.error);
    }

    return { channel: 'culture', items: allItems, errors };
  }
}

/**
 * CultureCollector 팩토리 함수 (테스트 모킹 친화적 패턴)
 */
export function createCultureCollector(): ContentCollector {
  return new CultureCollector();
}
