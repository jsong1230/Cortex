// 하단 네비게이션 (모바일용)
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/',         label: '브리핑', emoji: '☀️' },
  { href: '/history',  label: '히스토리', emoji: '📅' },
  { href: '/profile',  label: '관심사', emoji: '🎯' },
  { href: '/settings', label: '설정', emoji: '⚙️' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="max-w-2xl mx-auto flex">
        {NAV_ITEMS.map(({ href, label, emoji }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-lg">{emoji}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
