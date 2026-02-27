// 긴급 알림 트리거 로직 — F-15
// AC1: 1시간 Cron 체크
// AC2: 토론토 날씨 경보 (폭설 15cm+, 한파 -20도, 폭풍 경보)
// AC3: HN 500+ 포인트 × interest_profile 상위 3개 토픽
// AC4: 당일 중복 방지 (alert_log 조회)
// AC5: 하루 최대 3회 하드 캡
// AC6: 방해 금지 시간(23:00~07:00) 발송 차단
// AC7: alert_settings 테이블 트리거별 ON/OFF

import { sendMessage } from './telegram';
import { getTorontoWeather, evaluateWeatherAlert } from './collectors/weather';
import { createServerClient } from './supabase/server';

export type TriggerType =
  | 'toronto_weather'
  | 'keyword_breaking'
  | 'world_emergency'
  | 'culture_trend'
  | 'mylifeos_match';

export interface AlertTrigger {
  type: TriggerType;
  title: string;
  message: string;
  sourceUrl?: string;
  contentId?: string;
}

export interface AlertSetting {
  id: string;
  trigger_type: TriggerType;
  is_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  last_triggered_at: string | null;
  daily_count: number;
  daily_count_reset_at: string;
}

export interface ProcessResult {
  triggered: number;
  skipped: string[];
  errors: string[];
}

type SupabaseClient = ReturnType<typeof createServerClient>;

const MAX_DAILY_ALERTS = 3;
const HN_HIGH_SCORE_THRESHOLD = 0.85;

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

  if (startMinutes > endMinutes) {
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

export async function checkDailyAlertCount(supabase: SupabaseClient): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartISO = todayStart.toISOString();

  const { data, error } = await supabase
    .from('alert_log')
    .select('id')
    .gte('sent_at', todayStartISO);

  if (error || data === null) {
    return false;
  }

  return data.length < MAX_DAILY_ALERTS;
}

export async function hasDuplicateAlert(
  supabase: SupabaseClient,
  triggerType: TriggerType,
  contentId: string | null
): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartISO = todayStart.toISOString();

  const { data, error } = await supabase
    .from('alert_log')
    .select('*')
    .eq('trigger_type', triggerType)
    .eq('content_id', contentId)
    .gte('sent_at', todayStartISO);

  if (error || data === null) {
    return false;
  }

  return data.length > 0;
}

async function logAlert(
  supabase: SupabaseClient,
  trigger: AlertTrigger
): Promise<void> {
  await supabase.from('alert_log').insert({
    trigger_type: trigger.type,
    title: trigger.title,
    message: trigger.message,
    content_id: trigger.contentId ?? null,
    source_url: trigger.sourceUrl ?? null,
  });
}

function formatAlertMessage(trigger: AlertTrigger): string {
  const lines: string[] = [];
  lines.push('⚠️ <b>긴급 알림</b>');
  lines.push('');
  lines.push(`<b>${trigger.title}</b>`);
  lines.push(trigger.message);

  if (trigger.sourceUrl) {
    lines.push('');
    lines.push(`🔗 <a href="${trigger.sourceUrl}">자세히 보기</a>`);
  }

  return lines.join('\n');
}

