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

/**
 * TECH 채널 최종 점수 계산
 * 공식: 관심도 x 0.6 + 컨텍스트 x 0.3 + 최신성 x 0.1
 *
 * Phase 1에서는 Claude가 반환한 scoreInitial을 그대로 사용하므로,
 * 이 함수는 scoreInitial을 그대로 반환한다.
 *
 * Phase 2에서는 interest_profile 기반 정밀 스코어링으로 전환 예정.
 */
export function calculateTechScore(
  scoreInitial: number,
  _interestScore?: number,  // Phase 2: interest_profile 매칭 점수
  _contextScore?: number,   // Phase 3: keyword_contexts 매칭 점수
  _recencyScore?: number,   // published_at 기반 최신성 점수
): number {
  // Phase 1: Claude 직접 반환 점수 사용 (pass-through)
  return scoreInitial;

  // Phase 2 활성화 시:
  // const interest = interestScore ?? scoreInitial;
  // const context = contextScore ?? 0;
  // const recency = recencyScore ?? 0.5;
  // return interest * 0.6 + context * 0.3 + recency * 0.1;
}
