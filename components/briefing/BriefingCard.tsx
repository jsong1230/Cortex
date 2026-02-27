'use client';
// 브리핑 아이템 카드 컴포넌트
// 참조: docs/system/design-system.md §5.1, docs/specs/F-08-web-briefing-viewer/design.md §4.1

import { ChannelBadge, getChannelAccentColor } from './ChannelBadge';
import { FeedbackButtons } from './FeedbackButtons';

export interface BriefingCardProps {
  contentId: string;
  briefingId: string;
  channel: string;
  title: string;
  summaryAi: string | null;
  source: string;
  sourceUrl: string;
  reason?: string | null;
  userInteraction?: string | null;
}

export function BriefingCard({
  contentId,
  briefingId,
  channel,
  title,
  summaryAi,
  source,
  sourceUrl,
  reason,
  userInteraction,
}: BriefingCardProps) {
  const accentColor = getChannelAccentColor(channel);

  return (
    <article
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E3DF',
        borderRadius: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        borderLeft: `4px solid ${accentColor}`,
        padding: '16px',
        marginBottom: '12px',
      }}
    >
      {/* 헤더: 채널 뱃지 + 소스명 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <ChannelBadge channel={channel} />
        <span
          style={{
            fontSize: '14px',
            color: '#5C5C5C',
            fontWeight: 400,
          }}
        >
          {source}
        </span>
      </div>

      {/* 기사 제목 */}
      <h2
        data-testid="briefing-title"
        style={{
          fontSize: '20px',
          fontWeight: 700,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
          color: '#1A1A1A',
          marginBottom: '8px',
          fontFamily: "'Noto Serif KR', Georgia, serif",
        }}
      >
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          {title}
        </a>
      </h2>

      {/* AI 요약 */}
      {summaryAi && (
        <p
          data-testid="briefing-summary"
          style={{
            fontSize: '16px',
            fontWeight: 400,
            lineHeight: 1.7,
            color: '#5C5C5C',
            marginBottom: '8px',
          }}
        >
          {summaryAi}
        </p>
      )}

      {/* My Life OS 연동 이유 힌트 (AC5) */}
      {reason && (
        <div
          data-testid="reason-hint"
          style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '6px',
            padding: '6px 10px',
            marginBottom: '8px',
            fontSize: '13px',
            color: '#92400E',
          }}
        >
          💡 {reason}
        </div>
      )}

      {/* 피드백 버튼 행 */}
      <FeedbackButtons
        contentId={contentId}
        briefingId={briefingId}
        currentInteraction={userInteraction ?? null}
      />
    </article>
  );
}
