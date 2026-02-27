// / — 오늘의 브리핑 메인 페이지
// 참조: docs/specs/F-08-web-briefing-viewer/design.md

import type { Metadata } from 'next';
import { BriefingCardList } from '@/components/briefing/BriefingCardList';

export const metadata: Metadata = {
  title: 'Cortex — 오늘의 브리핑',
  description: '개인화된 AI 브리핑',
};

export default function HomePage() {
  return (
    <>
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#1A1A1A',
          fontFamily: "'Noto Serif KR', Georgia, serif",
          marginBottom: '16px',
        }}
      >
        오늘의 브리핑
      </h1>

      {/* BriefingCardList: 로딩/에러/빈 상태 + 카드 목록 (AC1, AC2, AC3) */}
      <BriefingCardList />
    </>
  );
}
