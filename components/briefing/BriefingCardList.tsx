'use client';
// 브리핑 카드 목록 — 로딩/에러/빈 상태 관리
// 참조: docs/specs/F-08-web-briefing-viewer/design.md §4.4

import { useState, useEffect, useCallback } from 'react';
import { BriefingCard } from './BriefingCard';

interface BriefingItem {
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

interface BriefingData {
  briefing_date: string;
  briefing_id: string;
  items: BriefingItem[];
}

// ─── 로딩 스켈레톤 ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E3DF',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }}
      aria-busy="true"
      aria-label="브리핑 로딩 중"
    >
      {/* 뱃지 + 소스 스켈레톤 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div
          style={{
            width: '60px',
            height: '20px',
            backgroundColor: '#F3F2EF',
            borderRadius: '6px',
          }}
        />
        <div
          style={{
            width: '80px',
            height: '20px',
            backgroundColor: '#F3F2EF',
            borderRadius: '4px',
          }}
        />
      </div>
      {/* 제목 스켈레톤 */}
      <div
        style={{
          width: '80%',
          height: '20px',
          backgroundColor: '#F3F2EF',
          borderRadius: '4px',
          marginBottom: '8px',
        }}
      />
      <div
        style={{
          width: '60%',
          height: '20px',
          backgroundColor: '#F3F2EF',
          borderRadius: '4px',
          marginBottom: '12px',
        }}
      />
      {/* 요약 스켈레톤 */}
      <div
        style={{
          width: '100%',
          height: '40px',
          backgroundColor: '#F3F2EF',
          borderRadius: '4px',
          marginBottom: '12px',
        }}
      />
      {/* 버튼 스켈레톤 */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '36px',
              backgroundColor: '#F3F2EF',
              borderRadius: '8px',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── BriefingCardList 메인 컴포넌트 ─────────────────────────────────────────

export function BriefingCardList() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/briefings/today');
      const json = await response.json();

      if (!response.ok || !json.success) {
        if (response.status === 404) {
          // 404는 에러가 아닌 빈 상태
          setData(null);
        } else {
          setError(json.error ?? '브리핑을 불러오지 못했습니다');
        }
        return;
      }

      setData(json.data);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  // 로딩 상태: 스켈레톤 3개
  if (loading) {
    return (
      <div aria-label="브리핑 불러오는 중">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
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
          onClick={fetchBriefing}
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

  // 빈 상태: 브리핑 없음
  if (!data || data.items.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '48px 16px',
          color: '#5C5C5C',
        }}
      >
        <p style={{ fontSize: '16px', marginBottom: '8px' }}>
          아직 오늘의 브리핑이 없습니다
        </p>
        <p style={{ fontSize: '14px', color: '#9E9E9E' }}>
          매일 오전 7시에 브리핑이 발송됩니다
        </p>
      </div>
    );
  }

  // 성공 상태: 카드 목록
  return (
    <div>
      {data.items.map((item) => (
        <BriefingCard
          key={item.content_id}
          contentId={item.content_id}
          briefingId={data.briefing_id}
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
  );
}
