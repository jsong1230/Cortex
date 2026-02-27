// 채널 뱃지 컴포넌트 (TECH / WORLD / CULTURE / TORONTO / 세렌디피티)

const CHANNEL_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  tech:        { label: 'TECH',   emoji: '🖥️', color: 'bg-blue-100 text-blue-800' },
  world:       { label: 'WORLD',  emoji: '🌍', color: 'bg-green-100 text-green-800' },
  culture:     { label: 'CULTURE', emoji: '🎬', color: 'bg-purple-100 text-purple-800' },
  canada:      { label: 'TORONTO', emoji: '🍁', color: 'bg-red-100 text-red-800' },
  serendipity: { label: '세렌디피티', emoji: '🎲', color: 'bg-yellow-100 text-yellow-800' },
};

interface ChannelBadgeProps {
  channel: string;
}

export function ChannelBadge({ channel }: ChannelBadgeProps) {
  const config = CHANNEL_CONFIG[channel] ?? {
    label: channel.toUpperCase(),
    emoji: '📌',
    color: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.emoji} {config.label}
    </span>
  );
}
