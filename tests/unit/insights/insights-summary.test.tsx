// F-21 InsightsSummary 단위 테스트 (AC1, AC3)
// 관심사 요약 텍스트 (상위 관심사, 급상승, 하락) 렌더링 검증

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsightsSummary, type SummaryTopic } from '@/components/insights/InsightsSummary';

// ─── 테스트 데이터 ────────────────────────────────────────────────────────────

const makeTopic = (
  topic: string,
  score: number,
  historyScores: number[]
): SummaryTopic => ({
  topic,
  score,
  interactionCount: 5,
  history: historyScores.map((s, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    score: s,
  })),
});

// 상승 토픽: 30일 전 0.3 → 현재 0.8
const RISING_TOPIC = makeTopic('RisingTopic', 0.8, [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);

// 하락 토픽: 30일 전 0.8 → 현재 0.3
const FALLING_TOPIC = makeTopic('FallingTopic', 0.3, [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);

// 안정 토픽
const STABLE_TOPIC = makeTopic('StableTopic', 0.7, [0.7, 0.7, 0.7, 0.7, 0.7, 0.7]);

const SAMPLE_TOPICS: SummaryTopic[] = [RISING_TOPIC, FALLING_TOPIC, STABLE_TOPIC];

// ─── U-21-06: 기본 렌더링 ─────────────────────────────────────────────────────

describe('InsightsSummary — 기본 렌더링 (U-21-06)', () => {
  it('U-21-06-1: 컴포넌트가 렌더링된다', () => {
    render(<InsightsSummary topics={SAMPLE_TOPICS} />);
    expect(screen.getByTestId('insights-summary')).toBeInTheDocument();
  });

  it('U-21-06-2: "상위 관심사" 섹션이 있다', () => {
    render(<InsightsSummary topics={SAMPLE_TOPICS} />);
    expect(screen.getByTestId('summary-top-topics')).toBeInTheDocument();
  });

  it('U-21-06-3: "급상승 토픽" 섹션이 있다', () => {
    render(<InsightsSummary topics={SAMPLE_TOPICS} />);
    expect(screen.getByTestId('summary-rising-topics')).toBeInTheDocument();
  });

  it('U-21-06-4: "하락 토픽" 섹션이 있다', () => {
    render(<InsightsSummary topics={SAMPLE_TOPICS} />);
    expect(screen.getByTestId('summary-falling-topics')).toBeInTheDocument();
  });

  it('U-21-06-5: 빈 토픽이면 빈 상태 메시지를 표시한다', () => {
    render(<InsightsSummary topics={[]} />);
    expect(screen.getByTestId('insights-summary-empty')).toBeInTheDocument();
  });
});

// ─── U-21-07: 추이 분류 (AC3) ────────────────────────────────────────────────

describe('InsightsSummary — 추이 분류 (U-21-07)', () => {
  it('U-21-07-1: 급상승 토픽이 상승 섹션에 표시된다', () => {
    render(<InsightsSummary topics={SAMPLE_TOPICS} />);
    const risingSection = screen.getByTestId('summary-rising-topics');
    expect(risingSection).toHaveTextContent('RisingTopic');
  });

  it('U-21-07-2: 하락 토픽이 하락 섹션에 표시된다', () => {
    render(<InsightsSummary topics={SAMPLE_TOPICS} />);
    const fallingSection = screen.getByTestId('summary-falling-topics');
    expect(fallingSection).toHaveTextContent('FallingTopic');
  });

  it('U-21-07-3: 상위 관심사 섹션에 최고 점수 토픽이 표시된다', () => {
    render(<InsightsSummary topics={SAMPLE_TOPICS} />);
    const topSection = screen.getByTestId('summary-top-topics');
    // score: RISING(0.8), STABLE(0.7), FALLING(0.3) — RISING이 상위
    expect(topSection).toHaveTextContent('RisingTopic');
  });

  it('U-21-07-4: 히스토리 없는 토픽은 추이 분류 없이 렌더링된다', () => {
    const noHistoryTopics: SummaryTopic[] = [
      { topic: 'NoHistory', score: 0.7, interactionCount: 3, history: [] },
    ];
    render(<InsightsSummary topics={noHistoryTopics} />);
    expect(screen.getByTestId('insights-summary')).toBeInTheDocument();
  });
});
