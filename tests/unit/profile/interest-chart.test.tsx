// F-14 InterestChart 단위 테스트 (AC1, AC3)
// 토픽별 관심도 스코어 차트 렌더링 + Top 10 하이라이트 검증

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InterestChart, type InterestTopic } from '@/components/profile/InterestChart';

// ─── 테스트 데이터 ────────────────────────────────────────────────────────────

const makeTopic = (
  idx: number,
  score: number,
  interactionCount = 5
): InterestTopic => ({
  id: `id-${idx}`,
  topic: `토픽${idx}`,
  score,
  interaction_count: interactionCount,
  last_updated: '2026-02-01T00:00:00Z',
  archived_at: null,
});

// 12개 토픽: score 내림차순 (0.95 ~ 0.15)
const TWELVE_TOPICS: InterestTopic[] = [
  makeTopic(1, 0.95),
  makeTopic(2, 0.88),
  makeTopic(3, 0.82),
  makeTopic(4, 0.77),
  makeTopic(5, 0.72),
  makeTopic(6, 0.65),
  makeTopic(7, 0.60),
  makeTopic(8, 0.55),
  makeTopic(9, 0.50),
  makeTopic(10, 0.45),
  makeTopic(11, 0.30),
  makeTopic(12, 0.15),
];

// ─── U-14-01: 기본 렌더링 ────────────────────────────────────────────────────

describe('InterestChart — 기본 렌더링 (U-14-01)', () => {
  it('U-14-01-1: 컴포넌트가 렌더링된다', () => {
    render(<InterestChart topics={TWELVE_TOPICS} />);
    expect(screen.getByTestId('interest-chart')).toBeInTheDocument();
  });

  it('U-14-01-2: 토픽 이름이 표시된다', () => {
    render(<InterestChart topics={TWELVE_TOPICS} />);
    expect(screen.getByText('토픽1')).toBeInTheDocument();
    expect(screen.getByText('토픽6')).toBeInTheDocument();
  });

  it('U-14-01-3: 스코어가 퍼센트(%)로 표시된다', () => {
    render(<InterestChart topics={TWELVE_TOPICS} />);
    // 0.95 → "95%"
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('U-14-01-4: 빈 토픽 목록이면 빈 상태 메시지를 표시한다', () => {
    render(<InterestChart topics={[]} />);
    expect(screen.getByTestId('interest-chart-empty')).toBeInTheDocument();
  });
});

// ─── U-14-02: Top 10 하이라이트 (AC3) ───────────────────────────────────────

describe('InterestChart — Top 10 하이라이트 (U-14-02)', () => {
  it('U-14-02-1: 상위 10개 항목에 top10 데이터 속성이 붙는다', () => {
    render(<InterestChart topics={TWELVE_TOPICS} />);
    const top10Bars = document.querySelectorAll('[data-top10="true"]');
    expect(top10Bars.length).toBe(10);
  });

  it('U-14-02-2: 11번째 이하 항목에는 top10 데이터 속성이 없다', () => {
    render(<InterestChart topics={TWELVE_TOPICS} />);
    // data-top10="false" 또는 속성 없음 → 총 2개 (11, 12번째)
    const nonTop10Bars = document.querySelectorAll('[data-top10="false"]');
    expect(nonTop10Bars.length).toBe(2);
  });

  it('U-14-02-3: 토픽이 10개 이하면 모두 top10으로 처리된다', () => {
    const fiveTopics = TWELVE_TOPICS.slice(0, 5);
    render(<InterestChart topics={fiveTopics} />);
    const top10Bars = document.querySelectorAll('[data-top10="true"]');
    expect(top10Bars.length).toBe(5);
  });
});

// ─── U-14-03: 바 차트 너비 비율 ─────────────────────────────────────────────

describe('InterestChart — 바 너비 비율 (U-14-03)', () => {
  it('U-14-03-1: 스코어 1.0인 토픽의 바가 100% 너비를 가진다', () => {
    const perfectTopic: InterestTopic = makeTopic(0, 1.0);
    render(<InterestChart topics={[perfectTopic]} />);
    const bar = document.querySelector('[data-testid="chart-bar-id-0"]');
    expect(bar).toBeInTheDocument();
    expect((bar as HTMLElement).style.width).toBe('100%');
  });

  it('U-14-03-2: 스코어 0.5인 토픽의 바가 50% 너비를 가진다', () => {
    const halfTopic: InterestTopic = makeTopic(0, 0.5);
    render(<InterestChart topics={[halfTopic]} />);
    const bar = document.querySelector('[data-testid="chart-bar-id-0"]');
    expect((bar as HTMLElement).style.width).toBe('50%');
  });
});
