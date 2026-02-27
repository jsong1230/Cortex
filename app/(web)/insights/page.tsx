// /insights — 월간 인사이트 (Phase 4)
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cortex — 인사이트',
};

export default function InsightsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">월간 인사이트</h1>
        {/* TODO: Phase 4 — Claude API 생성 월간 리포트 + 관심사 지형도 */}
        <p className="text-gray-500">Phase 4에서 구현 예정입니다.</p>
      </div>
    </main>
  );
}
