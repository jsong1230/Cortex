// F-20 AC2 — ChannelToggles 컴포넌트 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChannelToggles } from '@/components/settings/ChannelToggles';

// fetch 모킹
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const DEFAULT_SETTINGS = {
  tech: true,
  world: true,
  culture: true,
  canada: true,
};

describe('ChannelToggles — 기본 렌더링 (AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: DEFAULT_SETTINGS }),
    });
  });

  it('AC2-1: 4개 채널 토글이 모두 렌더링된다', async () => {
    render(<ChannelToggles initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getByText(/TECH/i)).toBeInTheDocument();
    expect(screen.getByText(/WORLD/i)).toBeInTheDocument();
    expect(screen.getByText(/CULTURE/i)).toBeInTheDocument();
    expect(screen.getByText(/TORONTO/i)).toBeInTheDocument();
  });

  it('AC2-2: 초기 상태가 initialSettings를 반영한다', () => {
    render(
      <ChannelToggles
        initialSettings={{ tech: true, world: false, culture: true, canada: false }}
      />
    );

    const techToggle = screen.getByRole('checkbox', { name: /TECH/i });
    const worldToggle = screen.getByRole('checkbox', { name: /WORLD/i });

    expect(techToggle).toBeChecked();
    expect(worldToggle).not.toBeChecked();
  });

  it('AC2-3: 토글 클릭 시 상태가 변경된다', async () => {
    render(<ChannelToggles initialSettings={DEFAULT_SETTINGS} />);

    const techToggle = screen.getByRole('checkbox', { name: /TECH/i });
    expect(techToggle).toBeChecked();

    fireEvent.click(techToggle);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/settings/channels',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });

  it('AC2-4: 채널 레이블이 표시된다', () => {
    render(<ChannelToggles initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getByTestId('channel-toggle-tech')).toBeInTheDocument();
    expect(screen.getByTestId('channel-toggle-world')).toBeInTheDocument();
    expect(screen.getByTestId('channel-toggle-culture')).toBeInTheDocument();
    expect(screen.getByTestId('channel-toggle-canada')).toBeInTheDocument();
  });
});
