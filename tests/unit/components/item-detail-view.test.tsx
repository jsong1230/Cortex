// F-09 ItemDetailView 단위 테스트
// test-spec.md D-05 ~ D-07

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ItemDetailView } from '@/components/item/ItemDetailView';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

// ─── fetch 모킹 ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── next/navigation 모킹 ────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({
    back: vi.fn(),
    push: vi.fn(),
  }),
}));

// ─── next/link 모킹 ──────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ─── 테스트 데이터 ──────────────────────────────────────────────────────────

const SAMPLE_DETAIL_RESPONSE = {
  success: true,
  data: {
    content_id: VALID_UUID,
    channel: 'tech',
    title: 'OpenAI GPT-5 출시 임박',
    summary_ai: 'GPT-5 모델 관련 요약 전문 텍스트입니다.',
    source: 'hackernews',
    source_url: 'https://news.ycombinator.com/item?id=12345',
    tags: ['LLM', 'GPT-5', 'AI'],
    collected_at: '2026-02-28T06:30:00.000Z',
    reason: '지난주 메모: LLM 관련',
    briefing_id: '770e8400-e29b-41d4-a716-446655440002',
    user_interaction: null,
    memo_text: null,
    related_items: [
      {
        content_id: '660e8400-e29b-41d4-a716-446655440001',
        channel: 'tech',
        title: 'Claude 3.5 벤치마크',
        summary_ai: '벤치마크 요약',
        source: 'hackernews',
        source_url: 'https://hn.com/2',
      },
    ],
  },
};

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── D-05: 기본 렌더링 ──────────────────────────────────────────────────────

describe('ItemDetailView — 기본 렌더링 (D-05)', () => {
  it('D-05-1: 제목이 렌더링된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_DETAIL_RESPONSE),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.getByTestId('item-title')).toHaveTextContent('OpenAI GPT-5 출시 임박');
    });
  });

  it('D-05-2: AI 요약 전문이 렌더링된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_DETAIL_RESPONSE),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.getByTestId('ai-summary')).toHaveTextContent('GPT-5 모델 관련 요약');
    });
  });

  it('D-05-3: 원문 링크가 렌더링된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_DETAIL_RESPONSE),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      const link = screen.getByTestId('original-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://news.ycombinator.com/item?id=12345');
    });
  });

  it('D-05-4: 소스명이 렌더링된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_DETAIL_RESPONSE),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.getByText('hackernews')).toBeInTheDocument();
    });
  });

  it('D-05-5: 수집 시간이 렌더링된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_DETAIL_RESPONSE),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.getByTestId('collected-at')).toBeInTheDocument();
    });
  });

  it('D-05-6: 채널 뱃지가 렌더링된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_DETAIL_RESPONSE),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      // ChannelBadge는 "TECH" 텍스트를 포함 (여러 개일 수 있으므로 getAllByText 사용)
      const techBadges = screen.getAllByText(/TECH/i);
      expect(techBadges.length).toBeGreaterThan(0);
    });
  });

  it('D-05-7: summary_ai가 null이면 요약 섹션이 "요약 없음" 표시', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...SAMPLE_DETAIL_RESPONSE,
          data: { ...SAMPLE_DETAIL_RESPONSE.data, summary_ai: null },
        }),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.getByText(/요약 없음/)).toBeInTheDocument();
    });
  });
});

// ─── D-06: 태그 표시 ────────────────────────────────────────────────────────

describe('ItemDetailView — 태그 표시 (D-06)', () => {
  it('D-06-1: 태그가 칩 형태로 표시된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_DETAIL_RESPONSE),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.getByText('LLM')).toBeInTheDocument();
      expect(screen.getByText('GPT-5')).toBeInTheDocument();
    });
  });

  it('D-06-2: tags가 null이면 태그 영역이 숨겨진다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...SAMPLE_DETAIL_RESPONSE,
          data: { ...SAMPLE_DETAIL_RESPONSE.data, tags: null },
        }),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.queryByTestId('tags-list')).not.toBeInTheDocument();
    });
  });

  it('D-06-3: tags가 빈 배열이면 태그 영역이 숨겨진다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...SAMPLE_DETAIL_RESPONSE,
          data: { ...SAMPLE_DETAIL_RESPONSE.data, tags: [] },
        }),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.queryByTestId('tags-list')).not.toBeInTheDocument();
    });
  });
});

// ─── D-07: reason 표시 ──────────────────────────────────────────────────────

describe('ItemDetailView — reason 표시 (D-07)', () => {
  it('D-07-1: reason이 있으면 힌트가 표시된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_DETAIL_RESPONSE),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.getByTestId('reason-hint')).toBeInTheDocument();
    });
  });

  it('D-07-2: reason이 null이면 힌트 영역이 숨겨진다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...SAMPLE_DETAIL_RESPONSE,
          data: { ...SAMPLE_DETAIL_RESPONSE.data, reason: null },
        }),
    });

    render(<ItemDetailView contentId={VALID_UUID} />);

    await waitFor(() => {
      expect(screen.queryByTestId('reason-hint')).not.toBeInTheDocument();
    });
  });
});
