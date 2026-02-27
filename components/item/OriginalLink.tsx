'use client';
// 원문 링크 버튼 컴포넌트
// 참조: docs/specs/F-09-web-item-detail/design.md §4.4

interface OriginalLinkProps {
  sourceUrl: string;
  contentId: string;
  briefingId: string | null;
}

export function OriginalLink({ sourceUrl, contentId, briefingId }: OriginalLinkProps) {
  // 원문 링크 클릭 시 '웹열기' interaction 기록 (비동기 백그라운드)
  function handleClick() {
    fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: contentId,
        briefing_id: briefingId,
        interaction: '웹열기',
        source: 'web',
      }),
    }).catch(() => {
      // 비동기 기록 실패는 무시 (UX에 영향 없음)
    });
  }

  return (
    <div
      style={{
        marginTop: '16px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <a
        data-testid="original-link"
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          height: '48px',
          width: '100%',
          maxWidth: '320px',
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 500,
          textDecoration: 'none',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        }}
      >
        원문 기사 읽기
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
