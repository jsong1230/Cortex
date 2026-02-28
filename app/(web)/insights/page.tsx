// /insights — 관심사 지형도 (F-21)
// AC1: 버블 차트 시각화
// AC2: 버블 크기가 토픽 스코어에 비례
// AC3: 최근 30일 스코어 변화 추이
'use client';

import { useState, useEffect, useCallback } from 'react';
import { BubbleChart, type BubbleTopic } from '@/components/insights/BubbleChart';
import { TrendChart, type TrendTopic } from '@/components/insights/TrendChart';
import { InsightsSummary, type SummaryTopic } from '@/components/insights/InsightsSummary';
import MonthlyReport from '@/components/insights/MonthlyReport';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface LandscapeTopic {
  topic: string;
  score: number;
  interactionCount: number;
  history: { date: string; score: number }[];
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [topics, setTopics] = useState<LandscapeTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLandscape = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/insights/landscape');
      if (!res.ok) {
        throw new Error('관심사 지형도 데이터 로드 실패');
      }
      const json = await res.json();
      if (json.success) {
        setTopics(json.data.topics);
      } else {
        throw new Error(json.error ?? '알 수 없는 오류');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLandscape();
  }, [fetchLandscape]);

  // ─── BubbleChart / TrendChart / InsightsSummary 공유 데이터 ─────────────────

  const bubbleTopics: BubbleTopic[] = topics.map((t) => ({
    topic: t.topic,
    score: t.score,
    interactionCount: t.interactionCount,
    history: t.history,
  }));

  const trendTopics: TrendTopic[] = topics.map((t) => ({
    topic: t.topic,
    score: t.score,
    history: t.history,
  }));

  const summaryTopics: SummaryTopic[] = topics.map((t) => ({
    topic: t.topic,
    score: t.score,
    interactionCount: t.interactionCount,
    history: t.history,
  }));

  // ─── 렌더링 ──────────────────────────────────────────────────────────────────

  return (
    <>
      <title>Cortex — 관심사 지형도</title>
      <div className="space-y-8">
        {/* 페이지 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">관심사 지형도</h1>
          <p className="mt-1 text-sm text-gray-500">
            토픽별 관심도 스코어와 최근 30일 변화 추이를 확인합니다.
          </p>
        </div>

        {/* 로딩 상태 */}
        {isLoading && (
          <div
            data-testid="insights-loading"
            className="text-center py-12 text-gray-400"
          >
            관심사 데이터를 불러오는 중...
          </div>
        )}

        {/* 에러 상태 */}
        {error && !isLoading && (
          <div
            data-testid="insights-error"
            className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600"
          >
            {error}
          </div>
        )}

        {/* 콘텐츠 */}
        {!isLoading && !error && (
          <>
            {/* AC1, AC2: 버블 차트 (히어로) */}
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3">관심사 버블 차트</h2>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <BubbleChart topics={bubbleTopics} />
              </div>
            </section>

            {/* AC3: 관심사 요약 */}
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3">관심사 요약</h2>
              <InsightsSummary topics={summaryTopics} />
            </section>

            {/* AC3: 추이 라인 차트 */}
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                30일 스코어 추이 (상위 5개)
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <TrendChart topics={trendTopics} />
              </div>
            </section>

            {/* F-22: AI 월간 리포트 섹션 */}
            <MonthlyReport />
          </>
        )}
      </div>
    </>
  );
}
