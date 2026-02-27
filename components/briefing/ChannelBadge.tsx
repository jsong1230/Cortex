// 채널 뱃지 컴포넌트 (TECH / WORLD / CULTURE / TORONTO / 세렌디피티)
// 참조: docs/system/design-system.md §2.2, docs/specs/F-08-web-briefing-viewer/design.md §4.2

interface ChannelConfig {
  label: string;
  emoji: string;
  badgeBg: string;
  badgeText: string;
  accentColor: string;
}

const CHANNEL_CONFIG: Record<string, ChannelConfig> = {
  tech: {
    label: 'TECH',
    emoji: '🖥️',
    badgeBg: '#EBF2FF',
    badgeText: '#1D4ED8',
    accentColor: '#2563EB',
  },
  world: {
    label: 'WORLD',
    emoji: '🌍',
    badgeBg: '#ECFDF5',
    badgeText: '#065F46',
    accentColor: '#059669',
  },
  culture: {
    label: 'CULTURE',
    emoji: '🎬',
    badgeBg: '#F5F3FF',
    badgeText: '#5B21B6',
    accentColor: '#7C3AED',
  },
  canada: {
    label: 'TORONTO',
    emoji: '🍁',
    badgeBg: '#FFF7ED',
    badgeText: '#C2410C',
    accentColor: '#EA580C',
  },
  serendipity: {
    label: '세렌디피티',
    emoji: '🎲',
    badgeBg: '#FFFBEB',
    badgeText: '#92400E',
    accentColor: '#D97706',
  },
};

const FALLBACK_CONFIG: Omit<ChannelConfig, 'label'> = {
  emoji: '📌',
  badgeBg: '#F3F2EF',
  badgeText: '#5C5C5C',
  accentColor: '#9E9E9E',
};

interface ChannelBadgeProps {
  channel: string;
}

export function ChannelBadge({ channel }: ChannelBadgeProps) {
  const config = CHANNEL_CONFIG[channel];
  const label = config?.label ?? channel.toUpperCase();
  const emoji = config?.emoji ?? FALLBACK_CONFIG.emoji;
  const badgeBg = config?.badgeBg ?? FALLBACK_CONFIG.badgeBg;
  const badgeText = config?.badgeText ?? FALLBACK_CONFIG.badgeText;

  return (
    <span
      style={{
        backgroundColor: badgeBg,
        color: badgeText,
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        lineHeight: 1,
      }}
    >
      <span aria-hidden="true">{emoji}</span>
      {label}
    </span>
  );
}

/**
 * 채널의 포인트색(왼쪽 보더용)을 반환한다.
 */
export function getChannelAccentColor(channel: string): string {
  return CHANNEL_CONFIG[channel]?.accentColor ?? FALLBACK_CONFIG.accentColor;
}
