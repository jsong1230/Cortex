// F-08 BriefingCard + ChannelBadge 단위 테스트
// test-spec.md U-08-01 ~ U-08-04

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BriefingCard, BriefingCardProps } from '@/components/briefing/BriefingCard';
import { ChannelBadge } from '@/components/briefing/ChannelBadge';

// fetch 모킹 (FeedbackButtons 내부 사용)
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true, data: { id: 'new-uuid', interaction: '좋아요' } }),
}));

const DEFAULT_PROPS: BriefingCardProps = {
  contentId: 'content-uuid-001',
  briefingId: 'briefing-uuid-001',
  channel: 'tech',
  title: 'OpenAI, GPT-5 출시 임박',
  summaryAi: 'OpenAI가 GPT-5 모델 출시를 앞두고 있으며, 멀티모달 성능이 대폭 향상될 것으로 알려졌다.',
  source: 'hackernews',
  sourceUrl: 'https://news.ycombinator.com/item?id=12345',
  reason: null,
  userInteraction: null,
};

// ─── U-08-01: BriefingCard 기본 렌더링 ──────────────────────────────────────

describe('BriefingCard — 기본 렌더링 (U-08-01)', () => {
  it('U-08-01-1: 제목이 렌더링된다', () => {
    render(<BriefingCard {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('briefing-title')).toHaveTextContent('OpenAI, GPT-5 출시 임박');
  });

  it('U-08-01-2: AI 요약이 렌더링된다', () => {
    render(<BriefingCard {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('briefing-summary')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-summary')).toHaveTextContent('OpenAI가 GPT-5');
  });

  it('U-08-01-3: 소스명이 렌더링된다', () => {
    render(<BriefingCard {...DEFAULT_PROPS} />);
    expect(screen.getByText('hackernews')).toBeInTheDocument();
  });

  it('U-08-01-4: sourceUrl이 링크로 렌더링된다', () => {
    render(<BriefingCard {...DEFAULT_PROPS} />);
    const link = screen.getByRole('link', { name: /OpenAI, GPT-5 출시 임박/ });
    expect(link).toHaveAttribute('href', 'https://news.ycombinator.com/item?id=12345');
  });

  it('U-08-01-5: summaryAi가 null이면 요약 영역이 렌더링되지 않는다', () => {
    render(<BriefingCard {...DEFAULT_PROPS} summaryAi={null} />);
    expect(screen.queryByTestId('briefing-summary')).not.toBeInTheDocument();
  });
});

// ─── U-08-02: ChannelBadge 채널별 색상 ──────────────────────────────────────

describe('ChannelBadge — 채널별 표시 (U-08-02)', () => {
  it('U-08-02-1: tech 채널 뱃지가 "TECH" 텍스트를 표시한다', () => {
    render(<ChannelBadge channel="tech" />);
    expect(screen.getByText(/TECH/i)).toBeInTheDocument();
  });

  it('U-08-02-2: world 채널 뱃지가 "WORLD" 텍스트를 표시한다', () => {
    render(<ChannelBadge channel="world" />);
    expect(screen.getByText(/WORLD/i)).toBeInTheDocument();
  });

  it('U-08-02-3: culture 채널 뱃지가 "CULTURE" 텍스트를 표시한다', () => {
    render(<ChannelBadge channel="culture" />);
    expect(screen.getByText(/CULTURE/i)).toBeInTheDocument();
  });

  it('U-08-02-4: canada 채널 뱃지가 "TORONTO" 텍스트를 표시한다', () => {
    render(<ChannelBadge channel="canada" />);
    expect(screen.getByText(/TORONTO/i)).toBeInTheDocument();
  });

  it('U-08-02-5: serendipity 채널 뱃지가 "세렌디피티" 텍스트를 표시한다', () => {
    render(<ChannelBadge channel="serendipity" />);
    expect(screen.getByText(/세렌디피티/)).toBeInTheDocument();
  });

  it('U-08-02-6: 알 수 없는 채널은 대문자 채널명을 표시한다', () => {
    render(<ChannelBadge channel="unknown" />);
    expect(screen.getByText(/UNKNOWN/i)).toBeInTheDocument();
  });
});

// ─── U-08-03: reason 필드 (AC5) ──────────────────────────────────────────────

describe('BriefingCard — reason 필드 (U-08-03)', () => {
  it('U-08-03-1: reason이 있으면 💡 힌트 영역이 표시된다', () => {
    render(
      <BriefingCard
        {...DEFAULT_PROPS}
        reason="지난주 메모: MSA 전환 관련 아티클"
      />
    );
    expect(screen.getByTestId('reason-hint')).toBeInTheDocument();
    expect(screen.getByTestId('reason-hint')).toHaveTextContent('MSA 전환');
  });

  it('U-08-03-2: reason이 null이면 힌트 영역이 렌더링되지 않는다', () => {
    render(<BriefingCard {...DEFAULT_PROPS} reason={null} />);
    expect(screen.queryByTestId('reason-hint')).not.toBeInTheDocument();
  });
});

// ─── U-08-04: FeedbackButtons 존재 확인 ─────────────────────────────────────

describe('BriefingCard — FeedbackButtons (U-08-04)', () => {
  it('U-08-04-1: 4개 피드백 버튼이 모두 렌더링된다', () => {
    render(<BriefingCard {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /좋아요/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /싫어요/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /저장/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /메모/ })).toBeInTheDocument();
  });
});
