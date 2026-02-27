// F-23 세렌디피티 채널 — 관심사 인접 영역 콘텐츠 선정
// AC1: 전 채널에서 관심사 인접 영역 콘텐츠를 랜덤 선정
// AC2: 약한 역가중치로 평소 관심사와 다른 영역이 선택되도록 함
// AC3: 매일 브리핑에 1개 세렌디피티 아이템 포함
// AC4: 세렌디피티 아이템 반응 별도 추적

import type { BriefingItem } from '@/lib/telegram';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

/** 세렌디피티 후보 아이템 (역가중치 계산 결과 포함) */
export interface SerendipityCandidate {
  id: string;
  title: string;
  channel: string;
  tags: string[];
  score_initial: number;
  /** 역가중치: 값이 클수록 세렌디피티로 선택될 확률이 높음 (관심도 낮을수록 큼) */
  inverseWeight: number;
}

/** 세렌디피티 반응 추적 메타데이터 (AC4) */
export interface SerendipityInteractionMeta {
  content_id: string;
  interaction: string;
  is_serendipity: true;
  serendipity_source: 'serendipity_channel';
}

/** briefing items JSONB에서 사용하는 최소 형태 */
interface BriefingItemRef {
  content_id: string;
  channel: string;
  title?: string;
}

// ─── calculateInverseWeight ───────────────────────────────────────────────────

/**
 * 태그 목록과 관심 프로필을 기반으로 역가중치 계산 (AC2)
 *
 * 공식: inverseWeight = 1.0 - averageInterestScore + 0.2 (기본 랜덤성)
 * - 관심도가 높은 태그 → 낮은 역가중치 → 세렌디피티로 선택될 가능성 낮음
 * - 프로필에 없는 태그 → interest_score = 0 → 높은 역가중치
 *
 * @param tags 콘텐츠의 토픽 태그 목록
 * @param interestProfile 관심 프로필 (topic → score, 0.0~1.0)
 */
export function calculateInverseWeight(
  tags: string[],
  interestProfile: Map<string, number>,
): number {
  if (tags.length === 0) {
    // 태그 없음 → 관심도 알 수 없음 → 최대 기본 역가중치
    return 1.0 + 0.2;
  }

  // 각 태그의 관심도 점수 평균 계산 (프로필에 없으면 0)
  const scores = tags.map((tag) => interestProfile.get(tag) ?? 0);
  const averageInterestScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  // 역가중치 = 1.0 - 평균관심도 + 0.2(기본 랜덤성)
  return 1.0 - averageInterestScore + 0.2;
}

// ─── buildSerendipityPool ────────────────────────────────────────────────────

/**
 * 전 채널 아이템에서 세렌디피티 후보 풀 생성 (AC1)
 * - 이미 channel='serendipity'인 아이템은 제외
 * - 각 후보에 inverseWeight 계산 포함
 *
 * @param items 전체 브리핑 후보 아이템
 * @param interestProfile 관심 프로필 (없으면 빈 Map → 동등한 역가중치)
 */
export function buildSerendipityPool(
  items: BriefingItem[],
  interestProfile: Map<string, number> = new Map(),
): SerendipityCandidate[] {
  return items
    .filter((item) => item.channel !== 'serendipity')
    .map((item) => ({
      id: item.id,
      title: item.title,
      channel: item.channel,
      tags: item.tags ?? [],
      score_initial: item.score_initial,
      inverseWeight: calculateInverseWeight(item.tags ?? [], interestProfile),
    }));
}

// ─── selectSerendipityItem ───────────────────────────────────────────────────

/**
 * 역가중치 기반 확률적 세렌디피티 아이템 선정 (AC1, AC2)
 * 룰렛 휠 알고리즘: 역가중치 비례 확률로 1개 선택
 *
 * @param candidates 세렌디피티 후보 목록 (SerendipityCandidate[] 또는 BriefingItem[])
 * @param interestProfile 관심 프로필 (candidates에 inverseWeight 없을 때 계산용)
 * @param excludeIds 이미 본 브리핑에 포함된 아이템 ID 집합 (제외 대상)
 * @returns 선정된 아이템 (channel을 'serendipity'로 변환), 후보 없으면 null
 */
export function selectSerendipityItem(
  candidates: (SerendipityCandidate | BriefingItem)[],
  interestProfile: Map<string, number>,
  excludeIds: Set<string> = new Set(),
): (SerendipityCandidate & { channel: 'serendipity' }) | null {
  // excludeIds 제외 후 후보 풀 구성
  const pool: SerendipityCandidate[] = candidates
    .filter((c) => !excludeIds.has(c.id) && c.channel !== 'serendipity')
    .map((c): SerendipityCandidate => {
      // 이미 inverseWeight가 있으면 그대로 사용, 없으면 계산
      if ('inverseWeight' in c && typeof c.inverseWeight === 'number') {
        return c as SerendipityCandidate;
      }
      const tags = (c as BriefingItem).tags ?? [];
      return {
        id: c.id,
        title: c.title,
        channel: c.channel,
        tags,
        score_initial: (c as BriefingItem).score_initial ?? 0.5,
        inverseWeight: calculateInverseWeight(tags, interestProfile),
      };
    });

  if (pool.length === 0) return null;

  // 룰렛 휠 선택: 역가중치 합산 기준 확률 선택
  const totalWeight = pool.reduce((sum, c) => sum + c.inverseWeight, 0);
  const threshold = Math.random() * totalWeight;

  let accumulated = 0;
  for (const candidate of pool) {
    accumulated += candidate.inverseWeight;
    if (accumulated > threshold) {
      return { ...candidate, channel: 'serendipity' as const };
    }
  }

  // 부동소수점 오차 대비 마지막 아이템 반환
  return { ...pool[pool.length - 1], channel: 'serendipity' as const };
}

// ─── isSerendipityItem ───────────────────────────────────────────────────────

/**
 * 주어진 content_id가 브리핑의 세렌디피티 아이템인지 판별 (AC4)
 * briefings.items JSONB에서 channel='serendipity'인지 확인
 *
 * @param contentId 확인할 콘텐츠 ID
 * @param briefingItems briefings 테이블의 items JSONB 배열
 */
export function isSerendipityItem(
  contentId: string,
  briefingItems: BriefingItemRef[],
): boolean {
  const item = briefingItems.find((bi) => bi.content_id === contentId);
  return item?.channel === 'serendipity';
}

// ─── buildSerendipityInteractionMeta ────────────────────────────────────────

/**
 * 세렌디피티 아이템 반응 추적 메타데이터 생성 (AC4)
 * interactions route에서 세렌디피티 반응을 별도 식별하기 위해 사용
 *
 * @param contentId 세렌디피티 아이템의 content_id
 * @param interaction 반응 타입
 */
export function buildSerendipityInteractionMeta(
  contentId: string,
  interaction: string,
): SerendipityInteractionMeta {
  return {
    content_id: contentId,
    interaction,
    is_serendipity: true,
    serendipity_source: 'serendipity_channel',
  };
}
