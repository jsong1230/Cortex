// 메타 정보 컴포넌트 (소스, 수집 시간, 태그)
// 참조: docs/specs/F-09-web-item-detail/design.md §4.3

import { toKST } from '@/lib/utils/date';

interface ItemMetaProps {
  source: string;
  collectedAt: string;  // ISO 8601
  tags: string[] | null;
}

// KST 기준 "YYYY.MM.DD HH:MM" 형식으로 변환
function formatCollectedAt(iso: string): string {
  try {
    const date = toKST(new Date(iso));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

export function ItemMeta({ source, collectedAt, tags }: ItemMetaProps) {
  const hasTags = tags && tags.length > 0;

  return (
    <div style={{ marginTop: '8px' }}>
      {/* 소스명 */}
      <span
        style={{
          fontSize: '14px',
          color: '#5C5C5C',
          fontWeight: 400,
        }}
      >
        {source}
      </span>

      {/* 수집 시간 */}
      <p
        data-testid="collected-at"
        style={{
          fontSize: '13px',
          color: '#9E9E9E',
          marginTop: '4px',
          marginBottom: hasTags ? '8px' : '0',
        }}
      >
        {formatCollectedAt(collectedAt)}
      </p>

      {/* 태그 목록 (tags가 있을 때만) */}
      {hasTags && (
        <div
          data-testid="tags-list"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                backgroundColor: '#F3F2EF',
                color: '#5C5C5C',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500,
                lineHeight: 1,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
