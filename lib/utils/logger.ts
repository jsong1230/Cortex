// 구조화 로깅 표준 유틸
// Vercel Logs에서 event 필드로 검색 가능한 JSON 형식으로 출력

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogParams {
  event: string;
  level?: LogLevel;
  data?: Record<string, unknown>;
  error?: unknown;
}

/**
 * 구조화 로그 출력 (JSON 형식, Vercel Logs 검색 최적화)
 * - level 기본값: 'info'
 * - error 필드: Error 인스턴스면 { message, name }, 그 외는 문자열 변환
 */
export function log({ event, level = 'info', data, error }: LogParams): void {
  const payload: Record<string, unknown> = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };

  if (error !== undefined) {
    payload.error =
      error instanceof Error
        ? { message: error.message, name: error.name }
        : String(error);
  }

  const output = JSON.stringify(payload);

  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(output);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(output);
  } else {
    // eslint-disable-next-line no-console
    console.info(output);
  }
}
