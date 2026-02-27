'use client';
// 긴급 알림 설정 컴포넌트
// F-20 AC3: 트리거별 ON/OFF 토글
// F-20 AC4: 방해 금지 시간대 설정
// 기존 /api/alerts/settings API (F-15) 활용

import { useState } from 'react';

export interface AlertSetting {
  id: string;
  trigger_type: string;
  is_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

interface AlertSettingsProps {
  initialSettings: AlertSetting[];
}

// 트리거 표시명 매핑
const TRIGGER_LABELS: Record<string, string> = {
  toronto_weather: '토론토 날씨 경보',
  keyword_breaking: '관심 키워드 속보',
  world_emergency: '세계 긴급 뉴스',
  culture_trend: '문화 트렌드',
  mylifeos_match: 'My Life OS 매칭',
};

// 트리거 이모지 매핑
const TRIGGER_EMOJIS: Record<string, string> = {
  toronto_weather: '🌨️',
  keyword_breaking: '🔔',
  world_emergency: '🚨',
  culture_trend: '🎬',
  mylifeos_match: '💡',
};

export function AlertSettings({ initialSettings }: AlertSettingsProps) {
  const [settings, setSettings] = useState<AlertSetting[]>(initialSettings);
  const [saving, setSaving] = useState<string | null>(null); // 저장 중인 trigger_type

  // 방해 금지 시간대는 모든 트리거에 공통 적용
  // 첫 번째 설정값을 기준으로 초기화
  const firstSetting = initialSettings[0];
  const [quietStart, setQuietStart] = useState(firstSetting?.quiet_hours_start ?? '23:00');
  const [quietEnd, setQuietEnd] = useState(firstSetting?.quiet_hours_end ?? '07:00');

  /** 트리거 ON/OFF 토글 처리 */
  async function handleToggle(triggerType: string) {
    const target = settings.find((s) => s.trigger_type === triggerType);
    if (!target) return;

    const newEnabled = !target.is_enabled;
    setSettings((prev) =>
      prev.map((s) =>
        s.trigger_type === triggerType ? { ...s, is_enabled: newEnabled } : s
      )
    );

    setSaving(triggerType);
    try {
      await fetch('/api/alerts/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_type: triggerType,
          is_enabled: newEnabled,
        }),
      });
    } finally {
      setSaving(null);
    }
  }

  /** 방해 금지 시간 변경 처리 — 모든 트리거에 일괄 적용 */
  async function handleQuietHoursChange(start: string, end: string) {
    setQuietStart(start);
    setQuietEnd(end);

    // 모든 트리거에 방해 금지 시간 일괄 적용
    for (const setting of settings) {
      await fetch('/api/alerts/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_type: setting.trigger_type,
          is_enabled: setting.is_enabled,
          quiet_hours_start: start,
          quiet_hours_end: end,
        }),
      });
    }
  }

  return (
    <div>
      {/* 트리거별 ON/OFF 토글 */}
      {settings.map((setting) => (
        <div
          key={setting.trigger_type}
          data-testid={`alert-toggle-${setting.trigger_type}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid #E5E3DF',
          }}
        >
          <label
            htmlFor={`alert-${setting.trigger_type}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '16px',
              fontWeight: 500,
              color: '#1A1A1A',
              cursor: 'pointer',
            }}
          >
            <span>{TRIGGER_EMOJIS[setting.trigger_type] ?? '🔔'}</span>
            <span>{TRIGGER_LABELS[setting.trigger_type] ?? setting.trigger_type}</span>
          </label>
          <input
            id={`alert-${setting.trigger_type}`}
            type="checkbox"
            role="checkbox"
            aria-label={setting.trigger_type}
            checked={setting.is_enabled}
            onChange={() => handleToggle(setting.trigger_type)}
            disabled={saving === setting.trigger_type}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
        </div>
      ))}

      {/* 방해 금지 시간대 설정 (AC4) */}
      <div style={{ marginTop: '20px' }}>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#5C5C5C',
            marginBottom: '12px',
          }}
        >
          방해 금지 시간대
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="quiet-hours-start"
              style={{ fontSize: '13px', color: '#5C5C5C' }}
            >
              시작
            </label>
            <input
              id="quiet-hours-start"
              data-testid="quiet-hours-start"
              type="time"
              value={quietStart}
              onChange={(e) => handleQuietHoursChange(e.target.value, quietEnd)}
              style={{
                padding: '6px 10px',
                border: '1px solid #E5E3DF',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#1A1A1A',
              }}
            />
          </div>
          <span style={{ color: '#5C5C5C', marginTop: '20px' }}>~</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="quiet-hours-end"
              style={{ fontSize: '13px', color: '#5C5C5C' }}
            >
              종료
            </label>
            <input
              id="quiet-hours-end"
              data-testid="quiet-hours-end"
              type="time"
              value={quietEnd}
              onChange={(e) => handleQuietHoursChange(quietStart, e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1px solid #E5E3DF',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#1A1A1A',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
