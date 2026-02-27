'use client';
// F-14 InterestChart — 토픽별 관심도 수평 바 차트 (AC1, AC3)
// Tailwind CSS div 너비 기반 바 차트 (차트 라이브러리 미사용)

export interface InterestTopic {
  id: string;
  topic: string;
  score: number;
  interaction_count: number;
  last_updated: string;
  archived_at: string | null;
}

interface InterestChartProps {
  topics: InterestTopic[];
}

export function InterestChart({ topics }: InterestChartProps) {
  if (topics.length === 0) {
    return (
      <div data-testid="interest-chart-empty" className="text-center py-8 text-gray-400">
        등록된 관심사 토픽이 없습니다.
      </div>
    );
  }

  return (
    <div data-testid="interest-chart" className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">관심도 차트</h2>
      <div className="space-y-3">
        {topics.map((topic, idx) => {
          const isTop10 = idx < 10;
          const widthPercent = Math.round(topic.score * 100);

          return (
            <div
              key={topic.id}
              data-top10={isTop10 ? 'true' : 'false'}
              className="flex items-center gap-3"
            >
              {/* 토픽 이름 */}
              <span
                className="w-28 text-sm text-gray-700 truncate shrink-0"
                title={topic.topic}
              >
                {topic.topic}
              </span>

              {/* 바 컨테이너 */}
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  data-testid={`chart-bar-${topic.id}`}
                  style={{ width: `${widthPercent}%` }}
                  className={`h-full rounded-full transition-all duration-300 ${
                    isTop10 ? 'bg-blue-500' : 'bg-gray-400'
                  }`}
                />
              </div>

              {/* 퍼센트 표시 */}
              <span
                className={`w-10 text-right text-sm font-medium shrink-0 ${
                  isTop10 ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {widthPercent}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
