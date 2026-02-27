'use client';
// RSS 소스 관리 컴포넌트
// F-20 AC1: 사용자 정의 RSS URL 추가/삭제
// /api/settings/rss API 활용

import { useState } from 'react';

export interface RssSource {
  url: string;
  name: string;
  channel: 'tech' | 'world' | 'culture' | 'canada';
}

interface RssSourcesProps {
  initialSources: RssSource[];
}

const CHANNEL_OPTIONS: Array<{ value: RssSource['channel']; label: string }> = [
  { value: 'tech', label: '🖥️ TECH' },
  { value: 'world', label: '🌍 WORLD' },
  { value: 'culture', label: '🎬 CULTURE' },
  { value: 'canada', label: '🍁 TORONTO' },
];

export function RssSources({ initialSources }: RssSourcesProps) {
  const [sources, setSources] = useState<RssSource[]>(initialSources);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [newChannel, setNewChannel] = useState<RssSource['channel']>('tech');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null); // 삭제 중인 URL
  const [error, setError] = useState<string | null>(null);

  /** RSS URL 추가 처리 */
  async function handleAdd() {
    // 빈 URL이면 아무것도 하지 않음
    if (!newUrl.trim()) return;

    setAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl.trim(),
          name: newName.trim() || undefined,
          channel: newChannel,
        }),
      });

      const data = await response.json() as { success: boolean; data?: RssSource[]; error?: string };

      if (!response.ok || !data.success) {
        setError(data.error ?? '추가 실패');
        return;
      }

      if (data.data) {
        setSources(data.data);
      }
      setNewUrl('');
      setNewName('');
      setNewChannel('tech');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setAdding(false);
    }
  }

  /** RSS URL 삭제 처리 */
  async function handleDelete(url: string) {
    setDeleting(url);
    setError(null);

    try {
      const response = await fetch('/api/settings/rss', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json() as { success: boolean; data?: RssSource[]; error?: string };

      if (!response.ok || !data.success) {
        setError(data.error ?? '삭제 실패');
        return;
      }

      if (data.data) {
        setSources(data.data);
      } else {
        setSources((prev) => prev.filter((s) => s.url !== url));
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      {/* 기존 RSS 소스 목록 */}
      {sources.length === 0 ? (
        <p
          data-testid="rss-empty-message"
          style={{ color: '#5C5C5C', fontSize: '14px', padding: '12px 0' }}
        >
          등록된 RSS 소스가 없습니다. 아래에서 새 소스를 추가하세요.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0' }}>
          {sources.map((source) => (
            <li
              key={source.url}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid #E5E3DF',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                <p
                  style={{
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#1A1A1A',
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {source.name}
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#8C8C8C',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {source.url}
                </p>
              </div>
              <button
                type="button"
                aria-label={`삭제 ${source.name}`}
                onClick={() => handleDelete(source.url)}
                disabled={deleting === source.url}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 에러 메시지 */}
      {error && (
        <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
      )}

      {/* 새 RSS URL 추가 폼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          data-testid="rss-url-input"
          type="url"
          placeholder="https://example.com/feed.xml"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #E5E3DF',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#1A1A1A',
          }}
        />
        <input
          data-testid="rss-name-input"
          type="text"
          placeholder="소스 이름 (선택)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #E5E3DF',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#1A1A1A',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            data-testid="rss-channel-select"
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value as RssSource['channel'])}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #E5E3DF',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#1A1A1A',
              backgroundColor: '#FFFFFF',
            }}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            data-testid="rss-add-button"
            type="button"
            onClick={handleAdd}
            disabled={adding}
            style={{
              padding: '8px 20px',
              backgroundColor: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
