'use client';
// F-14 AddTopicForm — 토픽 수동 추가 폼 (AC2)
// 빈 문자열 / 중복(대소문자 무시) 검증

import { useState } from 'react';

export interface AddTopicFormProps {
  existingTopics: string[];
  onAdd: (topic: string) => void;
}

export function AddTopicForm({ existingTopics, onAdd }: AddTopicFormProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmed = value.trim();

    // 빈 문자열 검증
    if (trimmed.length === 0) {
      setError('토픽 이름을 입력해 주세요.');
      return;
    }

    // 중복 검증 (대소문자 무시)
    const isDuplicate = existingTopics.some(
      (t) => t.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setError(`"${trimmed}"은(는) 이미 존재하는 토픽입니다.`);
      return;
    }

    setError(null);
    onAdd(trimmed);
    setValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">토픽 추가</h2>
      <div className="flex gap-2">
        <input
          data-testid="add-topic-input"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="새 토픽 입력 (예: Rust, ML, GraphQL)"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          data-testid="add-topic-submit"
          type="button"
          onClick={handleSubmit}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shrink-0"
        >
          추가
        </button>
      </div>
      {error && (
        <p data-testid="add-topic-error" className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
