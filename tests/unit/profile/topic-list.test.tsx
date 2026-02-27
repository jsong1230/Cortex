// F-14 TopicList 단위 테스트 (AC2, AC3)
// 토픽 목록 렌더링 + 액션(스코어 조정, 아카이브) 검증

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopicList, type TopicListProps } from '@/components/profile/TopicList';
import type { InterestTopic } from '@/components/profile/InterestChart';

// ─── 테스트 데이터 ────────────────────────────────────────────────────────────

const makeTopic = (idx: number, score: number): InterestTopic => ({
  id: `id-${idx}`,
  topic: `토픽${idx}`,
  score,
  interaction_count: idx * 3,
  last_updated: '2026-02-01T00:00:00Z',
  archived_at: null,
});

const FIFTEEN_TOPICS: InterestTopic[] = Array.from({ length: 15 }, (_, i) =>
  makeTopic(i + 1, 1.0 - i * 0.06)
);

// ─── U-14-04: TopicList 기본 렌더링 ─────────────────────────────────────────

describe('TopicList — 기본 렌더링 (U-14-04)', () => {
  const defaultProps: TopicListProps = {
    topics: FIFTEEN_TOPICS,
    onScoreAdjust: vi.fn(),
    onArchive: vi.fn(),
  };

  it('U-14-04-1: 모든 토픽 이름이 렌더링된다', () => {
    render(<TopicList {...defaultProps} />);
    expect(screen.getByText('토픽1')).toBeInTheDocument();
    expect(screen.getByText('토픽15')).toBeInTheDocument();
  });

  it('U-14-04-2: 각 토픽에 interaction_count가 표시된다', () => {
    render(<TopicList {...defaultProps} />);
    // 토픽1의 interaction_count = 3
    expect(screen.getByTestId('interaction-count-id-1')).toBeInTheDocument();
  });

  it('U-14-04-3: 각 토픽에 아카이브 버튼이 있다', () => {
    render(<TopicList {...defaultProps} />);
    const archiveBtns = screen.getAllByRole('button', { name: /아카이브/ });
    expect(archiveBtns.length).toBe(FIFTEEN_TOPICS.length);
  });

  it('U-14-04-4: 빈 목록이면 빈 상태 메시지를 표시한다', () => {
    render(<TopicList {...defaultProps} topics={[]} />);
    expect(screen.getByTestId('topic-list-empty')).toBeInTheDocument();
  });
});

// ─── U-14-05: Top 10 뱃지 (AC3) ─────────────────────────────────────────────

describe('TopicList — Top 10 뱃지 (U-14-05)', () => {
  const defaultProps: TopicListProps = {
    topics: FIFTEEN_TOPICS,
    onScoreAdjust: vi.fn(),
    onArchive: vi.fn(),
  };

  it('U-14-05-1: 상위 10개 토픽에 top10 뱃지가 표시된다', () => {
    render(<TopicList {...defaultProps} />);
    const badges = screen.getAllByTestId('top10-badge');
    expect(badges.length).toBe(10);
  });

  it('U-14-05-2: 11번째 이후 토픽에는 뱃지가 없다', () => {
    render(<TopicList {...defaultProps} />);
    // 토픽11(idx=10)에는 뱃지 없음
    const row = screen.getByTestId('topic-row-id-11');
    expect(row.querySelector('[data-testid="top10-badge"]')).toBeNull();
  });
});

// ─── U-14-06: 스코어 조정 액션 (AC2) ────────────────────────────────────────

describe('TopicList — 스코어 조정 (U-14-06)', () => {
  it('U-14-06-1: + 버튼 클릭 시 onScoreAdjust(id, +0.1)가 호출된다', () => {
    const onScoreAdjust = vi.fn();
    render(
      <TopicList
        topics={FIFTEEN_TOPICS}
        onScoreAdjust={onScoreAdjust}
        onArchive={vi.fn()}
      />
    );
    const plusBtn = screen.getByTestId('score-up-id-1');
    fireEvent.click(plusBtn);
    expect(onScoreAdjust).toHaveBeenCalledWith('id-1', 0.1);
  });

  it('U-14-06-2: - 버튼 클릭 시 onScoreAdjust(id, -0.1)가 호출된다', () => {
    const onScoreAdjust = vi.fn();
    render(
      <TopicList
        topics={FIFTEEN_TOPICS}
        onScoreAdjust={onScoreAdjust}
        onArchive={vi.fn()}
      />
    );
    const minusBtn = screen.getByTestId('score-down-id-1');
    fireEvent.click(minusBtn);
    expect(onScoreAdjust).toHaveBeenCalledWith('id-1', -0.1);
  });
});

// ─── U-14-07: 아카이브 액션 (AC2) ───────────────────────────────────────────

describe('TopicList — 아카이브 (U-14-07)', () => {
  it('U-14-07-1: 아카이브 버튼 클릭 시 onArchive(id)가 호출된다', () => {
    const onArchive = vi.fn();
    render(
      <TopicList
        topics={FIFTEEN_TOPICS}
        onScoreAdjust={vi.fn()}
        onArchive={onArchive}
      />
    );
    const archiveBtns = screen.getAllByRole('button', { name: /아카이브/ });
    fireEvent.click(archiveBtns[0]);
    expect(onArchive).toHaveBeenCalledWith('id-1');
  });
});
