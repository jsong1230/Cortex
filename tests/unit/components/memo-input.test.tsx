// F-09 MemoInput 단위 테스트
// test-spec.md D-08

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoInput } from '@/components/item/MemoInput';

const CONTENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const BRIEFING_ID = '770e8400-e29b-41d4-a716-446655440002';

// ─── fetch 모킹 ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── D-08: 메모 저장 (AC3) ──────────────────────────────────────────────────

describe('MemoInput — 메모 저장 (D-08)', () => {
  it('D-08-1: textarea가 렌더링된다', () => {
    render(
      <MemoInput
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        initialMemo={null}
      />
    );

    expect(screen.getByTestId('memo-textarea')).toBeInTheDocument();
  });

  it('D-08-2: 저장 버튼이 렌더링된다', () => {
    render(
      <MemoInput
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        initialMemo={null}
      />
    );

    expect(screen.getByTestId('memo-save')).toBeInTheDocument();
  });

  it('D-08-3: 기존 메모가 있으면 textarea에 pre-fill된다', () => {
    render(
      <MemoInput
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        initialMemo="기존 메모 내용"
      />
    );

    const textarea = screen.getByTestId('memo-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('기존 메모 내용');
  });

  it('D-08-4: 빈 메모로 저장 시도 시 버튼이 비활성화된다', () => {
    render(
      <MemoInput
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        initialMemo={null}
      />
    );

    const saveButton = screen.getByTestId('memo-save') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('D-08-5: 저장 클릭 시 POST /api/interactions가 호출된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'interaction-uuid', interaction: '메모' } }),
    });

    render(
      <MemoInput
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        initialMemo={null}
      />
    );

    const textarea = screen.getByTestId('memo-textarea');
    fireEvent.change(textarea, { target: { value: '새 메모 내용' } });

    const saveButton = screen.getByTestId('memo-save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/interactions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            content_id: CONTENT_ID,
            briefing_id: BRIEFING_ID,
            interaction: '메모',
            memo_text: '새 메모 내용',
            source: 'web',
          }),
        })
      );
    });
  });

  it('D-08-6: 저장 성공 시 토스트가 표시된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'interaction-uuid', interaction: '메모' } }),
    });

    render(
      <MemoInput
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        initialMemo={null}
      />
    );

    const textarea = screen.getByTestId('memo-textarea');
    fireEvent.change(textarea, { target: { value: '저장할 메모' } });

    const saveButton = screen.getByTestId('memo-save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('메모가 저장되었습니다')).toBeInTheDocument();
    });
  });

  it('D-08-7: 저장 실패 시 에러 토스트가 표시된다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ success: false, error: '서버 오류' }),
    });

    render(
      <MemoInput
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        initialMemo={null}
      />
    );

    const textarea = screen.getByTestId('memo-textarea');
    fireEvent.change(textarea, { target: { value: '저장할 메모' } });

    const saveButton = screen.getByTestId('memo-save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/저장 실패/)).toBeInTheDocument();
    });
  });

  it('D-08-8: 저장 중 버튼이 비활성화된다', async () => {
    // fetch가 지연되어 있는 동안 버튼 상태 확인
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(pendingPromise);

    render(
      <MemoInput
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        initialMemo={null}
      />
    );

    const textarea = screen.getByTestId('memo-textarea');
    fireEvent.change(textarea, { target: { value: '저장할 메모' } });

    const saveButton = screen.getByTestId('memo-save') as HTMLButtonElement;
    fireEvent.click(saveButton);

    // 저장 중에는 비활성화
    expect(saveButton.disabled).toBe(true);

    // 프로미스 해결
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });
});
