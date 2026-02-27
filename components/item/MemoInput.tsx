'use client';
// 메모 입력 + 저장 컴포넌트
// 참조: docs/specs/F-09-web-item-detail/design.md §4.5

import { useState } from 'react';

export interface MemoInputProps {
  contentId: string;
  briefingId: string | null;
  initialMemo: string | null;
}

export function MemoInput({ contentId, briefingId, initialMemo }: MemoInputProps) {
  const [memoText, setMemoText] = useState<string>(initialMemo ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // 토스트 표시 후 2초 뒤 자동 숨김
  function showToast(message: string, error = false) {
    setToastMessage(message);
    setIsError(error);
    setTimeout(() => {
      setToastMessage(null);
      setIsError(false);
    }, 2000);
  }

  async function handleSave() {
    if (!memoText.trim() || isSaving) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_id: contentId,
          briefing_id: briefingId,
          interaction: '메모',
          memo_text: memoText,
          source: 'web',
        }),
      });

      if (response.ok) {
        showToast('메모가 저장되었습니다');
      } else {
        showToast('저장 실패: 다시 시도해 주세요', true);
      }
    } catch {
      showToast('저장 실패: 네트워크 오류가 발생했습니다', true);
    } finally {
      setIsSaving(false);
    }
  }

  const isButtonDisabled = !memoText.trim() || isSaving;

  return (
    <section style={{ marginTop: '24px' }}>
      {/* 섹션 제목 */}
      <h2
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#1A1A1A',
          marginBottom: '8px',
        }}
      >
        메모
      </h2>

      {/* 메모 textarea */}
      <textarea
        data-testid="memo-textarea"
        value={memoText}
        onChange={(e) => setMemoText(e.target.value)}
        placeholder="이 아이템에 대한 메모를 남겨보세요..."
        style={{
          width: '100%',
          minHeight: '120px',
          maxHeight: '300px',
          backgroundColor: '#F3F2EF',
          border: '1px solid #E5E3DF',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '16px',
          lineHeight: 1.7,
          color: '#1A1A1A',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = '2px solid #7C3AED';
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = '1px solid #E5E3DF';
        }}
      />

      {/* 저장 버튼 */}
      <button
        data-testid="memo-save"
        onClick={handleSave}
        disabled={isButtonDisabled}
        style={{
          marginTop: '8px',
          height: '44px',
          width: '100%',
          backgroundColor: isButtonDisabled ? '#C4B5FD' : '#7C3AED',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 500,
          cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.15s ease',
        }}
      >
        {isSaving ? '저장 중...' : '저장'}
      </button>

      {/* 토스트 메시지 */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: isError ? '#FEE2E2' : '#ECFDF5',
            color: isError ? '#DC2626' : '#065F46',
            border: isError ? '1px solid #FCA5A5' : '1px solid #6EE7B7',
          }}
        >
          {toastMessage}
        </div>
      )}
    </section>
  );
}
