// F-08 FeedbackButtons 낙관적 업데이트 단위 테스트
// test-spec.md U-08-05

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackButtons } from '@/components/briefing/FeedbackButtons';

const CONTENT_ID = 'content-uuid-001';
const BRIEFING_ID = 'briefing-uuid-001';

// ─── fetch 모킹 ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── U-08-05: 낙관적 업데이트 ───────────────────────────────────────────────

describe('FeedbackButtons — 낙관적 업데이트 (U-08-05)', () => {
  it('U-08-05-1: 좋아요 버튼 클릭 시 즉시 활성 aria-pressed로 변경된다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'new-uuid', interaction: '좋아요' } }),
    });

    render(
      <FeedbackButtons
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        currentInteraction={null}
      />
    );

    const likeButton = screen.getByRole('button', { name: /좋아요/ });
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(likeButton);

    // 즉시(동기) 상태 변경 확인
    expect(likeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('U-08-05-2: 싫어요 버튼 클릭 시 즉시 활성 aria-pressed로 변경된다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'new-uuid', interaction: '싫어요' } }),
    });

    render(
      <FeedbackButtons
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        currentInteraction={null}
      />
    );

    const dislikeButton = screen.getByRole('button', { name: /싫어요/ });
    fireEvent.click(dislikeButton);

    expect(dislikeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('U-08-05-3: 저장 버튼 클릭 시 즉시 활성 aria-pressed로 변경된다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'new-uuid', interaction: '저장' } }),
    });

    render(
      <FeedbackButtons
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        currentInteraction={null}
      />
    );

    const saveButton = screen.getByRole('button', { name: /저장/ });
    fireEvent.click(saveButton);

    expect(saveButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('U-08-05-4: 메모 버튼 클릭 시 즉시 활성 aria-pressed로 변경된다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'new-uuid', interaction: '메모' } }),
    });

    render(
      <FeedbackButtons
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        currentInteraction={null}
      />
    );

    const memoButton = screen.getByRole('button', { name: /메모/ });
    fireEvent.click(memoButton);

    expect(memoButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('U-08-05-5: 버튼 클릭 시 /api/interactions POST가 올바른 payload로 호출된다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'new-uuid', interaction: '좋아요' } }),
    });

    render(
      <FeedbackButtons
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        currentInteraction={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /좋아요/ }));

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
            interaction: '좋아요',
            source: 'web',
          }),
        })
      );
    });
  });

  it('U-08-05-6: API 실패 시 원상 복구된다 (aria-pressed가 false로 돌아온다)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ success: false, error: 'Server Error' }),
    });

    render(
      <FeedbackButtons
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        currentInteraction={null}
      />
    );

    const likeButton = screen.getByRole('button', { name: /좋아요/ });
    fireEvent.click(likeButton);

    // 즉시 활성 상태
    expect(likeButton).toHaveAttribute('aria-pressed', 'true');

    // API 실패 후 원상 복구
    await waitFor(() => {
      expect(likeButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('U-08-05-7: 이미 같은 반응이 있으면 토글(취소)된다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(
      <FeedbackButtons
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        currentInteraction="좋아요"
      />
    );

    const likeButton = screen.getByRole('button', { name: /좋아요/ });
    // 초기 상태: 활성
    expect(likeButton).toHaveAttribute('aria-pressed', 'true');

    // 같은 버튼 재클릭 → 비활성으로 토글
    fireEvent.click(likeButton);
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('U-08-05-8: currentInteraction이 있으면 해당 버튼이 활성 상태로 초기 렌더링된다', () => {
    render(
      <FeedbackButtons
        contentId={CONTENT_ID}
        briefingId={BRIEFING_ID}
        currentInteraction="저장"
      />
    );

    const saveButton = screen.getByRole('button', { name: /저장/ });
    const likeButton = screen.getByRole('button', { name: /좋아요/ });

    expect(saveButton).toHaveAttribute('aria-pressed', 'true');
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
  });
});
