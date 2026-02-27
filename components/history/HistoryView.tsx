'use client';
// 히스토리 탭 컨테이너 컴포넌트
// 참조: docs/specs/F-10-web-briefing-history/design.md §4.2

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BriefingDateList } from './BriefingDateList';
import { SavedItemList } from './SavedItemList';

type TabType = 'history' | 'saved';

export function HistoryView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL ?tab=saved 파라미터로 초기 탭 결정
  const initialTab: TabType = searchParams.get('tab') === 'saved' ? 'saved' : 'history';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    // URL에 탭 상태 반영 (딥링크 가능)
    if (tab === 'saved') {
      router.replace('?tab=saved');
    } else {
      router.replace('?');
    }
  };

  // 탭 스타일 계산
  const getTabStyle = (tab: TabType): React.CSSProperties => {
    const isActive = activeTab === tab;
    return {
      height: '44px',
      padding: '0 16px',
      fontSize: '15px',
      fontWeight: isActive ? 600 : 400,
      color: isActive ? '#1A1A1A' : '#9E9E9E',
      background: 'none',
      border: 'none',
      borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
      cursor: 'pointer',
      transition: 'color 0.15s, border-color 0.15s',
    };
  };

  return (
    <div>
      {/* 탭 바 */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '2px solid #E5E3DF',
          marginBottom: '16px',
        }}
        aria-label="히스토리 탭"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'history'}
          aria-controls="panel-history"
          id="tab-history"
          style={getTabStyle('history')}
          onClick={() => handleTabClick('history')}
        >
          브리핑 히스토리
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'saved'}
          aria-controls="panel-saved"
          id="tab-saved"
          style={getTabStyle('saved')}
          onClick={() => handleTabClick('saved')}
        >
          저장 목록
        </button>
      </div>

      {/* 탭 패널 */}
      {activeTab === 'history' ? (
        <div
          role="tabpanel"
          id="panel-history"
          aria-labelledby="tab-history"
        >
          <BriefingDateList />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="panel-saved"
          aria-labelledby="tab-saved"
        >
          <SavedItemList />
        </div>
      )}
    </div>
  );
}
