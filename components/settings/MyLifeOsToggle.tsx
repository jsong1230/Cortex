'use client';
// My Life OS 연동 ON/OFF 토글 컴포넌트
// F-20 AC5: My Life OS 연동 ON/OFF 토글
// /api/settings/mylifeos API 활용

import { useState } from 'react';

interface MyLifeOsToggleProps {
  initialEnabled: boolean;
}

export function MyLifeOsToggle({ initialEnabled }: MyLifeOsToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  /** My Life OS 연동 ON/OFF 토글 처리 */
  async function handleToggle() {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    setSaving(true);

    try {
      await fetch('/api/settings/mylifeos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="mylifeos-toggle"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
      }}
    >
      <div>
        <p
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: '#1A1A1A',
            marginBottom: '4px',
          }}
        >
          📓 My Life OS 연동
        </p>
        <p style={{ fontSize: '13px', color: '#8C8C8C' }}>
          {enabled
            ? '일기/메모 키워드를 브리핑 큐레이션에 반영합니다'
            : '연동이 비활성화되어 있습니다'}
        </p>
      </div>
      <input
        id="mylifeos-enabled"
        type="checkbox"
        role="checkbox"
        aria-label="My Life OS 연동"
        checked={enabled}
        onChange={handleToggle}
        disabled={saving}
        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
      />
    </div>
  );
}
