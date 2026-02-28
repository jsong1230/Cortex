'use client';
// F-21 TrendChart — 30일 스코어 추이 라인 차트 (AC3)
// SVG 기반, 외부 라이브러리 미사용
// 상위 5개 토픽 라인 표시, X축: 날짜, Y축: score(0~1)

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface TrendHistoryPoint {
  date: string;
  score: number;
}

export interface TrendTopic {
  topic: string;
  score: number;
  history: TrendHistoryPoint[];
}

interface TrendChartProps {
  topics: TrendTopic[];
  /** 표시할 최대 토픽 수 (기본 5) */
  maxTopics?: number;
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const SVG_WIDTH = 560;
const SVG_HEIGHT = 220;
const PADDING = { top: 12, right: 16, bottom: 32, left: 36 };

// 토픽별 라인 색상 (최대 5개)
const LINE_COLORS = ['#3B82F6', '#14B8A6', '#8B5CF6', '#F59E0B', '#EC4899'];

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

const plotW = SVG_WIDTH - PADDING.left - PADDING.right;
const plotH = SVG_HEIGHT - PADDING.top - PADDING.bottom;

/**
 * (날짜 인덱스, score) → SVG 좌표 변환
 */
function toPoint(xIdx: number, totalX: number, score: number): { x: number; y: number } {
  const x = PADDING.left + (totalX <= 1 ? plotW / 2 : (xIdx / (totalX - 1)) * plotW);
  const y = PADDING.top + (1 - score) * plotH;
  return { x, y };
}

/**
 * 히스토리 포인트 배열 → SVG path d 속성 생성
 * 최소 2개 이상이어야 라인 생성
 */
function buildPath(history: TrendHistoryPoint[]): string | null {
  if (history.length < 2) return null;

  const points = history.map((h, i) => toPoint(i, history.length, h.score));
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  return d;
}

/**
 * Y축 눈금 레이블 생성 (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)
 */
function yTickLabels(): { value: number; y: number }[] {
  return [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => ({
    value: v,
    y: PADDING.top + (1 - v) * plotH,
  }));
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function TrendChart({ topics, maxTopics = 5 }: TrendChartProps) {
  // 빈 상태
  if (topics.length === 0) {
    return (
      <div data-testid="trend-chart-empty" className="text-center py-8 text-gray-400">
        추이 데이터가 없습니다.
      </div>
    );
  }

  // 상위 N개 토픽 (score DESC)
  const topN = [...topics]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTopics);

  // 히스토리가 있는 토픽만 라인 생성
  const lines: { topic: string; path: string; color: string }[] = [];
  topN.forEach((t, idx) => {
    const path = buildPath(t.history);
    if (path) {
      lines.push({ topic: t.topic, path, color: LINE_COLORS[idx % LINE_COLORS.length] });
    }
  });

  const yTicks = yTickLabels();

  return (
    <div className="w-full overflow-x-auto">
      <svg
        role="img"
        aria-label="최근 30일 관심사 스코어 추이 차트"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        style={{ maxHeight: '280px' }}
        className="block"
      >
        {/* Y축 그리드 라인 + 눈금 */}
        {yTicks.map(({ value, y }) => (
          <g key={value}>
            <line
              x1={PADDING.left}
              y1={y}
              x2={PADDING.left + plotW}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="#9CA3AF"
            >
              {value.toFixed(1)}
            </text>
          </g>
        ))}

        {/* 라인 */}
        {lines.map(({ topic, path, color }) => (
          <path
            key={topic}
            data-topic={topic}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* X축 */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + plotH}
          x2={PADDING.left + plotW}
          y2={PADDING.top + plotH}
          stroke="#D1D5DB"
          strokeWidth={1}
        />

        {/* 범례 */}
        {lines.map(({ topic, color }, idx) => (
          <g key={topic} transform={`translate(${PADDING.left + idx * 110}, ${SVG_HEIGHT - 12})`}>
            <line x1={0} y1={0} x2={12} y2={0} stroke={color} strokeWidth={2} />
            <text x={16} y={4} fontSize={10} fill="#6B7280">
              {topic.length > 8 ? `${topic.slice(0, 7)}…` : topic}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
