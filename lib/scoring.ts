// 관심도 점수 EMA(지수 이동 평균) 업데이트 로직
// user_interactions 저장 시 호출 → interest_profile 업데이트

import { createServerClient } from '@/lib/supabase/server';

// EMA 알파값: 최근 반응에 더 큰 가중치 (AC3: alpha=0.3)
export const EMA_ALPHA = 0.3;

// 반응 유형별 점수 가중치 (AC2)
export const INTERACTION_WEIGHTS: Record<string, number> = {
  '좋아요': 1.0,
  '저장': 0.8,
  '메모': 0.8,
  '웹열기': 0.5,
  '링크클릭': 0.4,
  '스킵': -0.3,
  '싫어요': -0.8,
};

// interest_profile DB 레코드 타입
interface InterestProfileRow {
  id: string;
  topic: string;
  score: number;
  interaction_count: number;
}

export interface InteractionEvent {
  contentId: string;
  interaction: string;
  tags: string[];  // 해당 콘텐츠의 토픽 태그
}

/**
 * 반응 이벤트 기반으로 interest_profile EMA 업데이트 (AC2, AC3)
 * 공식: newScore = alpha * weight + (1 - alpha) * currentScore
 * 점수 범위: 0.0 ~ 1.0 (클램핑)
 */
export async function updateInterestScore(
  event: InteractionEvent
): Promise<void> {
  if (event.tags.length === 0) return;

  const supabase = createServerClient();
  const weight = INTERACTION_WEIGHTS[event.interaction] ?? 0;

  // 1. 태그별 현재 점수 조회 (interest_profile)
  const { data: profileRows, error: selectError } = await supabase
    .from('interest_profile')
    .select('id, topic, score, interaction_count')
    .in('topic', event.tags);

  if (selectError) {
    throw new Error(`interest_profile 조회 실패: ${selectError.message}`);
  }

  // 기존 프로필 Map 구성
  const profileMap = new Map<string, InterestProfileRow>(
    (profileRows ?? []).map((row: InterestProfileRow) => [row.topic, row])
  );

  // 2. 각 태그에 대해 EMA 계산
  const upserts = event.tags.map((tag) => {
    const existing = profileMap.get(tag);
    const currentScore = existing?.score ?? 0.5;
    const interactionCount = existing?.interaction_count ?? 0;

    // EMA: newScore = alpha * weight + (1 - alpha) * currentScore
    const rawScore = EMA_ALPHA * weight + (1 - EMA_ALPHA) * currentScore;

    // 클램핑: 0.0 ~ 1.0
    const newScore = Math.max(0.0, Math.min(1.0, rawScore));

    return {
      topic: tag,
      score: newScore,
      interaction_count: interactionCount + 1,
      last_updated: new Date().toISOString(),
    };
  });

  // 3. interest_profile upsert (topic UNIQUE 제약)
  const { error: upsertError } = await supabase
    .from('interest_profile')
    .upsert(upserts, { onConflict: 'topic' });

  if (upsertError) {
    throw new Error(`interest_profile upsert 실패: ${upsertError.message}`);
  }
}

/**
 * 관심사 프로필 기반 콘텐츠 점수 계산 (AC6)
 * 브리핑 아이템 선정 시 사용
 * 태그별 점수 평균 반환, 프로필에 없는 태그는 0.5 기본값
 */
export function calculateContentScore(
  tags: string[],
  interestProfile: Map<string, number>
): number {
  if (tags.length === 0) return 0.5;

  const scores = tags.map((tag) => interestProfile.get(tag) ?? 0.5);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return avg;
}

/**
 * published_at 기반 최신성 점수 계산
 * 지수 감쇠: score = exp(-λ * hoursElapsed), λ = 0.05
 * - 0시간: 1.0, 12시간: ~0.55, 24시간: ~0.30, 48시간: ~0.09
 */
export function calculateRecencyScore(publishedAt: string | null | undefined): number {
  if (!publishedAt) return 0.5; // 발행 시각 없으면 중간값

  const publishedMs = new Date(publishedAt).getTime();
  if (isNaN(publishedMs)) return 0.5;

  const hoursElapsed = (Date.now() - publishedMs) / (1000 * 60 * 60);
  if (hoursElapsed < 0) return 1.0; // 미래 날짜 방어 처리

  const LAMBDA = 0.05;
  return Math.exp(-LAMBDA * hoursElapsed);
}

/**
 * TECH 채널 최종 점수 계산 (AC6)
 * 공식: 관심도 x 0.6 + 컨텍스트 x 0.3 + 최신성 x 0.1
 *
 * 제공된 파라미터만으로 가중 합산. 없는 값은 scoreInitial로 대체.
 * - 셋 다 없으면: scoreInitial pass-through (Phase 1)
 * - 일부만 있으면: 있는 값 가중치 비율로 정규화하여 계산
 */
export function calculateTechScore(
  scoreInitial: number,
  interestScore?: number,  // interest_profile 매칭 점수
  contextScore?: number,   // keyword_contexts 매칭 점수
  recencyScore?: number,   // calculateRecencyScore() 결과
): number {
  const hasInterest = interestScore !== undefined;
  const hasContext = contextScore !== undefined;
  const hasRecency = recencyScore !== undefined;

  // 아무것도 없으면 Phase 1 pass-through
  if (!hasInterest && !hasContext && !hasRecency) return scoreInitial;

  // 있는 값만으로 가중 합산 (가중치 정규화)
  const WEIGHTS = { interest: 0.6, context: 0.3, recency: 0.1 } as const;

  let weightedSum = 0;
  let totalWeight = 0;

  if (hasInterest) { weightedSum += interestScore! * WEIGHTS.interest; totalWeight += WEIGHTS.interest; }
  if (hasContext)  { weightedSum += contextScore!  * WEIGHTS.context;  totalWeight += WEIGHTS.context; }
  if (hasRecency)  { weightedSum += recencyScore!  * WEIGHTS.recency;  totalWeight += WEIGHTS.recency; }

  // scoreInitial로 나머지 가중치 보완 (항상 0~1 범위 유지)
  const remainingWeight = 1 - totalWeight;
  weightedSum += scoreInitial * remainingWeight;

  return weightedSum;
}
