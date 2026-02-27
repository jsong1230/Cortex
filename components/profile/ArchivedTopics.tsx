'use client';
// F-14 ArchivedTopics — 보관된 토픽 접기/펼치기 섹션 (AC4)

import { useState } from 'react';
import type { InterestTopic } from '@/components/profile/InterestChart';

interface ArchivedTopicsProps {
  topics: InterestTopic[];
  onRestore: (id: string) => void;
}

export function ArchivedTopics({ topics, onRestore }: ArchivedTopicsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* 접기/펼치기 헤더 */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={isOpen}
        data-testid="archived-toggle"
      >
        <span className="text-lg font-semibold text-gray-900">
          보관된 토픽{' '}
          <span className="text-sm font-normal text-gray-400">({topics.length})</span>
        </span>
        <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* 보관 목록 */}
      {isOpen && (
        <div data-testid="archived-list" className="mt-4">
          {topics.length === 0 ? (
            <p className="text-sm text-gray-400">보관된 토픽이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {topics.map((topic) => (
                <li
                  key={topic.id}
                  data-testid={`archived-row-${topic.id}`}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <span className="text-sm text-gray-500">{topic.topic}</span>
                    {topic.archived_at && (
                      <span className="ml-2 text-xs text-gray-300">
                        {new Date(topic.archived_at).toLocaleDateString('ko-KR')} 보관
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(topic.id)}
                    data-testid={`restore-btn-${topic.id}`}
                    className="px-3 py-1 text-xs rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    복원
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
