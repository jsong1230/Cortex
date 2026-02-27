// 공통 헤더 컴포넌트

import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-gray-900">
          Cortex
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/history"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            히스토리
          </Link>
          <Link
            href="/profile"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            관심사
          </Link>
          <Link
            href="/settings"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            설정
          </Link>
        </nav>
      </div>
    </header>
  );
}
