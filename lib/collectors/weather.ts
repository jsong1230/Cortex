// OpenWeatherMap API — 토론토 날씨 수집
// Current Weather: /data/2.5/weather
// 5 Day Forecast:  /data/2.5/forecast

import { fetchWithRetry } from './utils';

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

export interface WeatherData {
  temperature: number;       // 섭씨 현재기온
  feelsLike: number;         // 체감 온도
  tempMax: number;           // 최고기온
  tempMin: number;           // 최저기온
  condition: string;         // 날씨 상태 (en)
  conditionKr: string;       // 날씨 상태 (ko)
  humidity: number;          // 습도 %
  windSpeed: number;         // 풍속 m/s
  snow?: number;             // 1시간 강설량 mm (있는 경우)
  rain?: number;             // 1시간 강우량 mm (있는 경우)
  hasWeatherAlert: boolean;  // 기상 경보 여부
}

/**
 * 긴급 알림 트리거 조건
 */
export interface WeatherAlertCondition {
  isBlizzard: boolean;   // 폭설: 강설량 15cm+
  isColdSnap: boolean;   // 한파: 기온 -20도 이하
  hasStorm: boolean;     // 폭풍: 기상 경보 존재
}

/**
 * 토론토 현재 날씨 조회
 */
export async function getTorontoWeather(): Promise<WeatherData> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY가 설정되지 않았습니다.');
  }

  const params = new URLSearchParams({
    q: 'Toronto,CA',
    units: 'metric',
    lang: 'kr',
    appid: apiKey,
  });

  const response = await fetchWithRetry(`${OWM_BASE}/weather?${params}`, { timeout: 10000 });
  if (!response.ok) {
    throw new Error(`날씨 API 호출 실패: ${response.status}`);
  }

  const data = await response.json();

  return {
    temperature: data.main.temp,
    feelsLike: data.main.feels_like,
    tempMax: data.main.temp_max,
    tempMin: data.main.temp_min,
    condition: data.weather[0].main,
    conditionKr: data.weather[0].description,
    humidity: data.main.humidity,
    windSpeed: data.wind.speed,
    snow: data.snow?.['1h'],
    rain: data.rain?.['1h'],
    hasWeatherAlert: false, // OpenWeatherMap 무료 플랜에서는 alerts 미제공
  };
}

/**
 * 긴급 알림 조건 평가
 */
export function evaluateWeatherAlert(weather: WeatherData): WeatherAlertCondition {
  return {
    isBlizzard: (weather.snow ?? 0) >= 15,     // 1시간 강설 15cm (단위 변환 주의)
    isColdSnap: weather.temperature <= -20,
    hasStorm: weather.hasWeatherAlert,
  };
}
