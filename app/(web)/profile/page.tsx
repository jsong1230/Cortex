// /profile — 관심사 프로필 시각화
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cortex — 관심사 프로필',
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">관심사 프로필</h1>
        {/* TODO: Phase 2 — InterestChart 컴포넌트 + 토픽별 EMA 점수 */}
        <p className="text-gray-500">관심사 데이터를 불러오는 중...</p>
      </div>
    </main>
  );
}
