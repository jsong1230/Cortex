'use client';
// 하단 탭 바 (모바일용)
// 참조: docs/system/design-system.md §5.4, docs/specs/F-08-web-briefing-viewer/design.md §4.6

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  emoji: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '홈', emoji: '🏠' },
  { href: '/history', label: '히스토리', emoji: '📚' },
  { href: '/profile', label: '프로필', emoji: '👤' },
  { href: '/settings', label: '설정', emoji: '⚙️' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="메인 네비게이션"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        height: '56px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E5E3DF',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV_ITEMS.map(({ href, label, emoji }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: isActive ? '#2563EB' : '#9E9E9E',
              textDecoration: 'none',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 400,
              transition: 'color 0.15s ease',
            }}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }} aria-hidden="true">
              {emoji}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
