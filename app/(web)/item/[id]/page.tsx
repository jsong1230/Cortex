// /item/[id] — 콘텐츠 아이템 상세 + 메모
import type { Metadata } from 'next';

interface PageProps {
  params: { id: string };
}

export const metadata: Metadata = {
  title: 'Cortex — 아이템 상세',
};

export default function ItemDetailPage({ params }: PageProps) {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">아이템 상세</h1>
        {/* TODO: Phase 1 — 아이템 상세 + 피드백 버튼 + 메모 입력 */}
        <p className="text-gray-500">ID: {params.id}</p>
      </div>
    </main>
  );
}
