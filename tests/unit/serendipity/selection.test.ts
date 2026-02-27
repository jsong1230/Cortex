// F-23 세렌디피티 — selectSerendipityItem 단위 테스트
// AC1: 전 채널에서 관심사 인접 영역의 콘텐츠를 랜덤 선정
// AC2: 약한 역가중치 적용으로 평소 관심사와 다른 영역이 선택됨

import { describe, it, expect, vi, afterEach } from 'vitest';
import { selectSerendipityItem, type SerendipityCandidate } from '@/lib/serendipity';

afterEach(() => {
  vi.restoreAllMocks();
});

// 테스트 픽스처
function makeCandidate(overrides: Partial<SerendipityCandidate> = {}): SerendipityCandidate {
  return {
    id: 'item-1',
    title: '테스트 아이템',
    channel: 'tech',
    tags: ['llm'],
    score_initial: 0.8,
    inverseWeight: 0.5,
    ...overrides,
  };
}

describe('selectSerendipityItem', () => {
  it('AC1-1: 후보가 없으면 null을 반환한다', () => {
    const profile = new Map<string, number>();
    const result = selectSerendipityItem([], profile);
    expect(result).toBeNull();
  });

  it('AC1-2: 후보가 1개면 해당 아이템을 반환한다', () => {
    const profile = new Map<string, number>();
    const candidates = [makeCandidate({ id: 'only-item' })];
    const result = selectSerendipityItem(candidates, profile);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('only-item');
  });

  it('AC1-3: 이미 선정된 아이템(excludeIds)은 제외된다', () => {
    const profile = new Map<string, number>();
    const candidates = [
      makeCandidate({ id: 'exclude-me', tags: [] }),
      makeCandidate({ id: 'pick-me', tags: ['cooking'] }),
    ];
    const result = selectSerendipityItem(candidates, profile, new Set(['exclude-me']));
    expect(result).not.toBeNull();
    expect(result!.id).toBe('pick-me');
  });

  it('AC1-4: 모든 후보가 excludeIds에 포함되면 null을 반환한다', () => {
    const profile = new Map<string, number>();
    const candidates = [makeCandidate({ id: 'only-item' })];
    const result = selectSerendipityItem(candidates, profile, new Set(['only-item']));
    expect(result).toBeNull();
  });

  it('AC2-1: 역가중치가 높은 아이템(낮은 관심도)이 더 자주 선택된다', () => {
    // Math.random을 고정하여 결정론적 테스트
    // 역가중치 합 = 0.2(고관심) + 1.2(저관심) = 1.4
    // random 0.5 → 0.5 * 1.4 = 0.7 → 0.2(첫번째) < 0.7이므로 두 번째 선택
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const profile = new Map<string, number>([
      ['llm', 1.0],      // 고관심 → 역가중치 0.2
      ['cooking', 0.0],  // 저관심 → 역가중치 1.2
    ]);
    const candidates = [
      makeCandidate({ id: 'high-interest', tags: ['llm'] }),
      makeCandidate({ id: 'low-interest', tags: ['cooking'] }),
    ];
    const result = selectSerendipityItem(candidates, profile);
    expect(result).not.toBeNull();
    // random=0.5 → 누적 역가중치 0.2 초과 → low-interest 선택
    expect(result!.id).toBe('low-interest');
  });

  it('AC2-2: random=0으로 시작하면 첫 번째 아이템이 선택된다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const profile = new Map<string, number>();
    const candidates = [
      makeCandidate({ id: 'first', tags: [] }),
      makeCandidate({ id: 'second', tags: [] }),
    ];
    const result = selectSerendipityItem(candidates, profile);
    expect(result!.id).toBe('first');
  });

  it('AC1-5: 반환된 아이템의 channel은 "serendipity"로 변환된다', () => {
    const profile = new Map<string, number>();
    const candidates = [makeCandidate({ id: 'item-x', channel: 'tech' })];
    const result = selectSerendipityItem(candidates, profile);
    expect(result).not.toBeNull();
    expect(result!.channel).toBe('serendipity');
  });

  it('AC3-1: 프로필이 없어도(빈 Map) 정상적으로 폴백 선택을 한다', () => {
    const emptyProfile = new Map<string, number>();
    const candidates = [
      makeCandidate({ id: 'item-a', tags: ['unknown-1'] }),
      makeCandidate({ id: 'item-b', tags: ['unknown-2'] }),
    ];
    const result = selectSerendipityItem(candidates, emptyProfile);
    expect(result).not.toBeNull();
    // 둘 다 역가중치 1.2 → 결정론적이지 않지만 반드시 하나가 선택됨
    expect(['item-a', 'item-b']).toContain(result!.id);
  });
});
