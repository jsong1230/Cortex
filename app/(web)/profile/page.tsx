// /profile — 관심사 프로필 시각화 (F-14)
// AC1: 토픽별 관심도 차트
// AC2: 수동 추가/삭제/스코어 조정
// AC3: Top 10 하이라이트
// AC4: 보관된 토픽 확인

'use client';

import type { Metadata } from 'next';
import { useState, useEffect, useCallback } from 'react';
import { InterestChart } from '@/components/profile/InterestChart';
import type { InterestTopic } from '@/components/profile/InterestChart';
import { TopicList } from '@/components/profile/TopicList';
import { AddTopicForm } from '@/components/profile/AddTopicForm';
import { ArchivedTopics } from '@/components/profile/ArchivedTopics';

// metadata는 Server Component에서만 export 가능하므로 별도 layout에서 처리하거나
// generateMetadata를 사용한다. 'use client' 페이지에서는 HTML title 태그로 처리.

export default function ProfilePage() {
  const [topics, setTopics] = useState<InterestTopic[]>([]);
  const [archivedTopics, setArchivedTopics] = useState<InterestTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── 데이터 로드 ────────────────────────────────────────────────────────────

  const fetchTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [activeRes, archivedRes] = await Promise.all([
        fetch('/api/profile/interests'),
        fetch('/api/profile/interests/archived'),
      ]);

      if (!activeRes.ok || !archivedRes.ok) {
        throw new Error('관심사 데이터 로드 실패');
      }

      const activeJson = await activeRes.json();
      const archivedJson = await archivedRes.json();

      if (activeJson.success) setTopics(activeJson.data.topics);
      if (archivedJson.success) setArchivedTopics(archivedJson.data.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // ─── 핸들러 ─────────────────────────────────────────────────────────────────

  // 토픽 추가
  async function handleAddTopic(topicName: string) {
    const res = await fetch('/api/profile/interests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topicName }),
    });
    if (res.ok) {
      await fetchTopics();
    }
  }

  // 스코어 조정
  async function handleScoreAdjust(id: string, delta: number) {
    const current = topics.find((t) => t.id === id);
    if (!current) return;

    const newScore = Math.max(0, Math.min(1, current.score + delta));
    const res = await fetch('/api/profile/interests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, score: newScore }),
    });
    if (res.ok) {
      await fetchTopics();
    }
  }

  // 토픽 아카이브
  async function handleArchive(id: string) {
    const res = await fetch('/api/profile/interests', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      await fetchTopics();
    }
  }

  // 보관 토픽 복원
  async function handleRestore(id: string) {
    const res = await fetch('/api/profile/interests/archived', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      await fetchTopics();
    }
  }

  // ─── 렌더링 ─────────────────────────────────────────────────────────────────

  const existingTopicNames = topics.map((t) => t.topic);

  return (
    <main className="min-h-screen bg-gray-50">
      <title>Cortex — 관심사 프로필</title>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">관심사 프로필</h1>

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="text-center py-8 text-gray-400" data-testid="profile-loading">
            관심사 데이터를 불러오는 중...
          </div>
        )}

        {/* 에러 상태 */}
        {error && !isLoading && (
          <div
            className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600"
            data-testid="profile-error"
          >
            {error}
          </div>
        )}

        {/* 콘텐츠 */}
        {!isLoading && !error && (
          <>
            {/* AC1, AC3: 관심도 차트 (Top 10 시각화) */}
            <InterestChart topics={topics} />

            {/* AC2: 토픽 추가 폼 */}
            <AddTopicForm
              existingTopics={existingTopicNames}
              onAdd={handleAddTopic}
            />

            {/* AC2, AC3: 토픽 목록 (스코어 조정 + 아카이브) */}
            <TopicList
              topics={topics}
              onScoreAdjust={handleScoreAdjust}
              onArchive={handleArchive}
            />

            {/* AC4: 보관된 토픽 */}
            <ArchivedTopics
              topics={archivedTopics}
              onRestore={handleRestore}
            />
          </>
        )}
      </div>
    </main>
  );
}
