'use client';
// 피드백 버튼 행 (좋아요 / 싫어요 / 저장 / 웹 보기)
// TODO: Phase 1 — /api/interactions POST 연동

interface FeedbackButtonsProps {
  contentId: string;
  briefingId: string;
  currentInteraction: string | null;
}

const BUTTONS = [
  { label: '👍', interaction: '좋아요', title: '좋아요' },
  { label: '👎', interaction: '싫어요', title: '싫어요' },
  { label: '🔖', interaction: '저장', title: '저장' },
];

export function FeedbackButtons({
  contentId,
  briefingId,
  currentInteraction,
}: FeedbackButtonsProps) {
  async function handleFeedback(interaction: string) {
    // TODO: Phase 1 — API 연동
    void contentId;
    void briefingId;
    void interaction;
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      {BUTTONS.map(({ label, interaction, title }) => (
        <button
          key={interaction}
          onClick={() => handleFeedback(interaction)}
          title={title}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            currentInteraction === interaction
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
