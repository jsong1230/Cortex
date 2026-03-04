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
      <h1 className="mb-4 font-serif text-2xl font-bold tracking-tight text-[#1A1A1A]">
        오늘의 브리핑
      </h1>

      {/* BriefingCardList: 로딩/에러/빈 상태 + 카드 목록 (AC1, AC2, AC3) */}
      <BriefingCardList />
    </>
  );
}
