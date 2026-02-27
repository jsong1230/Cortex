// F-23 세렌디피티 — trackSerendipityReaction 단위 테스트
// AC4: 세렌디피티 아이템에 대한 반응이 별도로 추적된다

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSerendipityItem, buildSerendipityInteractionMeta } from '@/lib/serendipity';

describe('isSerendipityItem', () => {
  it('AC4-1: briefing items 중 channel=serendipity인 아이템이면 true를 반환한다', () => {
    const briefingItems = [
      { content_id: 'item-a', channel: 'tech', title: 'Tech Article' },
      { content_id: 'item-s', channel: 'serendipity', title: 'Serendipity Article' },
    ];
    expect(isSerendipityItem('item-s', briefingItems)).toBe(true);
  });

  it('AC4-2: channel이 serendipity가 아닌 아이템이면 false를 반환한다', () => {
    const briefingItems = [
      { content_id: 'item-a', channel: 'tech', title: 'Tech Article' },
    ];
    expect(isSerendipityItem('item-a', briefingItems)).toBe(false);
  });

  it('AC4-3: briefing items에 없는 content_id이면 false를 반환한다', () => {
    const briefingItems = [
      { content_id: 'item-a', channel: 'tech', title: 'Tech Article' },
    ];
    expect(isSerendipityItem('nonexistent', briefingItems)).toBe(false);
  });

  it('AC4-4: briefing items가 빈 배열이면 false를 반환한다', () => {
    expect(isSerendipityItem('item-x', [])).toBe(false);
  });
});

describe('buildSerendipityInteractionMeta', () => {
  it('AC4-5: 세렌디피티 소스 메타데이터를 올바르게 생성한다', () => {
    const meta = buildSerendipityInteractionMeta('item-s', '좋아요');
    expect(meta.is_serendipity).toBe(true);
    expect(meta.content_id).toBe('item-s');
    expect(meta.interaction).toBe('좋아요');
    expect(meta.serendipity_source).toBe('serendipity_channel');
  });

  it('AC4-6: 다양한 interaction 타입에 대해 올바른 메타데이터를 생성한다', () => {
    const reactions = ['좋아요', '저장', '싫어요', '웹열기'] as const;
    for (const reaction of reactions) {
      const meta = buildSerendipityInteractionMeta('test-id', reaction);
      expect(meta.interaction).toBe(reaction);
      expect(meta.is_serendipity).toBe(true);
    }
  });
});
