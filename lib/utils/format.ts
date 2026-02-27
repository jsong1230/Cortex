// 브리핑 텍스트 포매팅 유틸리티
// 텔레그램 HTML 형식으로 브리핑 메시지 생성

// 채널별 이모지
const CHANNEL_EMOJI: Record<string, string> = {
  tech: '🖥️',
  world: '🌍',
  culture: '🎬',
  canada: '🍁',
  serendipity: '🎲',
};

// 채널별 한국어 레이블
const CHANNEL_LABEL: Record<string, string> = {
  tech: 'TECH',
  world: 'WORLD',
  culture: 'CULTURE',
  canada: 'TORONTO',
  serendipity: '세렌디피티',
};

export interface BriefingItem {
  channel: string;
  title: string;
  summaryAi: string | null;
  source: string;
  sourceUrl: string;
  reason?: string | null;  // My Life OS 컨텍스트 연결 이유
}

/**
 * 채널 헤더 생성
 */
export function formatChannelHeader(channel: string): string {
  const emoji = CHANNEL_EMOJI[channel] ?? '📌';
  const label = CHANNEL_LABEL[channel] ?? channel.toUpperCase();
  return `${emoji} <b>${label}</b>`;
}

/**
 * 브리핑 아이템 텍스트 생성 (텔레그램 HTML 형식)
 */
export function formatBriefingItem(item: BriefingItem, index: number): string {
  const summary = item.summaryAi ?? item.title;
  const reasonText = item.reason ? `\n💡 <i>${item.reason}</i>` : '';

  return (
    `${index}. <b>${item.title}</b>\n` +
    `${summary}${reasonText}\n` +
    `<a href="${item.sourceUrl}">${item.source}</a>`
  );
}

/**
 * 날짜 헤더 생성 (평일/주말 구분)
 */
export function formatDateHeader(date: string, isWeekend: boolean): string {
  const prefix = isWeekend ? '주말 브리핑 ☕' : '오늘의 브리핑 ☀️';
  return `<b>${prefix} — ${date}</b>`;
}
