// /item/[id] — 콘텐츠 아이템 상세 + 메모
// 참조: docs/specs/F-09-web-item-detail/design.md

import type { Metadata } from 'next';
import { ItemDetailView } from '@/components/item/ItemDetailView';

interface PageProps {
  params: { id: string };
}

export const metadata: Metadata = {
  title: 'Cortex — 아이템 상세',
};

export default function ItemDetailPage({ params }: PageProps) {
  return (
    <main className="min-h-screen bg-[#F8F7F4]">
      <ItemDetailView contentId={params.id} />
    </main>
  );
}
