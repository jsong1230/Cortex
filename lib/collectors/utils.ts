// 수집기 공통 유틸리티 — design.md 섹션 2.2 참조

import type { CollectorError, CollectedItem } from './types';

/**
 * 소스별 독립 try/catch 래퍼
 * 개별 소스 수집 실패 시 다른 소스에 영향 없이 에러만 기록한다
 */
export async function safeCollect(
  sourceName: string,
  fn: () => Promise<CollectedItem[]>
): Promise<{ items: CollectedItem[]; error?: CollectorError }> {
  try {
    const items = await fn();
    return { items };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      items: [],
      error: {
        source: sourceName,
        message,
        timestamp: new Date(),
      },
    };
  }
}
