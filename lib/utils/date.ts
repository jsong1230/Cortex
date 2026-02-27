// 날짜/시간 유틸리티 — KST 변환 및 포매팅

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9

/**
 * UTC Date → KST Date 변환
 */
export function toKST(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

/**
 * 오늘 날짜를 KST 기준 YYYY-MM-DD 형식으로 반환
 */
export function getTodayKST(): string {
  const now = toKST(new Date());
  return formatDate(now);
}

/**
 * Date → YYYY-MM-DD 형식 문자열
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 주말 여부 확인 (KST 기준)
 */
export function isWeekendKST(date: Date = new Date()): boolean {
  const kst = toKST(date);
  const day = kst.getDay(); // 0: 일, 6: 토
  return day === 0 || day === 6;
}

/**
 * 7일 후 만료 타임스탬프 생성 (keyword_contexts TTL용)
 */
export function getExpiresAt(days = 7): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires.toISOString();
}
