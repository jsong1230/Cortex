'use client';
// F-21 InsightsSummary — 관심사 요약 텍스트 컴포넌트 (AC1, AC3)
// 상위 관심사 / 급상승 토픽 / 하락 토픽 섹션으로 구성

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface SummaryHistoryPoint {
  date: string;
  score: number;
}

export interface SummaryTopic {
  topic: string;
  score: number;
  interactionCount: number;
  history: SummaryHistoryPoint[];
}

interface InsightsSummaryProps {
  topics: SummaryTopic[];
}

// ─── 추이 분류 임계값 ─────────────────────────────────────────────────────────

// 상승으로 분류하는 최소 스코어 변화량
const RISING_THRESHOLD = 0.1;
// 하락으로 분류하는 최소 스코어 변화량 (절댓값)
const FALLING_THRESHOLD = 0.1;

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

/**
 * 히스토리의 첫 번째 스코어(30일 전)와 현재 스코어를 비교해 변화량 반환
 * 히스토리가 없으면 null 반환
 */
function scoreDelta(topic: SummaryTopic): number | null {
  if (topic.history.length === 0) return null;
  const oldest = topic.history[0].score;
  return topic.score - oldest;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function InsightsSummary({ topics }: InsightsSummaryProps) {
  // 빈 상태
  if (topics.length === 0) {
    return (
      <div data-testid="insights-summary-empty" className="text-center py-8 text-gray-400">
        분석할 관심사 데이터가 없습니다.
      </div>
    );
  }

  // 상위 관심사: score DESC 상위 3개
  const topTopics = [...topics]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // 급상승: delta >= RISING_THRESHOLD, delta DESC 정렬
  const risingTopics = topics
    .filter((t) => {
      const delta = scoreDelta(t);
      return delta !== null && delta >= RISING_THRESHOLD;
    })
    .sort((a, b) => {
      const da = scoreDelta(a) ?? 0;
      const db = scoreDelta(b) ?? 0;
      return db - da;
    });

  // 하락: delta <= -FALLING_THRESHOLD, delta ASC 정렬 (가장 많이 하락한 것 먼저)
  const fallingTopics = topics
    .filter((t) => {
      const delta = scoreDelta(t);
      return delta !== null && delta <= -FALLING_THRESHOLD;
    })
    .sort((a, b) => {
      const da = scoreDelta(a) ?? 0;
      const db = scoreDelta(b) ?? 0;
      return da - db;
    });

  return (
    <div data-testid="insights-summary" className="space-y-4">
      {/* 상위 관심사 */}
      <div
        data-testid="summary-top-topics"
        className="bg-white rounded-xl border border-gray-200 p-5"
      >
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          상위 관심사
        </h3>
        <div className="flex flex-wrap gap-2">
          {topTopics.map((t, idx) => (
            <span
              key={t.topic}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                idx === 0
                  ? 'bg-blue-100 text-blue-700'
                  : idx === 1
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {idx === 0 ? '1' : idx === 1 ? '2' : '3'} {t.topic}
              <span className="text-xs opacity-70">{Math.round(t.score * 100)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* 급상승 토픽 */}
      <div
        data-testid="summary-rising-topics"
        className="bg-white rounded-xl border border-gray-200 p-5"
      >
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          급상승 토픽
        </h3>
        {risingTopics.length === 0 ? (
          <p className="text-sm text-gray-400">최근 급상승한 토픽이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {risingTopics.map((t) => {
              const delta = scoreDelta(t) ?? 0;
              return (
                <span
                  key={t.topic}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700"
                >
                  {/* 상승 화살표 */}
                  <span aria-hidden="true">&#8593;</span>
                  {t.topic}
                  <span className="text-xs opacity-70">+{Math.round(delta * 100)}%</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 하락 토픽 */}
      <div
        data-testid="summary-falling-topics"
        className="bg-white rounded-xl border border-gray-200 p-5"
      >
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          하락 토픽
        </h3>
        {fallingTopics.length === 0 ? (
          <p className="text-sm text-gray-400">최근 하락한 토픽이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {fallingTopics.map((t) => {
              const delta = scoreDelta(t) ?? 0;
              return (
                <span
                  key={t.topic}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700"
                >
                  {/* 하락 화살표 */}
                  <span aria-hidden="true">&#8595;</span>
                  {t.topic}
                  <span className="text-xs opacity-70">{Math.round(delta * 100)}%</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
