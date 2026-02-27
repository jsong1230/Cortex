// / — 오늘의 브리핑 메인 페이지
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cortex — 오늘의 브리핑',
  description: '개인화된 AI 브리핑',
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          오늘의 브리핑
        </h1>
        {/* TODO: Phase 0 — BriefingCard 컴포넌트 렌더링 */}
        <p className="text-gray-500">브리핑을 불러오는 중...</p>
      </div>
    </main>
  );
}
