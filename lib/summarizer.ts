// Claude API 요약 + 스코어링 모듈 (모든 AI 호출 집중)
// 비용 추적을 위해 Claude API 호출은 이 파일에서만 수행

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SummarizeInput {
  title: string;
  fullText?: string;  // 처음 500자만 사용 (토큰 절약)
  source: string;
}

export interface SummarizeResult {
  summaryAi: string;      // 1~2줄 요약
  tags: string[];         // AI 추출 토픽 태그
  scoreInitial: number;   // 초기 관심도 점수 (0.0~1.0)
  tokensUsed: number;     // 비용 추적용
}

/**
 * 콘텐츠 아이템 배치 요약 (채널별 5~10개씩 묶어서 처리)
 * 개별 호출 대신 배치 처리로 비용 최적화
 */
export async function summarizeBatch(
  items: SummarizeInput[]
): Promise<SummarizeResult[]> {
  // TODO: Phase 0 — Claude API 배치 요약 구현
  // - 입력: title + fullText 처음 500자
  // - 출력: 요약, 태그, 초기 점수 JSON 배열
  void items;

  throw new Error('Not implemented');
}

/**
 * WORLD 채널 중요도 판단 (Claude가 뉴스 헤드라인 선별)
 */
export async function selectWorldItems(
  headlines: string[]
): Promise<number[]> {
  // TODO: Phase 0
  void headlines;
  throw new Error('Not implemented');
}

/**
 * 세렌디피티 아이템 선정 (관심사 인접 랜덤)
 */
export async function selectSerendipityItem(
  interestTopics: string[],
  candidates: SummarizeInput[]
): Promise<number> {
  // TODO: Phase 2
  void interestTopics;
  void candidates;
  throw new Error('Not implemented');
}

/**
 * 월간 인사이트 생성 (Phase 4)
 */
export async function generateMonthlyInsight(
  monthlyData: Record<string, unknown>
): Promise<string> {
  // TODO: Phase 4
  void monthlyData;
  void anthropic;
  throw new Error('Not implemented');
}
