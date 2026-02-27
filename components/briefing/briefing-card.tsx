'use client';
// 브리핑 아이템 카드 컴포넌트

import { ChannelBadge } from './channel-badge';
import { FeedbackButtons } from './feedback-buttons';

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
  return (
    <article className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <ChannelBadge channel={channel} />
        <span className="text-xs text-gray-400">{source}</span>
      </div>

      <h2 className="text-base font-semibold text-gray-900 mb-1 leading-snug">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {title}
        </a>
      </h2>

      {summaryAi && (
        <p className="text-sm text-gray-600 mb-2">{summaryAi}</p>
      )}

      {reason && (
        <p className="text-xs text-indigo-600 mb-2">
          💡 {reason}
        </p>
      )}

      <FeedbackButtons
        contentId={contentId}
        briefingId={briefingId}
        currentInteraction={userInteraction ?? null}
      />
    </article>
  );
}
