'use client';
// 저장(북마크) 아이템 목록 컴포넌트
// 참조: docs/specs/F-10-web-briefing-history/design.md §4.4

import { useState, useEffect, useCallback } from 'react';
import { ChannelBadge } from '@/components/briefing/ChannelBadge';

// 저장 아이템 타입
interface SavedItem {
  content_id: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
  channel: string;
  saved_at: string;
}

// 저장일 표시 포매터 (ISO → 2026.02.27)
function formatSavedDate(isoStr: string): string {
  const date = new Date(isoStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export function SavedItemList() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchSaved = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/saved?page=${pageNum}&limit=20`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        setError(json.error ?? '저장 목록을 불러오지 못했습니다');
        return;
      }

      if (append) {
        setSavedItems((prev) => [...prev, ...json.data.items]);
      } else {
        setSavedItems(json.data.items);
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
    fetchSaved(1);
  }, [fetchSaved]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchSaved(nextPage, true);
  };

  const handleUnsave = async (contentId: string) => {
    // 낙관적 업데이트: 즉시 목록에서 제거
    const previousItems = [...savedItems];
    setSavedItems((prev) => prev.filter((item) => item.content_id !== contentId));

    try {
      const response = await fetch(`/api/saved/${contentId}`, { method: 'DELETE' });
      const json = await response.json();

      if (!response.ok || !json.success) {
        // 실패 시 목록 복원
        setSavedItems(previousItems);
      }
    } catch {
      // 네트워크 오류 시 목록 복원
      setSavedItems(previousItems);
    }
  };

  // 로딩 상태
  if (loading) {
    return (
      <div aria-busy="true" aria-label="저장 목록 로딩 중">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E3DF',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div
                style={{ width: '60px', height: '20px', backgroundColor: '#F3F2EF', borderRadius: '6px' }}
              />
              <div
                style={{ width: '80px', height: '20px', backgroundColor: '#F3F2EF', borderRadius: '4px' }}
              />
            </div>
            <div
              style={{ width: '80%', height: '20px', backgroundColor: '#F3F2EF', borderRadius: '4px', marginBottom: '8px' }}
            />
          </div>
        ))}
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
          onClick={() => fetchSaved(1)}
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
  if (savedItems.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '48px 16px',
          color: '#5C5C5C',
        }}
      >
        <p style={{ fontSize: '16px', marginBottom: '8px' }}>아직 저장한 아이템이 없습니다</p>
        <p style={{ fontSize: '14px', color: '#9E9E9E' }}>브리핑에서 🔖 저장 버튼을 눌러보세요</p>
      </div>
    );
  }

  // 성공 상태: 저장 아이템 카드 목록
  return (
    <div>
      {savedItems.map((item) => (
        <article
          key={item.content_id}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E3DF',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            position: 'relative',
          }}
        >
          {/* 헤더: 채널 뱃지 + 소스 + 저장 해제 버튼 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChannelBadge channel={item.channel} />
              <span style={{ fontSize: '14px', color: '#5C5C5C' }}>{item.source}</span>
            </div>

            {/* 저장 해제 버튼 */}
            <button
              aria-label="저장 해제"
              onClick={() => handleUnsave(item.content_id)}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#9E9E9E',
                fontSize: '16px',
                borderRadius: '8px',
                transition: 'color 0.15s, background-color 0.15s',
              }}
            >
              ✕
            </button>
          </div>

          {/* 기사 제목 */}
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 700,
              lineHeight: 1.4,
              color: '#1A1A1A',
              marginBottom: '8px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {item.title}
            </a>
          </h3>

          {/* AI 요약 */}
          {item.summary_ai && (
            <p
              style={{
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#5C5C5C',
                marginBottom: '8px',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.summary_ai}
            </p>
          )}

          {/* 저장일 */}
          <p style={{ fontSize: '14px', color: '#9E9E9E' }}>
            저장일: {formatSavedDate(item.saved_at)}
          </p>
        </article>
      ))}

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
