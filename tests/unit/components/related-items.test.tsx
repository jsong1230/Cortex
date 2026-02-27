// F-09 RelatedItems 단위 테스트
// test-spec.md D-09

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RelatedItems } from '@/components/item/RelatedItems';

// ─── next/link 모킹 ──────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const SAMPLE_ITEMS = [
  {
    content_id: '660e8400-e29b-41d4-a716-446655440001',
    channel: 'tech',
    title: 'Claude 3.5 Sonnet 벤치마크',
    summary_ai: '벤치마크 결과 요약',
    source: 'hackernews',
    source_url: 'https://hn.com/2',
  },
  {
    content_id: '770e8400-e29b-41d4-a716-446655440003',
    channel: 'tech',
    title: 'Google Gemini 2.0 발표',
    summary_ai: 'Gemini 관련 요약',
    source: 'hackernews',
    source_url: 'https://hn.com/3',
  },
  {
    content_id: '880e8400-e29b-41d4-a716-446655440004',
    channel: 'world',
    title: 'AI 규제 동향',
    summary_ai: 'EU AI 규제 관련 요약',
    source: 'naver_news',
    source_url: 'https://news.naver.com/4',
  },
];

// ─── D-09: 관련 아이템 렌더링 (AC4) ─────────────────────────────────────────

describe('RelatedItems — 관련 아이템 렌더링 (D-09)', () => {
  it('D-09-1: 관련 아이템이 있으면 목록이 렌더링된다', () => {
    render(<RelatedItems items={SAMPLE_ITEMS} />);

    // 3건 아이템 카드가 존재해야 한다
    expect(screen.getByText('Claude 3.5 Sonnet 벤치마크')).toBeInTheDocument();
    expect(screen.getByText('Google Gemini 2.0 발표')).toBeInTheDocument();
    expect(screen.getByText('AI 규제 동향')).toBeInTheDocument();
  });

  it('D-09-2: 각 아이템에 채널 뱃지, 제목이 표시된다', () => {
    render(<RelatedItems items={[SAMPLE_ITEMS[0]]} />);

    // ChannelBadge의 TECH 텍스트 확인
    expect(screen.getByText(/TECH/i)).toBeInTheDocument();
    // 제목 텍스트 확인
    expect(screen.getByText('Claude 3.5 Sonnet 벤치마크')).toBeInTheDocument();
  });

  it('D-09-3: 아이템 클릭 시 /item/[id]로 이동한다', () => {
    render(<RelatedItems items={[SAMPLE_ITEMS[0]]} />);

    const link = screen.getByRole('link', { name: /Claude 3.5 Sonnet 벤치마크/ });
    expect(link).toHaveAttribute('href', '/item/660e8400-e29b-41d4-a716-446655440001');
  });

  it('D-09-4: 관련 아이템이 0건이면 빈 상태 메시지가 표시된다', () => {
    render(<RelatedItems items={[]} />);

    expect(screen.getByText('관련 아이템이 없습니다')).toBeInTheDocument();
  });

  it('D-09-5: 섹션 제목 "관련 아이템"이 표시된다', () => {
    render(<RelatedItems items={SAMPLE_ITEMS} />);

    expect(screen.getByText('관련 아이템')).toBeInTheDocument();
  });
});
