// 관련 아이템 목록 컴포넌트 (같은 태그를 공유하는 콘텐츠)
// 참조: docs/specs/F-09-web-item-detail/design.md §4.6

import Link from 'next/link';
import { ChannelBadge } from '@/components/briefing/ChannelBadge';

export interface RelatedItem {
  content_id: string;
  channel: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
}

export interface RelatedItemsProps {
  items: RelatedItem[];
}

export function RelatedItems({ items }: RelatedItemsProps) {
  return (
    <section style={{ marginTop: '32px' }}>
      {/* 섹션 제목 */}
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#1A1A1A',
          marginBottom: '12px',
        }}
      >
        관련 아이템
      </h2>

      {items.length === 0 ? (
        // 빈 상태
        <p
          style={{
            fontSize: '14px',
            color: '#9E9E9E',
            textAlign: 'center',
            padding: '16px 0',
          }}
        >
          관련 아이템이 없습니다
        </p>
      ) : (
        // 관련 아이템 목록
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <Link
              key={item.content_id}
              href={`/item/${item.content_id}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <article
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E3DF',
                  borderRadius: '8px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* 채널 뱃지 */}
                <div style={{ marginBottom: '6px' }}>
                  <ChannelBadge channel={item.channel} />
                </div>

                {/* 제목 (1줄 말줄임) */}
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    lineHeight: 1.4,
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </h3>

                {/* 1줄 요약 (있을 때만) */}
                {item.summary_ai && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#5C5C5C',
                      lineHeight: 1.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.summary_ai}
                  </p>
                )}
              </article>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
