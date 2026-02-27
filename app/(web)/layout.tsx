// (web) 그룹 레이아웃 — AppShell
// 모바일: 헤더 + 하단 탭 바 / 데스크톱: 사이드바
// 참조: docs/specs/F-08-web-briefing-viewer/design.md §2.2

import type { ReactNode } from 'react';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';

interface WebLayoutProps {
  children: ReactNode;
}

export default function WebLayout({ children }: WebLayoutProps) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#F8F7F4',
      }}
    >
      {/* 데스크톱 사이드바 (lg: 1024px 이상에서만 표시) */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* 모바일 헤더 (lg 미만에서만 표시) */}
        <div className="lg:hidden">
          <MobileHeader />
        </div>

        {/* 콘텐츠 (하단 탭 바 높이 보정) */}
        <main
          style={{
            flex: 1,
            maxWidth: '640px',
            width: '100%',
            margin: '0 auto',
            padding: '16px 16px 88px',
          }}
        >
          {children}
        </main>
      </div>

      {/* 모바일 하단 탭 바 (lg 미만에서만 표시) */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
