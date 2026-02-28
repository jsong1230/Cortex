'use client';
// F-21 BubbleChart — 관심사 버블 차트 (AC1, AC2)
// SVG 기반, 외부 라이브러리 미사용
// 버블 반지름: sqrt(score) * MAX_RADIUS 비례

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface HistoryPoint {
  date: string;
  score: number;
}

export interface BubbleTopic {
  topic: string;
  score: number;
  interactionCount: number;
  history: HistoryPoint[];
}

interface BubbleChartProps {
  topics: BubbleTopic[];
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const SVG_WIDTH = 600;
const SVG_HEIGHT = 400;

// 최대 반지름 (score=1.0 기준)
const MAX_RADIUS = 60;
// 최소 반지름 (score=0 이더라도 표시)
const MIN_RADIUS = 8;

// 색상 수준별 fill
const COLOR_HIGH = '#3B82F6';    // blue-500
const COLOR_MEDIUM = '#14B8A6';  // teal-500
const COLOR_LOW = '#9CA3AF';     // gray-400

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

/**
 * score → 반지름 변환 (sqrt 비례)
 * sqrt(score) * MAX_RADIUS, 최소 MIN_RADIUS 보장
 */
function scoreToRadius(score: number): number {
  return Math.max(MIN_RADIUS, Math.sqrt(Math.max(0, score)) * MAX_RADIUS);
}

/**
 * score → 색상 수준 ('high' | 'medium' | 'low')
 */
function scoreToLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

/**
 * 색상 수준 → fill 색상
 */
function levelToColor(level: 'high' | 'medium' | 'low'): string {
  if (level === 'high') return COLOR_HIGH;
  if (level === 'medium') return COLOR_MEDIUM;
  return COLOR_LOW;
}

/**
 * 단순 그리드 팩 레이아웃: score 내림차순으로 나선형 배치
 * 겹침 없이 행/열로 배열
 */
function packBubbles(
  topics: BubbleTopic[]
): { topic: BubbleTopic; cx: number; cy: number; r: number }[] {
  const sorted = [...topics].sort((a, b) => b.score - a.score);
  const result: { topic: BubbleTopic; cx: number; cy: number; r: number }[] = [];

  // 간단한 행렬 배치 — 열 수 계산
  const cols = Math.ceil(Math.sqrt(sorted.length));

  sorted.forEach((t, idx) => {
    const r = scoreToRadius(t.score);
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    // 최대 반지름 기준으로 셀 크기 계산
    const cellSize = MAX_RADIUS * 2 + 20;
    const startX = cellSize / 2 + 20;
    const startY = cellSize / 2 + 20;

    const cx = startX + col * cellSize;
    const cy = startY + row * cellSize;

    result.push({ topic: t, cx, cy, r });
  });

  return result;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function BubbleChart({ topics }: BubbleChartProps) {
  // 빈 상태
  if (topics.length === 0) {
    return (
      <div data-testid="bubble-chart-empty" className="text-center py-12 text-gray-400">
        표시할 관심사 토픽이 없습니다.
      </div>
    );
  }

  const packed = packBubbles(topics);

  // SVG 뷰박스를 데이터에 맞게 조정
  const maxX = Math.max(...packed.map(({ cx, r }) => cx + r)) + 20;
  const maxY = Math.max(...packed.map(({ cy, r }) => cy + r)) + 20;
  const viewBoxWidth = Math.max(SVG_WIDTH, maxX);
  const viewBoxHeight = Math.max(SVG_HEIGHT / 2, maxY);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        role="img"
        aria-label="관심사 지형도 버블 차트 — 버블 크기가 관심도 스코어에 비례합니다"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        width="100%"
        style={{ maxHeight: '400px' }}
        className="block"
      >
        {packed.map(({ topic, cx, cy, r }) => {
          const level = scoreToLevel(topic.score);
          const fill = levelToColor(level);
          const scorePercent = Math.round(topic.score * 100);

          return (
            <g key={topic.topic}>
              {/* 버블 원 */}
              <circle
                data-topic={topic.topic}
                data-score-level={level}
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                fillOpacity={0.8}
                stroke="white"
                strokeWidth={2}
              />
              {/* 토픽 이름 (버블 중앙) */}
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(10, Math.min(14, r * 0.35))}
                fill="white"
                fontWeight="600"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {topic.topic.length > 8 ? `${topic.topic.slice(0, 7)}…` : topic.topic}
              </text>
              {/* 스코어 퍼센트 */}
              <text
                x={cx}
                y={cy + r * 0.35 + 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(9, Math.min(12, r * 0.28))}
                fill="white"
                fillOpacity={0.9}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {scorePercent}%
              </text>
            </g>
          );
        })}
        {/* 범례 */}
        <g transform={`translate(16, ${viewBoxHeight - 24})`}>
          <circle cx={6} cy={0} r={6} fill={COLOR_HIGH} fillOpacity={0.8} />
          <text x={16} y={4} fontSize={11} fill="#6B7280">고관심</text>
          <circle cx={66} cy={0} r={6} fill={COLOR_MEDIUM} fillOpacity={0.8} />
          <text x={76} y={4} fontSize={11} fill="#6B7280">중관심</text>
          <circle cx={116} cy={0} r={6} fill={COLOR_LOW} fillOpacity={0.8} />
          <text x={126} y={4} fontSize={11} fill="#6B7280">저관심</text>
        </g>
      </svg>
    </div>
  );
}
