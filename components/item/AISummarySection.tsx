// AI 요약 전문 섹션 컴포넌트
// 참조: docs/specs/F-09-web-item-detail/design.md §4.2

import { getChannelAccentColor } from '@/components/briefing/ChannelBadge';

interface AISummarySectionProps {
  summaryAi: string | null;
  channel: string;
}

export function AISummarySection({ summaryAi, channel }: AISummarySectionProps) {
  const accentColor = getChannelAccentColor(channel);

  return (
    <div style={{ marginTop: '16px' }}>
      <p
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: '#5C5C5C',
          marginBottom: '8px',
        }}
      >
        AI 요약
      </p>

      <div
        style={{
          backgroundColor: '#F8F7F4',
          borderRadius: '12px',
          padding: '16px 20px',
          borderLeft: `3px solid ${accentColor}`,
        }}
      >
        {summaryAi ? (
          <p
            data-testid="ai-summary"
            style={{
              fontSize: '16px',
              lineHeight: 1.7,
              color: '#1A1A1A',
              margin: 0,
            }}
          >
            {summaryAi}
          </p>
        ) : (
          <p
            data-testid="ai-summary-empty"
            style={{
              fontSize: '16px',
              lineHeight: 1.7,
              color: '#9E9E9E',
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            요약 없음
          </p>
        )}
      </div>
    </div>
  );
}
