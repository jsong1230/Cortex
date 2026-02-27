// /history — 브리핑 히스토리 + 저장 목록
// 참조: docs/specs/F-10-web-briefing-history/design.md §4.1

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HistoryView } from '@/components/history/HistoryView';

export const metadata: Metadata = {
  title: 'Cortex — 히스토리',
  description: '과거 브리핑과 저장 아이템 조회',
};

export default function HistoryPage() {
  return (
    <main
      style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '24px 16px',
      }}
    >
      {/* 페이지 제목 */}
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          lineHeight: 1.3,
          letterSpacing: '-0.02em',
          color: '#1A1A1A',
          marginBottom: '24px',
          fontFamily: "'Noto Serif KR', Georgia, serif",
        }}
      >
        히스토리
      </h1>

      {/* Suspense: useSearchParams() 사용으로 필요 */}
      <Suspense fallback={<div style={{ color: '#9E9E9E' }}>로딩 중...</div>}>
        <HistoryView />
      </Suspense>
    </main>
  );
}
