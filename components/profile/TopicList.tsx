'use client';
// F-14 TopicList — 전체 활성 토픽 목록 + 스코어 조정/아카이브 액션 (AC2, AC3)

import type { InterestTopic } from '@/components/profile/InterestChart';

export interface TopicListProps {
  topics: InterestTopic[];
  onScoreAdjust: (id: string, delta: number) => void;
  onArchive: (id: string) => void;
}

export function TopicList({ topics, onScoreAdjust, onArchive }: TopicListProps) {
  if (topics.length === 0) {
    return (
      <div data-testid="topic-list-empty" className="text-center py-8 text-gray-400">
        활성 토픽이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">토픽 목록</h2>
      <ul className="divide-y divide-gray-100">
        {topics.map((topic, idx) => {
          const isTop10 = idx < 10;
          const widthPercent = Math.round(topic.score * 100);

          return (
            <li
              key={topic.id}
              data-testid={`topic-row-${topic.id}`}
              className="flex items-center gap-3 py-3"
            >
              {/* Top10 뱃지 */}
              {isTop10 && (
                <span
                  data-testid="top10-badge"
                  className="text-base shrink-0"
                  aria-label="Top 10"
                >
                  🏆
                </span>
              )}

              {/* 토픽 이름 + 스코어 바 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {topic.topic}
                  </span>
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    {widthPercent}%
                  </span>
                </div>
                {/* 스코어 바 */}
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    style={{ width: `${widthPercent}%` }}
                    className={`h-full rounded-full ${
                      isTop10 ? 'bg-blue-400' : 'bg-gray-300'
                    }`}
                  />
                </div>
                {/* 메타 정보 */}
                <p
                  data-testid={`interaction-count-${topic.id}`}
                  className="text-xs text-gray-400 mt-1"
                >
                  {topic.interaction_count}회 반응
                </p>
              </div>

              {/* 스코어 조정 버튼 */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  data-testid={`score-up-${topic.id}`}
                  onClick={() => onScoreAdjust(topic.id, 0.1)}
                  className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-bold flex items-center justify-center"
                  aria-label={`${topic.topic} 스코어 올리기`}
                  type="button"
                >
                  +
                </button>
                <button
                  data-testid={`score-down-${topic.id}`}
                  onClick={() => onScoreAdjust(topic.id, -0.1)}
                  className="w-7 h-7 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center"
                  aria-label={`${topic.topic} 스코어 내리기`}
                  type="button"
                >
                  -
                </button>
                <button
                  onClick={() => onArchive(topic.id)}
                  className="ml-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-red-500 hover:bg-red-50"
                  aria-label={`${topic.topic} 아카이브`}
                  type="button"
                >
                  아카이브
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
