// F-11 사용자 반응 타입 정의
// 참조: docs/specs/F-11-user-interactions/design.md

export type InteractionType =
  | '좋아요'
  | '싫어요'
  | '저장'
  | '메모'
  | '웹열기'
  | '링크클릭'
  | '스킵';

export const VALID_INTERACTIONS: InteractionType[] = [
  '좋아요',
  '싫어요',
  '저장',
  '메모',
  '웹열기',
  '링크클릭',
  '스킵',
];

export const ALL_SOURCES = ['telegram_bot', 'web', 'system'] as const;
export type SourceType = (typeof ALL_SOURCES)[number];
