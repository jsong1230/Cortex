// F-21 BubbleChart 단위 테스트 (AC1, AC2)
// 버블 차트 렌더링 + 버블 크기가 토픽 스코어에 비례하는지 검증

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BubbleChart, type BubbleTopic } from '@/components/insights/BubbleChart';

// ─── 테스트 데이터 ────────────────────────────────────────────────────────────

const makeTopic = (idx: number, score: number, interactionCount = 5): BubbleTopic => ({
  topic: `토픽${idx}`,
  score,
  interactionCount,
  history: [],
});

const SAMPLE_TOPICS: BubbleTopic[] = [
  makeTopic(1, 0.9),
  makeTopic(2, 0.6),
  makeTopic(3, 0.3),
];

// ─── U-21-01: 기본 렌더링 ─────────────────────────────────────────────────────

describe('BubbleChart — 기본 렌더링 (U-21-01)', () => {
  it('U-21-01-1: SVG 엘리먼트가 렌더링된다', () => {
    render(<BubbleChart topics={SAMPLE_TOPICS} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('U-21-01-2: role="img" 및 aria-label이 있다', () => {
    render(<BubbleChart topics={SAMPLE_TOPICS} />);
    const svg = document.querySelector('svg[role="img"]');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label');
  });

  it('U-21-01-3: 각 토픽에 대한 circle 엘리먼트가 렌더링된다', () => {
    render(<BubbleChart topics={SAMPLE_TOPICS} />);
    const circles = document.querySelectorAll('circle[data-topic]');
    expect(circles.length).toBe(SAMPLE_TOPICS.length);
  });

  it('U-21-01-4: 빈 토픽 목록이면 빈 상태 메시지를 표시한다', () => {
    render(<BubbleChart topics={[]} />);
    expect(screen.getByTestId('bubble-chart-empty')).toBeInTheDocument();
  });

  it('U-21-01-5: 토픽 이름이 표시된다', () => {
    render(<BubbleChart topics={SAMPLE_TOPICS} />);
    expect(screen.getByText('토픽1')).toBeInTheDocument();
    expect(screen.getByText('토픽2')).toBeInTheDocument();
  });
});

// ─── U-21-02: 버블 크기 비례 (AC2) ───────────────────────────────────────────

describe('BubbleChart — 버블 크기 비례 (U-21-02)', () => {
  it('U-21-02-1: 스코어가 높은 토픽의 버블이 더 크다', () => {
    const topics: BubbleTopic[] = [
      makeTopic(1, 0.9),
      makeTopic(2, 0.3),
    ];
    render(<BubbleChart topics={topics} />);

    const circle1 = document.querySelector('circle[data-topic="토픽1"]');
    const circle2 = document.querySelector('circle[data-topic="토픽2"]');
    expect(circle1).toBeInTheDocument();
    expect(circle2).toBeInTheDocument();

    const r1 = parseFloat(circle1!.getAttribute('r') ?? '0');
    const r2 = parseFloat(circle2!.getAttribute('r') ?? '0');
    expect(r1).toBeGreaterThan(r2);
  });

  it('U-21-02-2: 스코어 1.0인 버블 반지름이 스코어 0.25인 버블보다 2배 크다 (sqrt 비례)', () => {
    // sqrt(1.0) / sqrt(0.25) = 1.0 / 0.5 = 2배
    const topics: BubbleTopic[] = [
      makeTopic(1, 1.0),
      makeTopic(2, 0.25),
    ];
    render(<BubbleChart topics={topics} />);

    const circle1 = document.querySelector('circle[data-topic="토픽1"]');
    const circle2 = document.querySelector('circle[data-topic="토픽2"]');

    const r1 = parseFloat(circle1!.getAttribute('r') ?? '0');
    const r2 = parseFloat(circle2!.getAttribute('r') ?? '0');

    // 반지름 비율이 약 2배 (허용 오차 ±0.1)
    expect(r1 / r2).toBeCloseTo(2.0, 0);
  });

  it('U-21-02-3: 스코어 0이면 최소 반지름이 양수이다', () => {
    const topics: BubbleTopic[] = [makeTopic(1, 0)];
    render(<BubbleChart topics={topics} />);

    const circle = document.querySelector('circle[data-topic="토픽1"]');
    const r = parseFloat(circle!.getAttribute('r') ?? '0');
    expect(r).toBeGreaterThan(0);
  });
});

// ─── U-21-03: 색상 코딩 ──────────────────────────────────────────────────────

describe('BubbleChart — 색상 코딩 (U-21-03)', () => {
  it('U-21-03-1: 스코어 0.7 이상인 버블은 high 색상 클래스를 가진다', () => {
    const topics: BubbleTopic[] = [makeTopic(1, 0.8)];
    render(<BubbleChart topics={topics} />);

    const circle = document.querySelector('circle[data-topic="토픽1"]');
    expect(circle?.getAttribute('data-score-level')).toBe('high');
  });

  it('U-21-03-2: 스코어 0.4~0.69인 버블은 medium 색상 클래스를 가진다', () => {
    const topics: BubbleTopic[] = [makeTopic(1, 0.55)];
    render(<BubbleChart topics={topics} />);

    const circle = document.querySelector('circle[data-topic="토픽1"]');
    expect(circle?.getAttribute('data-score-level')).toBe('medium');
  });

  it('U-21-03-3: 스코어 0.4 미만인 버블은 low 색상 클래스를 가진다', () => {
    const topics: BubbleTopic[] = [makeTopic(1, 0.2)];
    render(<BubbleChart topics={topics} />);

    const circle = document.querySelector('circle[data-topic="토픽1"]');
    expect(circle?.getAttribute('data-score-level')).toBe('low');
  });
});
