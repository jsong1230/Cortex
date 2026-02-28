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

/**
 * 타임아웃 + 재시도 fetch 래퍼
 * - 429 응답 시 Retry-After 헤더를 존중
 * - 지수 백오프 (1초, 2초)
 * - AbortController 기반 타임아웃
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeout?: number } = {},
  maxRetries = 2,
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : (attempt + 1) * 1000;
        await sleep(Math.min(waitMs, 5000));
        continue;
      }

      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // 타임아웃 또는 네트워크 에러 → 백오프 후 재시도
      await sleep((attempt + 1) * 1000);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`fetchWithRetry: ${maxRetries}회 재시도 실패 (${url})`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