export async function checkTorontoWeatherAlert(): Promise<AlertTrigger | null> {
  try {
    const weather = await getTorontoWeather();
    const condition = evaluateWeatherAlert(weather);

    if (!condition.isBlizzard && !condition.isColdSnap && !condition.hasStorm) {
      return null;
    }

    if (condition.isBlizzard) {
      return {
        type: 'toronto_weather',
        title: '토론토 폭설 경보',
        message: `현재 강설량 ${weather.snow ?? 0}mm, 현재기온 ${weather.temperature}°C. 외출 시 주의하세요.`,
      };
    }

    if (condition.isColdSnap) {
      return {
        type: 'toronto_weather',
        title: '토론토 한파 경보',
        message: `현재기온 ${weather.temperature}°C (체감 ${weather.feelsLike}°C). 방한 준비가 필요합니다.`,
      };
    }

    if (condition.hasStorm) {
      return {
        type: 'toronto_weather',
        title: '토론토 폭풍 경보',
        message: `기상 경보 발령 중. 현재기온 ${weather.temperature}°C, 풍속 ${weather.windSpeed}m/s. 외출 자제 권고.`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function checkKeywordBreaking(supabase: SupabaseClient): Promise<AlertTrigger | null> {
  try {
    const { data: topTopics, error: topicsError } = await supabase
      .from('interest_profile')
      .select('topic, score')
      .order('score', { ascending: false })
      .limit(3);

    if (topicsError || !topTopics || topTopics.length === 0) {
      return null;
    }

    const topicNames = (topTopics as Array<{ topic: string; score: number }>).map((t) => t.topic);

    const { data: hnItems, error: hnError } = await supabase
      .from('content_items')
      .select('id, title, source_url, tags, score_initial')
      .eq('source', 'hackernews')
      .overlaps('tags', topicNames)
      .gt('score_initial', HN_HIGH_SCORE_THRESHOLD);

    if (hnError || !hnItems || hnItems.length === 0) {
      return null;
    }

    type HNItem = { id: string; title: string; source_url: string; tags: string[] | null; score_initial: number };
    const items = hnItems as HNItem[];

    const topItem = items.reduce(
      (best, item) => (item.score_initial > best.score_initial ? item : best),
      items[0]
    );

    const matchedTopic =
      topicNames.find((topic) =>
        (topItem.tags ?? []).some((tag) => tag.toLowerCase().includes(topic.toLowerCase()))
      ) ?? topicNames[0];

    return {
      type: 'keyword_breaking',
      title: `[${matchedTopic}] HN 속보`,
      message: topItem.title,
      sourceUrl: topItem.source_url,
      contentId: topItem.id,
    };
  } catch {
    return null;
  }
}

export async function sendAlert(
  supabase: SupabaseClient,
  setting: Pick<AlertSetting, 'trigger_type' | 'is_enabled' | 'quiet_hours_start' | 'quiet_hours_end'>,
  trigger: AlertTrigger
): Promise<{ sent: boolean; reason?: string }> {
  if (!setting.is_enabled) {
    return { sent: false, reason: 'disabled' };
  }

  const nowKST = new Date();
  if (isQuietHours(setting.quiet_hours_start, setting.quiet_hours_end, nowKST)) {
    return { sent: false, reason: 'quiet_hours' };
  }

  const canSend = await checkDailyAlertCount(supabase);
  if (!canSend) {
    return { sent: false, reason: 'daily_cap' };
  }

  const isDuplicate = await hasDuplicateAlert(
    supabase,
    trigger.type,
    trigger.contentId ?? null
  );
  if (isDuplicate) {
    return { sent: false, reason: 'duplicate' };
  }

  const text = formatAlertMessage(trigger);
  await sendMessage({ text });

  await logAlert(supabase, trigger);

  return { sent: true };
}

export async function processAlertTriggers(): Promise<ProcessResult> {
  const supabase = createServerClient();
  const result: ProcessResult = {
    triggered: 0,
    skipped: [],
    errors: [],
  };

  try {
    const { data: settings, error: settingsError } = await supabase
      .from('alert_settings')
      .select('trigger_type, is_enabled, quiet_hours_start, quiet_hours_end')
      .order('trigger_type');

    if (settingsError || !settings) {
      result.errors.push(`alert_settings 조회 실패: ${settingsError?.message ?? 'unknown'}`);
      return result;
    }

    type SettingRow = Pick<AlertSetting, 'trigger_type' | 'is_enabled' | 'quiet_hours_start' | 'quiet_hours_end'>;
    const settingsMap = new Map<TriggerType, SettingRow>();
    for (const s of settings as SettingRow[]) {
      settingsMap.set(s.trigger_type, s);
    }

    const weatherSetting = settingsMap.get('toronto_weather');
    if (weatherSetting?.is_enabled) {
      try {
        const weatherTrigger = await checkTorontoWeatherAlert();
        if (weatherTrigger) {
          const sendResult = await sendAlert(supabase, weatherSetting, weatherTrigger);
          if (sendResult.sent) {
            result.triggered++;
          } else {
            result.skipped.push(`toronto_weather: ${sendResult.reason}`);
          }
        }
      } catch (e) {
        result.errors.push(`toronto_weather 오류: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const keywordSetting = settingsMap.get('keyword_breaking');
    if (keywordSetting?.is_enabled) {
      try {
        const keywordTrigger = await checkKeywordBreaking(supabase);
        if (keywordTrigger) {
          const sendResult = await sendAlert(supabase, keywordSetting, keywordTrigger);
          if (sendResult.sent) {
            result.triggered++;
          } else {
            result.skipped.push(`keyword_breaking: ${sendResult.reason}`);
          }
        }
      } catch (e) {
        result.errors.push(`keyword_breaking 오류: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

  } catch (e) {
    result.errors.push(`processAlertTriggers 오류: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}
