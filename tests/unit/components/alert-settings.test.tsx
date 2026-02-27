// F-20 AC3, AC4 — AlertSettings 컴포넌트 단위 테스트

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertSettings } from '@/components/settings/AlertSettings';

// fetch 모킹
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const DEFAULT_ALERT_SETTINGS = [
  {
    id: 'uuid-1',
    trigger_type: 'toronto_weather',
    is_enabled: true,
    quiet_hours_start: '23:00',
    quiet_hours_end: '07:00',
  },
  {
    id: 'uuid-2',
    trigger_type: 'keyword_breaking',
    is_enabled: true,
    quiet_hours_start: '23:00',
    quiet_hours_end: '07:00',
  },
  {
    id: 'uuid-3',
    trigger_type: 'world_emergency',
    is_enabled: false,
    quiet_hours_start: '23:00',
    quiet_hours_end: '07:00',
  },
  {
    id: 'uuid-4',
    trigger_type: 'culture_trend',
    is_enabled: false,
    quiet_hours_start: '23:00',
    quiet_hours_end: '07:00',
  },
  {
    id: 'uuid-5',
    trigger_type: 'mylifeos_match',
    is_enabled: true,
    quiet_hours_start: '23:00',
    quiet_hours_end: '07:00',
  },
];

describe('AlertSettings — 기본 렌더링 (AC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: DEFAULT_ALERT_SETTINGS[0] }),
    });
  });

  it('AC3-1: 5개 알림 트리거 토글이 렌더링된다', () => {
    render(<AlertSettings initialSettings={DEFAULT_ALERT_SETTINGS} />);

    expect(screen.getByTestId('alert-toggle-toronto_weather')).toBeInTheDocument();
    expect(screen.getByTestId('alert-toggle-keyword_breaking')).toBeInTheDocument();
    expect(screen.getByTestId('alert-toggle-world_emergency')).toBeInTheDocument();
    expect(screen.getByTestId('alert-toggle-culture_trend')).toBeInTheDocument();
    expect(screen.getByTestId('alert-toggle-mylifeos_match')).toBeInTheDocument();
  });

  it('AC3-2: 초기 활성화 상태가 올바르게 표시된다', () => {
    render(<AlertSettings initialSettings={DEFAULT_ALERT_SETTINGS} />);

    const weatherToggle = screen.getByRole('checkbox', { name: /toronto_weather/i });
    const worldToggle = screen.getByRole('checkbox', { name: /world_emergency/i });

    expect(weatherToggle).toBeChecked();
    expect(worldToggle).not.toBeChecked();
  });

  it('AC3-3: 트리거 토글 클릭 시 PUT API가 호출된다', async () => {
    render(<AlertSettings initialSettings={DEFAULT_ALERT_SETTINGS} />);

    const weatherToggle = screen.getByRole('checkbox', { name: /toronto_weather/i });
    fireEvent.click(weatherToggle);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/alerts/settings',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });
});

describe('AlertSettings — 방해 금지 시간 (AC4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: DEFAULT_ALERT_SETTINGS[0] }),
    });
  });

  it('AC4-1: 방해 금지 시작 시간 입력 필드가 렌더링된다', () => {
    render(<AlertSettings initialSettings={DEFAULT_ALERT_SETTINGS} />);
    expect(screen.getByTestId('quiet-hours-start')).toBeInTheDocument();
  });

  it('AC4-2: 방해 금지 종료 시간 입력 필드가 렌더링된다', () => {
    render(<AlertSettings initialSettings={DEFAULT_ALERT_SETTINGS} />);
    expect(screen.getByTestId('quiet-hours-end')).toBeInTheDocument();
  });

  it('AC4-3: 초기 방해 금지 시간이 첫 번째 설정값에서 표시된다', () => {
    render(<AlertSettings initialSettings={DEFAULT_ALERT_SETTINGS} />);

    const startInput = screen.getByTestId('quiet-hours-start') as HTMLInputElement;
    const endInput = screen.getByTestId('quiet-hours-end') as HTMLInputElement;

    expect(startInput.value).toBe('23:00');
    expect(endInput.value).toBe('07:00');
  });
});
