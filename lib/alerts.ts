// 긴급 알림 트리거 로직
// alert_settings 테이블 조건 확인 → 텔레그램 즉시 발송

import { sendMessage } from './telegram';

export type TriggerType =
  | 'toronto_weather'
  | 'keyword_breaking'
  | 'world_emergency'
  | 'culture_trend'
  | 'mylifeos_match';

export interface AlertSetting {
  id: string;
  triggerType: TriggerType;
  isEnabled: boolean;
  quietHoursStart: string;  // HH:MM
  quietHoursEnd: string;    // HH:MM
  dailyCount: number;
  dailyCountResetAt: string;
}

const MAX_DAILY_ALERTS = 3;

/**
 * 방해 금지 시간 여부 확인 (KST 기준)
 */
export function isQuietHours(
  quietStart: string,
  quietEnd: string,
  nowKST: Date = new Date()
): boolean {
  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);

  const nowMinutes = nowKST.getHours() * 60 + nowKST.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // 자정 경계를 넘는 경우 (예: 23:00 ~ 07:00)
  if (startMinutes > endMinutes) {
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

/**
 * 토론토 날씨 긴급 알림 트리거 체크
 */
export async function checkWeatherAlert(): Promise<boolean> {
  // TODO: Phase 2
  // 폭설(15cm+), 한파(-20도 이하), 폭풍 경보 체크
  return false;
}

/**
 * 알림 발송 (하루 최대 횟수 확인 후 발송)
 */
export async function sendAlert(
  setting: AlertSetting,
  message: string
): Promise<boolean> {
  if (!setting.isEnabled) return false;
  if (setting.dailyCount >= MAX_DAILY_ALERTS) return false;
  if (isQuietHours(setting.quietHoursStart, setting.quietHoursEnd)) return false;

  await sendMessage({ text: message });
  // TODO: Phase 2 — daily_count 업데이트
  return true;
}
