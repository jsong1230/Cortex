'use client';
// 데스크톱 사이드바 (lg 이상에서만 표시)
// 참조: docs/system/design-system.md §5.5, docs/specs/F-08-web-briefing-viewer/design.md §4.7

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarItem {
  href: string;
  label: string;
  emoji: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { href: '/', label: '브리핑', emoji: '☀️' },
  { href: '/history', label: '히스토리', emoji: '📚' },
  { href: '/profile', label: '프로필', emoji: '👤' },
  { href: '/settings', label: '설정', emoji: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="사이드바 네비게이션"
      style={{
        width: '220px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E5E3DF',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* 앱 이름 */}
      <div
        style={{
          padding: '24px 20px 16px',
          borderBottom: '1px solid #F0EFEC',
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif KR', Georgia, serif",
            fontSize: '20px',
            fontWeight: 700,
            color: '#1A1A1A',
            letterSpacing: '-0.01em',
          }}
        >
          Cortex
        </span>
      </div>

      {/* 메뉴 항목 */}
      <nav style={{ padding: '8px 0' }}>
        {SIDEBAR_ITEMS.map(({ href, label, emoji }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                height: '44px',
                padding: '0 20px',
                color: isActive ? '#1D4ED8' : '#5C5C5C',
                backgroundColor: isActive ? '#EBF2FF' : 'transparent',
                borderLeft: isActive ? '3px solid #2563EB' : '3px solid transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
            >
              <span aria-hidden="true">{emoji}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
