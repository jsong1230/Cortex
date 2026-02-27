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
 * TECH 채널 최종 점수 계산 (AC6)
 * Phase 2 공식: 관심도 x 0.6 + 컨텍스트 x 0.3 + 최신성 x 0.1
 *
 * Phase 1: Claude가 반환한 scoreInitial을 그대로 사용
 * Phase 2: interest, context, recency 모두 제공 시 가중 합산 적용
 */
export function calculateTechScore(
  scoreInitial: number,
  interestScore?: number,  // Phase 2: interest_profile 매칭 점수
  contextScore?: number,   // Phase 3: keyword_contexts 매칭 점수
  recencyScore?: number,   // published_at 기반 최신성 점수
): number {
  // Phase 2 활성화: 세 값이 모두 제공된 경우
  if (interestScore !== undefined && contextScore !== undefined && recencyScore !== undefined) {
    return interestScore * 0.6 + contextScore * 0.3 + recencyScore * 0.1;
  }

  // Phase 1: Claude 직접 반환 점수 사용 (pass-through)
  return scoreInitial;
}
