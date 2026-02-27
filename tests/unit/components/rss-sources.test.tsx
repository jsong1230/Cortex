// F-20 AC1 — RssSources 컴포넌트 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RssSources } from '@/components/settings/RssSources';

// fetch 모킹
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const DEFAULT_SOURCES: import('@/components/settings/RssSources').RssSource[] = [
  { url: 'https://example.com/feed.xml', name: 'Example Blog', channel: 'tech' },
  { url: 'https://news.ycombinator.com/rss', name: 'Hacker News', channel: 'tech' },
];

describe('RssSources — 기본 렌더링 (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: DEFAULT_SOURCES }),
    });
  });

  it('AC1-1: RSS 소스 목록이 렌더링된다', () => {
    render(<RssSources initialSources={DEFAULT_SOURCES} />);

    expect(screen.getByText('Example Blog')).toBeInTheDocument();
    expect(screen.getByText('Hacker News')).toBeInTheDocument();
  });

  it('AC1-2: 각 항목에 삭제 버튼이 있다', () => {
    render(<RssSources initialSources={DEFAULT_SOURCES} />);

    const deleteButtons = screen.getAllByRole('button', { name: /삭제/i });
    expect(deleteButtons).toHaveLength(DEFAULT_SOURCES.length);
  });

  it('AC1-3: URL 추가 입력 폼이 렌더링된다', () => {
    render(<RssSources initialSources={DEFAULT_SOURCES} />);

    expect(screen.getByTestId('rss-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('rss-add-button')).toBeInTheDocument();
  });

  it('AC1-4: 빈 소스 목록일 때 안내 메시지가 표시된다', () => {
    render(<RssSources initialSources={[]} />);

    expect(screen.getByTestId('rss-empty-message')).toBeInTheDocument();
  });
});

describe('RssSources — 추가 동작 (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: DEFAULT_SOURCES }),
    });
  });

  it('AC1-5: 빈 URL 입력 후 추가 버튼 클릭 시 fetch가 호출되지 않는다', async () => {
    render(<RssSources initialSources={DEFAULT_SOURCES} />);

    const addButton = screen.getByTestId('rss-add-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it('AC1-6: 유효한 URL 입력 후 추가 버튼 클릭 시 POST API가 호출된다', async () => {
    render(<RssSources initialSources={DEFAULT_SOURCES} />);

    const urlInput = screen.getByTestId('rss-url-input');
    fireEvent.change(urlInput, { target: { value: 'https://newblog.com/feed' } });

    const addButton = screen.getByTestId('rss-add-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/settings/rss',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});

describe('RssSources — 삭제 동작 (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  it('AC1-7: 삭제 버튼 클릭 시 DELETE API가 호출된다', async () => {
    render(<RssSources initialSources={DEFAULT_SOURCES} />);

    const deleteButtons = screen.getAllByRole('button', { name: /삭제/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/settings/rss',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});
