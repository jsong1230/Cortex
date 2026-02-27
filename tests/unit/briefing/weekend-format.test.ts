// F-16 평일/주말 브리핑 분리 — 주말 메시지 포매팅 단위 테스트
// AC2: 주말 5개 엄선 아이템, 제목+3줄 요약+"왜 중요한가" 포맷

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  formatWeekendBriefing,
  type BriefingItem,
} from '@/lib/telegram';

// ─── 테스트 픽스처 ──────────────────────────────────────────────────────────

/** 주말 포맷에 사용할 extendedSummary 필드를 포함한 아이템 */
function makeTechItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'tech-1',
    channel: 'tech',
    source: 'hackernews',
    source_url: 'https://news.ycombinator.com/item?id=1',
    title: 'LLM 인프라 최적화 가이드',
    summary_ai: 'LLM 서빙 비용을 50% 절감하는 실전 전략',
    score_initial: 0.95,
    extended_summary: '1줄: LLM 서비스 비용 절감 사례 공유\n2줄: vLLM + 양자화 조합으로 GPU 비용 절반 달성\n3줄: 오픈소스 전략 도입 기업들의 실사례 분석',
    why_important: 'AI 인프라 비용이 스타트업 생존 변수로 부상하는 시점에서, 실전 적용 가능한 기술적 대안을 제시합니다.',
    ...overrides,
  };
}

function makeWorldItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'world-1',
    channel: 'world',
    source: 'naver_news',
    source_url: 'https://n.news.naver.com/1',
    title: '한국 경제 성장률 전망',
    summary_ai: '2026년 한국 경제 성장률 2.3% 예상',
    score_initial: 0.88,
    extended_summary: '1줄: 2026년 성장률 2.3% 전망 발표\n2줄: 수출 회복세와 내수 부진이 교차하는 상황\n3줄: IT/반도체 업황 회복이 핵심 변수',
    why_important: '경기 흐름이 채용 시장과 스타트업 투자에 직접 연결됩니다.',
    ...overrides,
  };
}

function makeCanadaItem(overrides: Partial<BriefingItem> = {}): BriefingItem {
  return {
    id: 'canada-1',
    channel: 'canada',
    source: 'cbc',
    source_url: 'https://www.cbc.ca/news/canada/toronto/1',
    title: '토론토 교통 시스템 개편 발표',
    summary_ai: 'TTC 요금 인상 및 노선 개편 계획 발표',
    score_initial: 0.81,
    extended_summary: '1줄: TTC, 2026년 하반기 요금 10% 인상 발표\n2줄: Line 1/2 운행 빈도 개선 계획 포함\n3줄: 출퇴근 패턴에 실질적 영향 예상',
    why_important: '토론토 거주 가족의 통근 비용과 이동 패턴에 직접 영향을 미칩니다.',
    ...overrides,
  };
}

// ─── WE-01: formatWeekendBriefing 기본 구조 ──────────────────────────────────

describe('formatWeekendBriefing', () => {
  beforeEach(() => {
    // 2026-03-07 토요일 KST 09:00
    vi.setSystemTime(new Date('2026-03-07T09:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WE-01-1: 날짜 헤더에 "주말 브리핑" 또는 "모닝 브리핑"이 포함된다', () => {
    const message = formatWeekendBriefing([makeTechItem()]);
    expect(message).toMatch(/브리핑/);
  });

  it('WE-01-2: 날짜 헤더가 🌅 형식이다', () => {
    const message = formatWeekendBriefing([makeTechItem()]);
    expect(message).toMatch(/🌅 2026\.03\.07/);
  });

  it('WE-01-3: 채널 헤더가 포함된다', () => {
    const message = formatWeekendBriefing([makeTechItem()]);
    expect(message).toContain('🖥️ TECH');
  });

  it('WE-01-4: 아이템에 번호와 링크가 포함된다', () => {
    const item = makeTechItem();
    const message = formatWeekendBriefing([item]);

    expect(message).toContain('1.');
    expect(message).toContain(`href="${item.source_url}"`);
    expect(message).toContain(item.title);
  });

  it('WE-01-5: extended_summary가 있으면 3줄 요약이 표시된다', () => {
    const item = makeTechItem();
    const message = formatWeekendBriefing([item]);

    // extended_summary 내용이 포함되어야 함
    expect(message).toContain('1줄:');
    expect(message).toContain('2줄:');
    expect(message).toContain('3줄:');
  });

  it('WE-01-6: extended_summary가 없으면 summary_ai로 폴백한다', () => {
    const item = makeTechItem({ extended_summary: undefined });
    const message = formatWeekendBriefing([item]);

    // summary_ai가 표시되어야 함
    expect(message).toContain(item.summary_ai);
  });

  it('WE-01-7: "왜 중요한가" 섹션이 why_important 내용과 함께 표시된다', () => {
    const item = makeTechItem();
    const message = formatWeekendBriefing([item]);

    expect(message).toContain('왜 중요한가');
    expect(message).toContain(item.why_important);
  });

  it('WE-01-8: why_important가 없으면 "왜 중요한가" 섹션이 생략된다', () => {
    const item = makeTechItem({ why_important: undefined });
    const message = formatWeekendBriefing([item]);

    expect(message).not.toContain('왜 중요한가');
  });

  it('WE-01-9: 주말 포맷에는 스코어(★)가 표시되지 않는다', () => {
    const item = makeTechItem({ score_initial: 0.95 });
    const message = formatWeekendBriefing([item]);

    expect(message).not.toContain('★');
  });

  it('WE-01-10: 여러 채널 아이템이 채널 순서대로 표시된다', () => {
    const items = [makeWorldItem(), makeTechItem()];
    const message = formatWeekendBriefing(items);

    const techPos = message.indexOf('🖥️ TECH');
    const worldPos = message.indexOf('🌍 WORLD');

    // TECH가 WORLD보다 먼저 나와야 함
    expect(techPos).toBeLessThan(worldPos);
  });

  it('WE-01-11: 빈 배열 입력 시 날짜 헤더만 포함된다', () => {
    const message = formatWeekendBriefing([]);

    expect(message).toMatch(/브리핑/);
    expect(message).not.toContain('🖥️ TECH');
  });

  it('WE-01-12: 아이템 간 충분한 구분이 있다 (빈 줄 포함)', () => {
    const items = [makeTechItem(), makeWorldItem()];
    const message = formatWeekendBriefing(items);

    // 두 채널 섹션 사이에 빈 줄이 있어야 함
    expect(message).toContain('\n\n');
  });

  it('WE-01-13: HTML 형식의 <a href> 링크 태그가 포함된다', () => {
    const message = formatWeekendBriefing([makeTechItem()]);
    expect(message).toMatch(/<a href="https:\/\/.+?">/);
    expect(message).toContain('</a>');
  });
});

// ─── WE-02: 일요일 브리핑 ────────────────────────────────────────────────────

describe('formatWeekendBriefing — 일요일', () => {
  beforeEach(() => {
    // 2026-03-08 일요일 KST 09:00
    vi.setSystemTime(new Date('2026-03-08T09:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WE-02-1: 일요일에도 주말 포맷으로 렌더링된다', () => {
    const item = makeTechItem();
    const message = formatWeekendBriefing([item]);

    expect(message).toMatch(/🌅 2026\.03\.08/);
    // 일요일에는 왜 중요한가 섹션이 있어야 함
    if (item.why_important) {
      expect(message).toContain('왜 중요한가');
    }
  });
});
