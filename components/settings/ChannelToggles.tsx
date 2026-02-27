'use client';
// 채널별 ON/OFF 토글 컴포넌트
// F-20 AC2: 채널(TECH/WORLD/CULTURE/TORONTO) ON/OFF 토글
// 기존 /api/settings/channels API (F-17) 활용

import { useState } from 'react';

export interface ChannelSettings {
  tech: boolean;
  world: boolean;
  culture: boolean;
  canada: boolean;
}

interface ChannelToggleProps {
  initialSettings: ChannelSettings;
}

// 채널 표시명 매핑
const CHANNEL_LABELS: Record<keyof ChannelSettings, string> = {
  tech: 'TECH',
  world: 'WORLD',
  culture: 'CULTURE',
  canada: 'TORONTO',
};

// 채널 이모지 매핑
const CHANNEL_EMOJIS: Record<keyof ChannelSettings, string> = {
  tech: '🖥️',
  world: '🌍',
  culture: '🎬',
  canada: '🍁',
};

export function ChannelToggles({ initialSettings }: ChannelToggleProps) {
  const [settings, setSettings] = useState<ChannelSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

  /** 채널 ON/OFF 토글 처리 */
  async function handleToggle(channel: keyof ChannelSettings) {
    const newSettings: ChannelSettings = {
      ...settings,
      [channel]: !settings[channel],
    };

    setSettings(newSettings);
    setSaving(true);

    try {
      await fetch('/api/settings/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {(Object.keys(settings) as Array<keyof ChannelSettings>).map((channel) => (
        <div
          key={channel}
          data-testid={`channel-toggle-${channel}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid #E5E3DF',
          }}
        >
          <label
            htmlFor={`channel-${channel}`}
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
            <span>{CHANNEL_EMOJIS[channel]}</span>
            <span>{CHANNEL_LABELS[channel]}</span>
          </label>
          <input
            id={`channel-${channel}`}
            type="checkbox"
            role="checkbox"
            aria-label={CHANNEL_LABELS[channel]}
            checked={settings[channel]}
            onChange={() => handleToggle(channel)}
            disabled={saving}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
        </div>
      ))}
    </div>
  );
}
