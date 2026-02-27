'use client';
// 아이템 상세 페이지 메인 컴포넌트 — 데이터 페칭 + 레이아웃
// 참조: docs/specs/F-09-web-item-detail/design.md §4.1, §5

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChannelBadge } from '@/components/briefing/ChannelBadge';
import { FeedbackButtons } from '@/components/briefing/FeedbackButtons';
import { AISummarySection } from './AISummarySection';
import { ItemMeta } from './ItemMeta';
import { OriginalLink } from './OriginalLink';
import { MemoInput } from './MemoInput';
import { RelatedItems } from './RelatedItems';

// API 응답 데이터 타입
interface RelatedItem {
  content_id: string;
  channel: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
}

interface ContentDetail {
  content_id: string;
  channel: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  tags: string[] | null;
  collected_at: string;
  reason: string | null;
  briefing_id: string | null;
  user_interaction: string | null;
  memo_text: string | null;
  related_items: RelatedItem[];
}

type ViewState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'not_found' }
  | { type: 'success'; data: ContentDetail };

interface ItemDetailViewProps {
  contentId: string;
}

export function ItemDetailView({ contentId }: ItemDetailViewProps) {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>({ type: 'loading' });

  useEffect(() => {
    async function fetchContent() {
      try {
        const response = await fetch(`/api/content/${contentId}`);
        const body = await response.json();

        if (response.status === 404) {
          setViewState({ type: 'not_found' });
          return;
        }

        if (!response.ok) {
          setViewState({
            type: 'error',
            message: body.error ?? '콘텐츠 조회 중 오류가 발생했습니다',
          });
          return;
        }

        if (body.success && body.data) {
          setViewState({ type: 'success', data: body.data as ContentDetail });
        } else {
          setViewState({
            type: 'error',
            message: '콘텐츠 데이터를 불러올 수 없습니다',
          });
        }
      } catch {
        setViewState({
          type: 'error',
          message: '네트워크 오류가 발생했습니다',
        });
      }
    }

    fetchContent();
  }, [contentId]);

  // 뒤로가기 핸들러
  function handleBack() {
    router.back();
  }

  // ─── 로딩 상태 ───────────────────────────────────────────────────────────
  if (viewState.type === 'loading') {
    return (
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '16px',
          paddingBottom: '72px',
        }}
      >
        {/* 스켈레톤 UI */}
        <div
          style={{
            height: '20px',
            width: '80px',
            backgroundColor: '#F3F2EF',
            borderRadius: '4px',
            marginBottom: '24px',
          }}
        />
        <div
          style={{
            height: '28px',
            width: '100%',
            backgroundColor: '#F3F2EF',
            borderRadius: '4px',
            marginBottom: '12px',
          }}
        />
        <div
          style={{
            height: '120px',
            width: '100%',
            backgroundColor: '#F3F2EF',
            borderRadius: '8px',
          }}
        />
      </div>
    );
  }

  // ─── 에러 상태 ───────────────────────────────────────────────────────────
  if (viewState.type === 'error') {
    return (
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '16px',
          textAlign: 'center',
          paddingTop: '48px',
        }}
      >
        <p style={{ color: '#DC2626', fontSize: '16px', marginBottom: '16px' }}>
          {viewState.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            height: '44px',
            padding: '0 24px',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  // ─── 찾을 수 없음 상태 ──────────────────────────────────────────────────
  if (viewState.type === 'not_found') {
    return (
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '16px',
          textAlign: 'center',
          paddingTop: '48px',
        }}
      >
        <p style={{ color: '#5C5C5C', fontSize: '16px', marginBottom: '16px' }}>
          해당 콘텐츠를 찾을 수 없습니다.
        </p>
        <button
          onClick={() => router.push('/')}
          style={{
            height: '44px',
            padding: '0 24px',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  // ─── 성공 상태 ───────────────────────────────────────────────────────────
  const { data } = viewState;

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '16px',
        paddingBottom: '72px',
      }}
    >
      {/* 뒤로가기 버튼 */}
      <button
        onClick={handleBack}
        style={{
          height: '44px',
          padding: '0 8px',
          backgroundColor: 'transparent',
          color: '#5C5C5C',
          border: 'none',
          fontSize: '16px',
          cursor: 'pointer',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span aria-hidden="true">←</span>
        <span className="hidden md:inline">브리핑으로 돌아가기</span>
        <span className="md:hidden">뒤로</span>
      </button>

      {/* 헤더: 채널 뱃지 + 소스명 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <ChannelBadge channel={data.channel} />
      </div>

      {/* 기사 제목 */}
      <h1
        data-testid="item-title"
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
        {data.title}
      </h1>

      {/* 메타 정보 (소스, 수집 시간, 태그) */}
      <ItemMeta
        source={data.source}
        collectedAt={data.collected_at}
        tags={data.tags}
      />

      {/* AI 요약 섹션 */}
      <AISummarySection summaryAi={data.summary_ai} channel={data.channel} />

      {/* My Life OS 연동 이유 힌트 */}
      {data.reason && (
        <div
          data-testid="reason-hint"
          style={{
            marginTop: '12px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '13px',
            color: '#92400E',
          }}
        >
          💡 {data.reason}
        </div>
      )}

      {/* 원문 링크 버튼 */}
      <OriginalLink
        sourceUrl={data.source_url}
        contentId={data.content_id}
        briefingId={data.briefing_id}
      />

      {/* 피드백 버튼 */}
      <FeedbackButtons
        contentId={data.content_id}
        briefingId={data.briefing_id ?? ''}
        currentInteraction={data.user_interaction}
      />

      {/* 메모 입력 */}
      <MemoInput
        contentId={data.content_id}
        briefingId={data.briefing_id}
        initialMemo={data.memo_text}
      />

      {/* 관련 아이템 */}
      <RelatedItems items={data.related_items} />
    </div>
  );
}
