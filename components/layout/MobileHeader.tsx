// 모바일 헤더 컴포넌트
// 참조: docs/system/design-system.md §5.6, docs/specs/F-08-web-briefing-viewer/design.md §4.5

interface MobileHeaderProps {
  /** 현재 날짜 문자열 (YYYY년 M월 D일 형식) */
  dateLabel?: string;
}

/**
 * 오늘 날짜를 한국어 형식으로 포맷한다.
 * 서버 컴포넌트에서 호출 가능.
 */
function formatKoreanDate(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  return `${year}년 ${month}월 ${day}일`;
}

export function MobileHeader({ dateLabel }: MobileHeaderProps) {
  const displayDate = dateLabel ?? formatKoreanDate();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: '56px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E3DF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
      }}
    >
      {/* 앱 이름 */}
      <span
        style={{
          fontFamily: "'Noto Serif KR', Georgia, serif",
          fontSize: '20px',
          fontWeight: 700,
          color: '#1A1A1A',
          letterSpacing: '-0.01em',
        }}
      >
        Cortex
      </span>

      {/* 오늘 날짜 */}
      <span
        style={{
          fontSize: '14px',
          fontWeight: 400,
          color: '#5C5C5C',
        }}
        aria-label={`오늘 날짜: ${displayDate}`}
      >
        {displayDate}
      </span>
    </header>
  );
}
