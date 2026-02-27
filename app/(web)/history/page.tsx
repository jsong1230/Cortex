// /history — 브리핑 히스토리 + 저장 목록
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cortex — 히스토리',
};

export default function HistoryPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">브리핑 히스토리</h1>
        {/* TODO: Phase 1 — 날짜별 브리핑 목록 + 저장한 아이템 목록 */}
        <p className="text-gray-500">히스토리를 불러오는 중...</p>
      </div>
    </main>
  );
}
