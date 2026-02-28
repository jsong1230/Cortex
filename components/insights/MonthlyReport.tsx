'use client';

// F-22 월간 리포트 컴포넌트
// AC3: /insights 페이지에서 조회 가능
// AC4: Top 5 읽은 주제 표시

import { useState, useEffect } from 'react';

// ─── 타입 정의 ─────────────────────────────────────────────────────────────

interface TopTopic {
  topic: string;
  readCount: number;
  score: number;
}

interface MonthlyReportItem {
  id: string;
  report_month: string;
  summary: string;
  top_topics: TopTopic[];
  generated_at: string;
  telegram_sent_at: string | null;
}

interface MonthlyReportDetail extends MonthlyReportItem {
  content: string;
}

// ─── Score Change 방향 아이콘 ─────────────────────────────────────────────

function ScoreDirection({ score }: { score: number }) {
  if (score >= 0.7) return <span className="text-green-600 font-bold">↑↑</span>;
  if (score >= 0.5) return <span className="text-blue-500">↑</span>;
  if (score <= 0.3) return <span className="text-red-500">↓</span>;
  return <span className="text-gray-400">→</span>;
}

// ─── 단일 리포트 상세 뷰 ────────────────────────────────────────────────────

function ReportDetail({
  month,
  onClose,
}: {
  month: string;
  onClose: () => void;
}) {
  const [report, setReport] = useState<MonthlyReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/insights/reports/${month}`);
        if (!res.ok) {
          setError('리포트를 불러올 수 없습니다.');
          return;
        }
        const data = (await res.json()) as { success: boolean; data: MonthlyReportDetail };
        if (data.success) {
          setReport(data.data);
        } else {
          setError('리포트를 불러올 수 없습니다.');
        }
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    void fetchReport();
  }, [month]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <p className="text-red-500 text-sm">{error ?? '리포트를 불러올 수 없습니다.'}</p>
        <button
          onClick={onClose}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">
          {report.report_month} 월간 리포트
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-sm"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* Top 5 주제 — AC4 */}
      {report.top_topics.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Top {report.top_topics.length} 읽은 주제
          </h4>
          <ol className="space-y-2">
            {report.top_topics.map((topic, idx) => (
              <li key={topic.topic} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                <span className="flex-1 text-sm font-medium text-gray-800">{topic.topic}</span>
                <span className="text-xs text-gray-500">{topic.readCount}회</span>
                <ScoreDirection score={topic.score} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 리포트 전체 내용 (마크다운 렌더링 — pre 태그로 간단 표시) */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">분석 리포트</h4>
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-96">
          {report.content}
        </div>
      </div>

      {/* 메타 정보 */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>생성: {new Date(report.generated_at).toLocaleDateString('ko-KR')}</span>
        {report.telegram_sent_at && (
          <span>텔레그램 발송: {new Date(report.telegram_sent_at).toLocaleDateString('ko-KR')}</span>
        )}
      </div>
    </div>
  );
}

// ─── 리포트 카드 ───────────────────────────────────────────────────────────

function ReportCard({
  report,
  onSelect,
}: {
  report: MonthlyReportItem;
  onSelect: (month: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(report.report_month)}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-base font-bold text-gray-900">{report.report_month}</span>
          <span className="ml-2 text-xs text-gray-400">월간 리포트</span>
        </div>
        {report.telegram_sent_at && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            발송 완료
          </span>
        )}
      </div>

      {/* 요약 */}
      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{report.summary}</p>

      {/* Top 3 주제 미리보기 — AC4 */}
      {report.top_topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.top_topics.slice(0, 3).map((t) => (
            <span
              key={t.topic}
              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
            >
              {t.topic} ({t.readCount})
            </span>
          ))}
          {report.top_topics.length > 3 && (
            <span className="text-xs text-gray-400">+{report.top_topics.length - 3}개</span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── 메인 MonthlyReport 컴포넌트 ──────────────────────────────────────────

export default function MonthlyReport() {
  const [reports, setReports] = useState<MonthlyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch('/api/insights/reports?limit=12');
        if (!res.ok) {
          setError('리포트 목록을 불러올 수 없습니다.');
          return;
        }
        const data = (await res.json()) as {
          success: boolean;
          data: { items: MonthlyReportItem[] };
        };
        if (data.success) {
          setReports(data.data.items);
        } else {
          setError('리포트 목록을 불러올 수 없습니다.');
        }
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    void fetchReports();
  }, []);

  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">월간 리포트</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/4 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">월간 리포트</h2>
        <p className="text-red-500 text-sm">{error}</p>
      </section>
    );
  }

  if (reports.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">월간 리포트</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">아직 생성된 리포트가 없습니다.</p>
          <p className="text-gray-400 text-xs mt-1">매월 1일에 자동으로 생성됩니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">월간 리포트</h2>

      {/* 상세 뷰 (선택된 리포트가 있을 때) */}
      {selectedMonth && (
        <ReportDetail
          month={selectedMonth}
          onClose={() => setSelectedMonth(null)}
        />
      )}

      {/* 리포트 목록 */}
      <div className="space-y-3">
        {reports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onSelect={setSelectedMonth}
          />
        ))}
      </div>
    </section>
  );
}
