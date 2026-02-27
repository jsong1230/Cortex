'use client';
// 날짜별 브리핑 히스토리 목록 컴포넌트
// 참조: docs/specs/F-10-web-briefing-history/design.md §4.3

import { useState, useEffect, useCallback } from 'react';
import { ChannelBadge } from '@/components/briefing/ChannelBadge';
import { BriefingCard } from '@/components/briefing/BriefingCard';

// 브리핑 목록 아이템 타입
interface BriefingListItem {
  id: string;
  briefing_date: string;
  item_count: number;
  channels: string[];
}

// 브리핑 상세 아이템 타입
interface BriefingDetailItem {
  content_id: string;
  position: number;
  channel: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  reason: string | null;
  user_interaction: string | null;
}

// 브리핑 상세 데이터 타입
interface BriefingDetailData {
  briefing_id: string;
  briefing_date: string;
  items: BriefingDetailItem[];
}

// 날짜 표시 포매터 (2026-02-27 → 2026.02.27 (목))
function formatBriefingDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[date.getDay()];
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} (${dayName})`;
}

// ─── 스켈레톤 아이템 ──────────────────────────────────────────────────────────

function SkeletonDateItem() {
  return (
    <div
      aria-busy="true"
      aria-label="날짜 로딩 중"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E3DF',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '8px',
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div
          style={{ width: '150px', height: '16px', backgroundColor: '#F3F2EF', borderRadius: '4px' }}
        />
        <div
          style={{ width: '30px', height: '16px', backgroundColor: '#F3F2EF', borderRadius: '4px' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ width: '60px', height: '20px', backgroundColor: '#F3F2EF', borderRadius: '6px' }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── BriefingDateList 메인 컴포넌트 ──────────────────────────────────────────

export function BriefingDateList() {
  const [briefings, setBriefings] = useState<BriefingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // 날짜 선택 상태
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBriefing, setSelectedBriefing] = useState<BriefingDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchBriefings = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/briefings?page=${pageNum}&limit=20`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        setError(json.error ?? '브리핑 목록을 불러오지 못했습니다');
        return;
      }

      if (append) {
        setBriefings((prev) => [...prev, ...json.data.items]);
      } else {
        setBriefings(json.data.items);
      }
      setHasMore(json.data.hasMore);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefings(1);
  }, [fetchBriefings]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchBriefings(nextPage, true);
  };

  const handleDateClick = async (briefingDate: string) => {
    // 토글: 같은 날짜 재클릭 시 접기
    if (selectedDate === briefingDate) {
      setSelectedDate(null);
      setSelectedBriefing(null);
      return;
    }

    setSelectedDate(briefingDate);
    setDetailLoading(true);
    setSelectedBriefing(null);

    try {
      const response = await fetch(`/api/briefings/${briefingDate}`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        setSelectedDate(null);
        return;
      }

      setSelectedBriefing(json.data);
    } catch {
      setSelectedDate(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // 로딩 상태: 스켈레톤 3개
  if (loading) {
    return (
      <div>
        <SkeletonDateItem />
        <SkeletonDateItem />
        <SkeletonDateItem />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div
        role="alert"
        style={{
          backgroundColor: '#FEE2E2',
          border: '1px solid #FECACA',
          borderRadius: '12px',
          padding: '16px',
          color: '#DC2626',
        }}
      >
        <p style={{ marginBottom: '12px', fontWeight: 500 }}>{error}</p>
        <button
          onClick={() => fetchBriefings(1)}
          style={{
            height: '44px',
            padding: '0 16px',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 빈 상태
  if (briefings.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '48px 16px',
          color: '#5C5C5C',
        }}
      >
        <p style={{ fontSize: '16px', marginBottom: '8px' }}>아직 브리핑 기록이 없습니다</p>
        <p style={{ fontSize: '14px', color: '#9E9E9E' }}>매일 오전 7시에 브리핑이 생성됩니다</p>
      </div>
    );
  }

  // 성공 상태: 날짜 목록
  return (
    <div>
      {briefings.map((briefing) => {
        const isSelected = selectedDate === briefing.briefing_date;

        return (
          <div key={briefing.id}>
            {/* 날짜 카드 */}
            <button
              onClick={() => handleDateClick(briefing.briefing_date)}
              aria-expanded={isSelected}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                backgroundColor: isSelected ? '#EBF2FF' : '#FFFFFF',
                border: isSelected ? '1px solid #93C5FD' : '1px solid #E5E3DF',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.15s, border-color 0.15s',
              }}
            >
              {/* 날짜 + 아이템 수 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                  }}
                >
                  {formatBriefingDate(briefing.briefing_date)}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    color: '#5C5C5C',
                  }}
                >
                  {briefing.item_count}개
                </span>
              </div>

              {/* 채널 뱃지 목록 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {briefing.channels.map((channel) => (
                  <ChannelBadge key={channel} channel={channel} />
                ))}
              </div>
            </button>

            {/* 선택된 날짜의 브리핑 상세 (인라인 표시) */}
            {isSelected && (
              <div style={{ paddingLeft: '8px', marginBottom: '8px' }}>
                {detailLoading ? (
                  <div
                    aria-busy="true"
                    aria-label="브리핑 상세 로딩 중"
                    style={{ padding: '16px', textAlign: 'center', color: '#9E9E9E' }}
                  >
                    불러오는 중...
                  </div>
                ) : selectedBriefing ? (
                  <div>
                    {selectedBriefing.items.map((item) => (
                      <BriefingCard
                        key={item.content_id}
                        contentId={item.content_id}
                        briefingId={selectedBriefing.briefing_id}
                        channel={item.channel}
                        title={item.title}
                        summaryAi={item.summary_ai}
                        source={item.source}
                        sourceUrl={item.source_url}
                        reason={item.reason}
                        userInteraction={item.user_interaction}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      {/* 더 보기 버튼 */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          style={{
            display: 'block',
            width: '100%',
            height: '44px',
            backgroundColor: '#F3F2EF',
            color: '#5C5C5C',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: loadingMore ? 'not-allowed' : 'pointer',
            marginTop: '8px',
          }}
        >
          {loadingMore ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}
