// F-17 AC4 — 3일 연속 같은 이슈 감지 + "계속 팔로우 중" 축약 표시 단위 테스트

import { describe, it, expect } from 'vitest';

import {
  detectRepeatingIssues,
  markAsFollowing,
  type BriefingItemWithFollowing,
} from '@/lib/fatigue-prevention';
import type { BriefingItem } from '@/lib/telegram';

// ─── 픽스처 헬퍼 ─────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<BriefingItem>): BriefingItem {
  return {
    id: 'item-1',
    channel: 'tech',
    source: 'hackernews',
    source_url: 'https://example.com/1',
    title: 'AI 규제 법안 논의',
    summary_ai: '관련 요약',
    score_initial: 0.8,
    tags: ['AI', '규제'],
    ...overrides,
  };
}

// ─── detectRepeatingIssues 테스트 ────────────────────────────────────────────

describe('detectRepeatingIssues', () => {
  it('AC4-1: 3일 연속 등장하는 태그를 가진 아이템을 반복 이슈로 감지한다', () => {
    const currentItems: BriefingItem[] = [
      makeItem({ id: 'today-1', tags: ['AI', '규제'] }),
      // today-2: 경제 태그만, 제목도 다름 → 반복 이슈 아님
      makeItem({ id: 'today-2', channel: 'world', title: '한국 경제 성장률 전망', tags: ['경제'] }),
    ];

    // 과거 2일치 아이템 (같은 태그 포함)
    const pastItems: BriefingItem[][] = [
      [makeItem({ id: 'yesterday-1', tags: ['AI', '규제'] })],
      [makeItem({ id: 'daybefore-1', tags: ['AI', '규제'] })],
    ];

    const result = detectRepeatingIssues(currentItems, pastItems);

    // 'today-1'은 3일 연속 AI+규제 태그가 있으므로 반복 이슈
    expect(result.has('today-1')).toBe(true);
    // 'today-2'는 경제 태그가 이전에 없으므로 반복 아님
    expect(result.has('today-2')).toBe(false);
  });

  it('AC4-2: 2일만 등장하면 반복 이슈로 감지하지 않는다', () => {
    const currentItems: BriefingItem[] = [
      makeItem({ id: 'today-1', tags: ['AI', '규제'] }),
    ];

    // 과거 1일치만 같은 태그
    const pastItems: BriefingItem[][] = [
      [makeItem({ id: 'yesterday-1', tags: ['AI', '규제'] })],
      [makeItem({ id: 'daybefore-1', title: '전혀 무관한 뉴스', tags: ['날씨'] })],
    ];

    const result = detectRepeatingIssues(currentItems, pastItems);

    expect(result.has('today-1')).toBe(false);
  });

  it('AC4-3: 과거 아이템이 없으면 빈 Set을 반환한다', () => {
    const currentItems: BriefingItem[] = [
      makeItem({ id: 'today-1', tags: ['AI'] }),
    ];

    const result = detectRepeatingIssues(currentItems, []);

    expect(result.size).toBe(0);
  });

  it('AC4-4: 태그가 빈 배열이면 태그 기반 감지를 하지 않는다', () => {
    // tags: [] → 태그 기반 매칭 없음 / 제목이 서로 다르면 제목 매칭도 없음
    const currentItems: BriefingItem[] = [
      makeItem({ id: 'today-1', title: '오늘의 날씨 맑음', tags: [] }),
    ];

    const pastItems: BriefingItem[][] = [
      [makeItem({ id: 'y-1', title: '어제의 스포츠 결과', tags: [] })],
      [makeItem({ id: 'd-1', title: '그제의 연예 소식', tags: [] })],
    ];

    const result = detectRepeatingIssues(currentItems, pastItems);

    expect(result.has('today-1')).toBe(false);
  });

  it('AC4-5: 타이틀 유사성으로도 반복 이슈를 감지한다', () => {
    // tags가 없더라도 타이틀에 공통 키워드가 2개 이상 3일 연속이면 감지
    const currentItems: BriefingItem[] = [
      makeItem({ id: 'today-1', title: 'AI 규제 법안 3차 심의', tags: undefined }),
    ];

    const pastItems: BriefingItem[][] = [
      [makeItem({ id: 'y-1', title: 'AI 규제 법안 2차 심의', tags: undefined })],
      [makeItem({ id: 'd-1', title: 'AI 규제 법안 1차 심의', tags: undefined })],
    ];

    const result = detectRepeatingIssues(currentItems, pastItems);

    // "AI 규제 법안"이라는 공통 키워드가 3일 연속
    expect(result.has('today-1')).toBe(true);
  });
});

// ─── markAsFollowing 테스트 ───────────────────────────────────────────────────

describe('markAsFollowing', () => {
  it('AC4-6: markAsFollowing으로 처리된 아이템에 is_following=true가 설정된다', () => {
    const item = makeItem({ id: 'item-1' });
    const result: BriefingItemWithFollowing = markAsFollowing(item);

    expect(result.is_following).toBe(true);
  });

  it('AC4-7: markAsFollowing된 아이템에 원본 필드가 보존된다', () => {
    const item = makeItem({ id: 'item-1', title: '원본 타이틀', summary_ai: '원본 요약' });
    const result = markAsFollowing(item);

    expect(result.title).toBe('원본 타이틀');
    expect(result.id).toBe('item-1');
  });
});
