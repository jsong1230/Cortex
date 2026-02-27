'use client';
// 관심사 스코어 시각화 컴포넌트
// TODO: Phase 2 — 실제 데이터 연동 + 차트 라이브러리 선택

interface Topic {
  topic: string;
  score: number;       // 0.0 ~ 1.0
  interactionCount: number;
}

interface InterestChartProps {
  topics: Topic[];
}

export function InterestChart({ topics }: InterestChartProps) {
  const sortedTopics = [...topics].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-3">
      {sortedTopics.map(({ topic, score, interactionCount }) => (
        <div key={topic} className="flex items-center gap-3">
          <span className="w-24 text-sm text-gray-700 truncate" title={topic}>
            {topic}
          </span>
          <div className="flex-1 bg-gray-100 rounded-full h-3">
            <div
              className="bg-indigo-500 h-3 rounded-full transition-all"
              style={{ width: `${score * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-12 text-right">
            {(score * 100).toFixed(0)}%
          </span>
          <span className="text-xs text-gray-300 w-10 text-right">
            {interactionCount}회
          </span>
        </div>
      ))}
    </div>
  );
}
