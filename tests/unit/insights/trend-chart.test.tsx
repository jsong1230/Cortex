// F-21 TrendChart 단위 테스트 (AC3)
// 30일 스코어 추이 라인 차트 렌더링 검증

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart, type TrendTopic } from '@/components/insights/TrendChart';

// ─── 테스트 데이터 ────────────────────────────────────────────────────────────

const makeHistory = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    score: 0.5 + i * 0.01,
  }));

const SAMPLE_TOPICS: TrendTopic[] = [
  { topic: '토픽A', score: 0.9, history: makeHistory(30) },
  { topic: '토픽B', score: 0.7, history: makeHistory(30) },
  { topic: '토픽C', score: 0.5, history: makeHistory(30) },
];

// ─── U-21-04: 기본 렌더링 ─────────────────────────────────────────────────────

describe('TrendChart — 기본 렌더링 (U-21-04)', () => {
  it('U-21-04-1: SVG 엘리먼트가 렌더링된다', () => {
    render(<TrendChart topics={SAMPLE_TOPICS} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('U-21-04-2: role="img" 및 aria-label이 있다', () => {
    render(<TrendChart topics={SAMPLE_TOPICS} />);
    const svg = document.querySelector('svg[role="img"]');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label');
  });

  it('U-21-04-3: 빈 토픽이면 빈 상태 메시지를 표시한다', () => {
    render(<TrendChart topics={[]} />);
    expect(screen.getByTestId('trend-chart-empty')).toBeInTheDocument();
  });

  it('U-21-04-4: 각 토픽 라인 path가 렌더링된다', () => {
    render(<TrendChart topics={SAMPLE_TOPICS} />);
    const paths = document.querySelectorAll('path[data-topic]');
    expect(paths.length).toBe(SAMPLE_TOPICS.length);
  });

  it('U-21-04-5: 상위 5개 토픽만 기본으로 표시된다', () => {
    const manyTopics: TrendTopic[] = Array.from({ length: 8 }, (_, i) => ({
      topic: `토픽${i + 1}`,
      score: 0.9 - i * 0.05,
      history: makeHistory(30),
    }));
    render(<TrendChart topics={manyTopics} />);
    const paths = document.querySelectorAll('path[data-topic]');
    expect(paths.length).toBeLessThanOrEqual(5);
  });
});

// ─── U-21-05: 날짜 범위 (AC3) ────────────────────────────────────────────────

describe('TrendChart — 날짜 범위 (U-21-05)', () => {
  it('U-21-05-1: 히스토리 데이터가 없는 토픽이면 라인이 렌더링되지 않는다', () => {
    const topicsNoHistory: TrendTopic[] = [
      { topic: '토픽A', score: 0.9, history: [] },
    ];
    render(<TrendChart topics={topicsNoHistory} />);
    const paths = document.querySelectorAll('path[data-topic="토픽A"]');
    expect(paths.length).toBe(0);
  });

  it('U-21-05-2: 히스토리 포인트가 1개이면 라인이 렌더링되지 않는다', () => {
    const topicsOnePoint: TrendTopic[] = [
      {
        topic: '토픽A',
        score: 0.9,
        history: [{ date: '2026-01-01', score: 0.5 }],
      },
    ];
    render(<TrendChart topics={topicsOnePoint} />);
    const paths = document.querySelectorAll('path[data-topic="토픽A"]');
    expect(paths.length).toBe(0);
  });
});
