'use client';
// 피드백 버튼 행 — 낙관적 업데이트 구현
// 참조: docs/system/design-system.md §2.3, docs/specs/F-08-web-briefing-viewer/design.md §4.3

import { useState } from 'react';

// 버튼 설정
interface ButtonConfig {
  label: string;
  emoji: string;
  interaction: string;
  activeBg: string;
  activeColor: string;
}

const BUTTON_CONFIGS: ButtonConfig[] = [
  {
    label: '좋아요',
    emoji: '👍',
    interaction: '좋아요',
    activeBg: '#DBEAFE',
    activeColor: '#2563EB',
  },
  {
    label: '싫어요',
    emoji: '👎',
    interaction: '싫어요',
    activeBg: '#FEE2E2',
    activeColor: '#DC2626',
  },
  {
    label: '저장',
    emoji: '🔖',
    interaction: '저장',
    activeBg: '#FEF3C7',
    activeColor: '#D97706',
  },
  {
    label: '메모',
    emoji: '💬',
    interaction: '메모',
    activeBg: '#F5F3FF',
    activeColor: '#7C3AED',
  },
];

export interface FeedbackButtonsProps {
  contentId: string;
  briefingId: string;
  currentInteraction: string | null;
}

export function FeedbackButtons({
  contentId,
  briefingId,
  currentInteraction,
}: FeedbackButtonsProps) {
  // 낙관적 업데이트를 위한 로컬 상태
  const [activeInteraction, setActiveInteraction] = useState<string | null>(
    currentInteraction
  );
  const [isPending, setIsPending] = useState(false);

  async function handleFeedback(interaction: string) {
    if (isPending) return;

    // 이전 상태 백업 (API 실패 시 복구용)
    const previousInteraction = activeInteraction;

    // 같은 반응 재클릭 → 토글(취소)
    const nextInteraction =
      activeInteraction === interaction ? null : interaction;

    // 낙관적 업데이트: 즉시 UI 변경
    setActiveInteraction(nextInteraction);
    setIsPending(true);

    try {
      const response = await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_id: contentId,
          briefing_id: briefingId,
          interaction,
          source: 'web',
        }),
      });

      if (!response.ok) {
        // API 실패 시 원상 복구
        setActiveInteraction(previousInteraction);
      }
    } catch {
      // 네트워크 오류 시 원상 복구
      setActiveInteraction(previousInteraction);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        marginTop: '12px',
      }}
      role="group"
      aria-label="피드백 버튼"
    >
      {BUTTON_CONFIGS.map(({ label, emoji, interaction, activeBg, activeColor }) => {
        const isActive = activeInteraction === interaction;

        return (
          <button
            key={interaction}
            onClick={() => handleFeedback(interaction)}
            aria-pressed={isActive}
            aria-label={label}
            disabled={isPending}
            style={{
              flex: 1,
              height: '44px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              border: 'none',
              borderRadius: '8px',
              cursor: isPending ? 'not-allowed' : 'pointer',
              backgroundColor: isActive ? activeBg : '#F3F2EF',
              color: isActive ? activeColor : '#5C5C5C',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'background-color 0.15s ease',
              opacity: isPending ? 0.7 : 1,
              minWidth: 0,
              padding: '0 4px',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }} aria-hidden="true">
              {emoji}
            </span>
            <span style={{ fontSize: '11px', lineHeight: 1 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
