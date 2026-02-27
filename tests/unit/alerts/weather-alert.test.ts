// F-15 토론토 날씨 긴급 알림 트리거 단위 테스트 (RED → GREEN)
// AC2: 폭설 15cm+, 한파 -20도, 폭풍 경보 시 알림 발송

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WeatherData } from '@/lib/collectors/weather';

// ─── 날씨 수집기 모킹 (vi.mock은 호이스팅되므로 factory 내 vi.fn() 사용) ─────────

vi.mock('@/lib/collectors/weather', () => ({
  getTorontoWeather: vi.fn(),
  evaluateWeatherAlert: vi.fn(),
}));

// ─── 텔레그램 모킹 ──────────────────────────────────────────────────────────────

vi.mock('@/lib/telegram', () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
}));

// ─── Supabase 모킹 ───────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

import { checkTorontoWeatherAlert } from '@/lib/alerts';

// ─── 테스트 데이터 ───────────────────────────────────────────────────────────

const NORMAL_WEATHER: WeatherData = {
  temperature: -5,
  feelsLike: -10,
  tempMax: -3,
  tempMin: -8,
  condition: 'Clouds',
  conditionKr: '구름 많음',
  humidity: 70,
  windSpeed: 5,
  hasWeatherAlert: false,
};

const BLIZZARD_WEATHER: WeatherData = {
  ...NORMAL_WEATHER,
  condition: 'Snow',
  conditionKr: '눈',
  snow: 20,
};

const COLD_SNAP_WEATHER: WeatherData = {
  ...NORMAL_WEATHER,
  temperature: -25,
  feelsLike: -35,
};

const STORM_WEATHER: WeatherData = {
  ...NORMAL_WEATHER,
  hasWeatherAlert: true,
};

// ─── checkTorontoWeatherAlert 테스트 ─────────────────────────────────────────

describe('checkTorontoWeatherAlert (AC2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('AC2: 정상 날씨 시 null 반환 (알림 불필요)', async () => {
    const { getTorontoWeather, evaluateWeatherAlert } = await import('@/lib/collectors/weather');
    vi.mocked(getTorontoWeather).mockResolvedValueOnce(NORMAL_WEATHER);
    vi.mocked(evaluateWeatherAlert).mockReturnValueOnce({
      isBlizzard: false,
      isColdSnap: false,
      hasStorm: false,
    });

    const result = await checkTorontoWeatherAlert();
    expect(result).toBeNull();
  });

  it('AC2: 폭설(15cm+) 시 알림 트리거 반환', async () => {
    const { getTorontoWeather, evaluateWeatherAlert } = await import('@/lib/collectors/weather');
    vi.mocked(getTorontoWeather).mockResolvedValueOnce(BLIZZARD_WEATHER);
    vi.mocked(evaluateWeatherAlert).mockReturnValueOnce({
      isBlizzard: true,
      isColdSnap: false,
      hasStorm: false,
    });

    const result = await checkTorontoWeatherAlert();
    expect(result).not.toBeNull();
    expect(result?.type).toBe('toronto_weather');
    expect(result?.title).toContain('폭설');
    expect(result?.message).toBeTruthy();
  });

  it('AC2: 한파(-20도 이하) 시 알림 트리거 반환', async () => {
    const { getTorontoWeather, evaluateWeatherAlert } = await import('@/lib/collectors/weather');
    vi.mocked(getTorontoWeather).mockResolvedValueOnce(COLD_SNAP_WEATHER);
    vi.mocked(evaluateWeatherAlert).mockReturnValueOnce({
      isBlizzard: false,
      isColdSnap: true,
      hasStorm: false,
    });

    const result = await checkTorontoWeatherAlert();
    expect(result).not.toBeNull();
    expect(result?.type).toBe('toronto_weather');
    expect(result?.title).toContain('한파');
  });

  it('AC2: 폭풍 경보 시 알림 트리거 반환', async () => {
    const { getTorontoWeather, evaluateWeatherAlert } = await import('@/lib/collectors/weather');
    vi.mocked(getTorontoWeather).mockResolvedValueOnce(STORM_WEATHER);
    vi.mocked(evaluateWeatherAlert).mockReturnValueOnce({
      isBlizzard: false,
      isColdSnap: false,
      hasStorm: true,
    });

    const result = await checkTorontoWeatherAlert();
    expect(result).not.toBeNull();
    expect(result?.type).toBe('toronto_weather');
    expect(result?.title).toContain('폭풍');
  });

  it('날씨 API 실패 시 null 반환 (알림 스킵)', async () => {
    const { getTorontoWeather } = await import('@/lib/collectors/weather');
    vi.mocked(getTorontoWeather).mockRejectedValueOnce(new Error('API connection failed'));

    const result = await checkTorontoWeatherAlert();
    expect(result).toBeNull();
  });

  it('AC2: 알림 트리거 메시지에 온도 정보가 포함된다', async () => {
    const { getTorontoWeather, evaluateWeatherAlert } = await import('@/lib/collectors/weather');
    vi.mocked(getTorontoWeather).mockResolvedValueOnce(COLD_SNAP_WEATHER);
    vi.mocked(evaluateWeatherAlert).mockReturnValueOnce({
      isBlizzard: false,
      isColdSnap: true,
      hasStorm: false,
    });

    const result = await checkTorontoWeatherAlert();
    expect(result).not.toBeNull();
    expect(result?.message).toContain('-25');
  });

  it('AC2: 알림 트리거 타입이 toronto_weather이다', async () => {
    const { getTorontoWeather, evaluateWeatherAlert } = await import('@/lib/collectors/weather');
    vi.mocked(getTorontoWeather).mockResolvedValueOnce(BLIZZARD_WEATHER);
    vi.mocked(evaluateWeatherAlert).mockReturnValueOnce({
      isBlizzard: true,
      isColdSnap: false,
      hasStorm: false,
    });

    const result = await checkTorontoWeatherAlert();
    expect(result?.type).toBe('toronto_weather');
  });
});
