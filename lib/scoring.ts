// 관심도 점수 EMA(지수 이동 평균) 업데이트 로직
// user_interactions 저장 시 호출 → interest_profile 업데이트

// EMA 알파값: 최근 반응에 더 큰 가중치
const EMA_ALPHA = 0.1;

// 반응 유형별 점수 가중치
const INTERACTION_WEIGHTS: Record<string, number> = {
  '좋아요': 1.0,
  '저장': 0.8,
  '메모': 0.8,
  '웹열기': 0.5,
  '링크클릭': 0.4,
  '스킵': -0.3,
  '싫어요': -0.8,
};

export interface InteractionEvent {
  contentId: string;
  interaction: string;
  tags: string[];  // 해당 콘텐츠의 토픽 태그
}

/**
 * 반응 이벤트 기반으로 interest_profile EMA 업데이트
 */
export async function updateInterestScore(
  event: InteractionEvent
): Promise<void> {
  // TODO: Phase 2
  // 1. 태그별 현재 점수 조회 (interest_profile)
  // 2. EMA 계산: newScore = alpha * weight + (1 - alpha) * currentScore
  // 3. interest_profile upsert
  void EMA_ALPHA;
  void INTERACTION_WEIGHTS;
  void event;
  throw new Error('Not implemented');
}

/**
 * 관심사 프로필 기반 콘텐츠 점수 계산
 * 브리핑 아이템 선정 시 사용
 */
export function calculateContentScore(
  tags: string[],
  interestProfile: Map<string, number>
): number {
  // TODO: Phase 2
  // 태그별 관심도 점수 평균으로 콘텐츠 점수 계산
  void tags;
  void interestProfile;
  return 0.5; // 기본값
}
