// /settings — 채널 ON/OFF + 알림 설정
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cortex — 설정',
};

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>
        {/* TODO: Phase 2 — 채널 활성화 토글, 긴급 알림 트리거 설정, 방해 금지 시간 */}
        <p className="text-gray-500">설정을 불러오는 중...</p>
      </div>
    </main>
  );
}
