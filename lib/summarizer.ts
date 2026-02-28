// Claude API 요약 + 스코어링 모듈 (모든 AI 호출 집중)
// 비용 추적을 위해 Claude API 호출은 이 파일에서만 수행
// design.md F-05 기반 구현

import Anthropic from '@anthropic-ai/sdk';
import type { Channel } from './collectors/types';

// Claude API 재시도 설정
const MAX_RETRIES = 1;
// 테스트 환경에서는 재시도 대기 없이 즉시 실행
const RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 2000;
// Rate Limit(429) 전용 재시도 대기
const RATE_LIMIT_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 5000;

// fullText 최대 사용 길이 (토큰 절약)
const FULL_TEXT_MAX_LENGTH = 500;

/** 요약 + 스코어링 입력 (DB에서 조회한 아이템) */
export interface SummarizeInput {
  id: string;              // content_items.id (DB 업데이트용)
  title: string;
  fullText?: string;       // 처음 500자만 사용 (토큰 절약)
  source: string;
  channel: Channel;
  publishedAt?: Date;
}

/** 요약 + 스코어링 출력 (Claude 응답을 파싱한 결과) */
export interface SummarizeResult {
  id: string;              // content_items.id
  summaryAi: string;       // 1~2줄 한국어 요약
  tags: string[];          // AI 추출 토픽 태그 (최대 5개)
  scoreInitial: number;    // 초기 관심도 점수 (0.0~1.0)
  tokensUsed: number;      // 비용 추적용
}

/** Claude API 호출 통계 (로깅용) */
export interface SummarizeStats {
  totalItems: number;
  summarized: number;
  cached: number;          // 이미 요약이 있어 스킵한 수
  failed: number;
  totalTokensUsed: number;
  durationMs: number;
}

/** WORLD 채널 선정 결과 */
export interface WorldSelectionResult {
  selectedIndices: number[];  // 선정된 아이템의 인덱스 (원본 배열 기준)
  reason: string;             // 선정 이유 (로깅용)
  tokensUsed: number;
}

/** Claude 응답의 개별 아이템 파싱 결과 */
interface ClaudeResponseItem {
  index: number;
  summary: string;
  tags: string[];
  score: number;
}

/** WORLD 선정 응답 */
interface WorldSelectionResponse {
  selected: number[];
  reason: string;
}

// 공통 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 Cortex라는 개인 AI 브리핑 서비스의 콘텐츠 분석 엔진입니다.
사용자는 50대 초반 CTO로, LLM 인프라/클라우드 비용 최적화/MSA/팀 빌딩/스타트업 전략에 관심이 있습니다.
개인 생활: 등산(주 2-3회), 골프(주 1회), 한국-캐나다 원격 가족 생활.

입력된 콘텐츠 아이템들을 분석하여, 각 아이템에 대해:
1. 한국어 1~2줄 요약 (핵심만 간결하게)
2. 토픽 태그 (영어, 최대 5개)
3. 관심도 점수 (0.0~1.0)
를 JSON 배열로 반환하세요.

규칙:
- 요약은 반드시 한국어로 작성
- 요약은 1~2문장, 80자 이내 권장
- 태그는 소문자 영어, 공백 대신 하이픈 사용 (예: "cloud-cost", "team-building")
- 점수는 소수점 1자리까지 (예: 0.7)
- 응답은 순수 JSON만 반환 (마크다운 코드블록 없이)`;

// Anthropic 클라이언트 lazy singleton (모듈당 1회만 생성)
let _anthropicClient: Anthropic | null = null;

/**
 * Anthropic 클라이언트 lazy singleton getter (환경변수 검증 포함)
 * 환경변수가 변경될 수 있는 테스트에서는 매번 재생성
 */
function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  }
  // 테스트 환경에서는 singleton을 사용하지 않고 매번 새 인스턴스 생성
  // (vi.resetAllMocks 후 API key 재설정 시 정확한 동작 보장)
  if (process.env.NODE_ENV === 'test') {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropicClient;
}

/**
 * 채널별 배치 프롬프트 생성 (공개 — 테스트에서 직접 검증)
 */
export function buildBatchPrompt(items: SummarizeInput[], channel: Channel): string {
  const contentList = items.map((item, idx) => ({
    index: idx,
    title: item.title,
    text: item.fullText ? item.fullText.slice(0, FULL_TEXT_MAX_LENGTH) : '',
  }));

  const contentJson = JSON.stringify(contentList, null, 2);

  const channelInstructions: Record<Channel, string> = {
    tech: `아래 기술 콘텐츠들을 분석하세요.

관심도 점수 기준:
- 사용자의 관심 분야(LLM, 클라우드, MSA, 팀빌딩, 스타트업)와의 관련성을 가장 높게 반영 (관심도: 0.6)
- 실무 적용 가능성 (0.3)
- 최신성과 화제성 (0.1)`,

    world: `아래 뉴스 콘텐츠들을 분석하세요.

관심도 점수 기준:
- 40~50대 직장인에게 중요한 사회/경제 이슈인지 (0.6)
- 현재 화제성과 영향력 (0.3)
- 구조적 변화 여부 (0.1)`,

    culture: `아래 한국 문화/트렌드 콘텐츠들을 분석하세요.

관심도 점수 기준:
- 플랫폼 내 순위가 높을수록 높은 점수 (순위: 0.5)
- 검색량/조회수가 높을수록 높은 점수 (0.3)
- 세대를 아우르는 화제성 가중 (0.2)`,

    canada: `아래 토론토/캐나다 콘텐츠들을 분석하세요.

관심도 점수 기준:
- 토론토 거주 가족의 일상에 직접 영향을 미치는 정도 (0.6)
- 뉴스 중요도 (지역 사회 영향) (0.3)
- 날씨 아이템은 항상 점수 0.9 이상 (고정 포함 대상) (0.1)`,
  };

  return `${channelInstructions[channel]}

콘텐츠 목록:
${contentJson}

응답 형식:
[
  {"index": 0, "summary": "...", "tags": ["tag1", "tag2"], "score": 0.8},
  ...
]`;
}

/**
 * Claude API 호출 래퍼 (재시도 1회 포함)
 * - 429 (Rate Limit): 5초 대기 후 재시도 (design.md 섹션 7.2)
 * - 그 외 에러: 2초 대기 후 재시도
 */
async function callClaudeAPI(
  prompt: string,
  systemPrompt: string,
  retryCount = 0,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const anthropic = getAnthropicClient();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude 응답에 텍스트 블록이 없습니다');
    }

    return {
      text: textBlock.text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      // 429 Rate Limit 에러는 5초 대기, 그 외는 2초 대기 (design.md 섹션 7.2)
      // Anthropic.RateLimitError가 모킹 환경에서 존재하지 않을 수 있으므로 안전하게 처리
      const isRateLimit =
        (typeof Anthropic.RateLimitError === 'function' &&
          error instanceof Anthropic.RateLimitError) ||
        (typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          (error as { status: number }).status === 429);
      const delayMs = isRateLimit ? RATE_LIMIT_DELAY_MS : RETRY_DELAY_MS;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return callClaudeAPI(prompt, systemPrompt, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Claude 응답 JSON 파싱 + 유효성 검증
 */
function parseClaudeResponse(
  responseText: string,
  items: SummarizeInput[],
): ClaudeResponseItem[] | null {
  try {
    // 마크다운 코드블록 제거 (방어 처리)
    const cleaned = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      return null;
    }

    // 각 아이템 유효성 검증
    return parsed
      .filter(
        (item): item is ClaudeResponseItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.index === 'number' &&
          item.index >= 0 &&
          item.index < items.length &&
          typeof item.summary === 'string' &&
          Array.isArray(item.tags) &&
          typeof item.score === 'number',
      )
      .map((item) => ({
        ...item,
        // 점수 클램핑: 0.0 ~ 1.0
        score: Math.min(1.0, Math.max(0.0, item.score)),
      }));
  } catch {
    return null;
  }
}

/**
 * 에러 시 폴백 결과 생성 (AC4)
 * summaryAi = title, scoreInitial = 0.5, tags = []
 */
function applyFallback(item: SummarizeInput): SummarizeResult {
  return {
    id: item.id,
    summaryAi: item.title || '(제목 없음)',
    tags: [],
    scoreInitial: 0.5,
    tokensUsed: 0,
  };
}

/**
 * 토큰/비용 사용량 구조화 로깅
 */
function logUsage(stats: SummarizeStats): void {
  // Vercel Logs에서 검색 가능한 구조화 로깅
  // eslint-disable-next-line no-console
  console.info(
    JSON.stringify({
      event: 'cortex_summarize_complete',
      totalItems: stats.totalItems,
      summarized: stats.summarized,
      cached: stats.cached,
      failed: stats.failed,
      totalTokensUsed: stats.totalTokensUsed,
      estimatedCostUsd: (stats.totalTokensUsed / 1_000_000) * 9,
      durationMs: stats.durationMs,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * 채널별 배치 요약 + 스코어링 처리
 * @param channelItems 동일 채널의 아이템 목록
 * @param channel 채널 타입
 */
async function summarizeChannel(
  channelItems: SummarizeInput[],
  channel: Channel,
): Promise<SummarizeResult[]> {
  const prompt = buildBatchPrompt(channelItems, channel);

  let responseText: string;
  let inputTokens: number;
  let outputTokens: number;

  try {
    const response = await callClaudeAPI(prompt, SYSTEM_PROMPT);
    responseText = response.text;
    inputTokens = response.inputTokens;
    outputTokens = response.outputTokens;
  } catch {
    // Claude API 호출 전체 실패 → 배치 전체 폴백
    return channelItems.map(applyFallback);
  }

  // JSON 파싱 시도
  const parsed = parseClaudeResponse(responseText, channelItems);
  if (!parsed) {
    // JSON 파싱 실패 → 배치 전체 폴백
    return channelItems.map(applyFallback);
  }

  // 총 토큰을 아이템 수로 나누어 배분
  const tokensPerItem =
    parsed.length > 0 ? Math.floor((inputTokens + outputTokens) / parsed.length) : 0;

  // 파싱 결과를 index 기준으로 매핑
  const resultMap = new Map<number, ClaudeResponseItem>();
  parsed.forEach((item) => resultMap.set(item.index, item));

  // 각 아이템에 결과 적용 (누락된 아이템은 폴백)
  return channelItems.map((inputItem, idx): SummarizeResult => {
    const parsedItem = resultMap.get(idx);
    if (!parsedItem) {
      return applyFallback(inputItem);
    }

    // WORLD 채널 선정 아이템은 score_initial 0.8 고정 (design.md 섹션 5.4)
    const scoreInitial = channel === 'world' ? 0.8 : parsedItem.score;

    return {
      id: inputItem.id,
      summaryAi: parsedItem.summary,
      tags: parsedItem.tags,
      scoreInitial,
      tokensUsed: tokensPerItem,
    };
  });
}

/**
 * 수집된 아이템 배치 요약 + 스코어링 (메인 함수)
 * 채널별로 그룹핑하여 병렬 처리
 */
export async function summarizeAndScore(items: SummarizeInput[]): Promise<SummarizeResult[]> {
  if (items.length === 0) {
    return [];
  }

  // ANTHROPIC_API_KEY 검증
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  }

  const startTime = Date.now();

  // 채널별 그룹핑
  const channelGroups = new Map<Channel, SummarizeInput[]>();
  for (const item of items) {
    const group = channelGroups.get(item.channel) ?? [];
    group.push(item);
    channelGroups.set(item.channel, group);
  }

  // 채널별 병렬 처리
  const channelEntries = Array.from(channelGroups.entries());
  const channelResults = await Promise.allSettled(
    channelEntries.map(([channel, channelItems]) => summarizeChannel(channelItems, channel)),
  );

  // 결과 수집 (원본 순서 유지를 위해 id 기준 매핑)
  const resultById = new Map<string, SummarizeResult>();
  for (const settled of channelResults) {
    if (settled.status === 'fulfilled') {
      settled.value.forEach((result) => resultById.set(result.id, result));
    }
  }

  // 원본 입력 순서에 맞춰 결과 배열 구성
  const results: SummarizeResult[] = items.map((item) => {
    return resultById.get(item.id) ?? applyFallback(item);
  });

  // 통계 계산 및 로깅
  const summarized = results.filter((r) => r.tokensUsed > 0).length;
  const failed = results.filter((r) => r.tokensUsed === 0).length;
  const totalTokensUsed = results.reduce((sum, r) => sum + r.tokensUsed, 0);

  const stats: SummarizeStats = {
    totalItems: items.length,
    summarized,
    cached: 0,
    failed,
    totalTokensUsed,
    durationMs: Date.now() - startTime,
  };

  logUsage(stats);

  return results;
}

/**
 * WORLD 채널 중요도 판단 (Claude가 뉴스 헤드라인 선별)
 * 40~50대 직장인이 "알아야 할" 이슈 최대 2개를 선정
 */
export async function selectWorldItems(
  headlines: { index: number; title: string }[],
): Promise<WorldSelectionResult> {
  if (headlines.length === 0) {
    return { selectedIndices: [], reason: '헤드라인 없음', tokensUsed: 0 };
  }

  // ANTHROPIC_API_KEY 검증
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  }

  const worldSelectionPrompt = `아래 뉴스 헤드라인 목록에서, 오늘 한국의 40~50대 직장인이 "이건 알아야 한다"고 느낄 이슈 최대 2개를 선정하세요.

선정 기준:
- 일시적 가십이 아닌 중요한 구조적 변화
- 현재 대부분의 사람이 알고 있는 화제
- 정치 편향 없이 팩트 중심
- 동일 이슈가 여러 소스에서 반복 등장할수록 가중치 부여

헤드라인 목록:
${JSON.stringify(headlines, null, 2)}

응답 형식:
{"selected": [0, 5], "reason": "선정 이유 한 줄"}`;

  try {
    const response = await callClaudeAPI(worldSelectionPrompt, SYSTEM_PROMPT);

    // JSON 파싱
    const cleaned = response.text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned) as WorldSelectionResponse;

    if (!Array.isArray(parsed.selected)) {
      throw new Error('선정 결과 형식 오류');
    }

    // 최대 2개로 제한, 유효한 인덱스만 유지
    const validIndices = parsed.selected
      .filter((idx) => typeof idx === 'number' && idx >= 0 && idx < headlines.length)
      .slice(0, 2);

    return {
      selectedIndices: validIndices,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      tokensUsed: response.inputTokens + response.outputTokens,
    };
  } catch {
    // 실패 시 상위 2개 인덱스로 폴백
    const fallbackCount = Math.min(2, headlines.length);
    return {
      selectedIndices: Array.from({ length: fallbackCount }, (_, i) => i),
      reason: 'Claude 선정 실패 — 수집 순서 기반 폴백',
      tokensUsed: 0,
    };
  }
}

// ─── 주말 브리핑 확장 요약 (F-16) ───────────────────────────────────────────

/** 주말 브리핑용 확장 요약 결과 */
export interface ExtendedSummaryResult {
  id: string;
  extendedSummary: string;   // 3줄 요약 (개행 구분)
  whyImportant: string;      // "왜 중요한가" 설명
  tokensUsed: number;
}

/**
 * 주말 브리핑용 3줄 요약 + "왜 중요한가" 생성 (F-16 AC2)
 * 기존 1줄 summary_ai보다 깊은 맥락 제공
 * @param item 확장 요약할 아이템 (id, title, fullText, channel)
 */
export async function generateExtendedSummary(
  item: SummarizeInput,
): Promise<ExtendedSummaryResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  }

  const prompt = `아래 콘텐츠에 대해 주말 브리핑용 심층 요약을 작성하세요.

콘텐츠:
제목: ${item.title}
본문: ${item.fullText ? item.fullText.slice(0, FULL_TEXT_MAX_LENGTH) : ''}

응답 형식 (JSON):
{
  "extended_summary": "1줄: ...\\n2줄: ...\\n3줄: ...",
  "why_important": "이 콘텐츠가 중요한 이유 1~2문장 (한국어)"
}

규칙:
- extended_summary: 3줄로 핵심 내용을 단계별 전개
- why_important: 50대 CTO 관점에서 실무/생활에 미치는 영향
- 응답은 순수 JSON만 반환`;

  try {
    const response = await callClaudeAPI(prompt, SYSTEM_PROMPT);

    const cleaned = response.text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned) as {
      extended_summary: string;
      why_important: string;
    };

    return {
      id: item.id,
      extendedSummary: parsed.extended_summary ?? item.title,
      whyImportant: parsed.why_important ?? '',
      tokensUsed: response.inputTokens + response.outputTokens,
    };
  } catch {
    // 실패 시 폴백: title을 3줄 요약으로, 빈 why_important
    return {
      id: item.id,
      extendedSummary: item.title,
      whyImportant: '',
      tokensUsed: 0,
    };
  }
}

/**
 * Weekly Digest용 AI 한줄 코멘트 생성 (F-16 AC3)
 * "이번 주 당신의 관심은 {토픽}에 집중됐어요" 형식
 * @param topTopics 이번 주 좋아요 Top 3 아이템 (채널: 제목 형식)
 */
export async function generateWeeklyComment(topTopics: string[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  }

  if (topTopics.length === 0) {
    return '이번 주도 다양한 주제로 지식을 넓혔네요.';
  }

  const prompt = `이번 주 사용자가 가장 많이 좋아요를 누른 아이템들:
${topTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

위 패턴을 보고, "이번 주 당신의 관심은 {핵심 토픽}에 집중됐어요" 형식으로
자연스러운 한 문장 AI 코멘트를 생성하세요.

규칙:
- 1문장, 30~50자 내외
- 따뜻하고 통찰력 있는 톤
- 응답은 문장만 반환 (JSON 없이)`;

  try {
    const response = await callClaudeAPI(prompt, SYSTEM_PROMPT);
    return response.text.trim();
  } catch {
    return '이번 주도 알찬 브리핑과 함께했네요.';
  }
}

/**
 * 세렌디피티 아이템 선정 (관심사 인접 랜덤) — F-23 구현
 * interestTopics 기반 역가중치 계산 후 확률적 선택
 *
 * @param interestTopics 관심 토픽 목록 (interest_profile의 topic)
 * @param candidates 후보 아이템 목록
 * @returns 선정된 아이템의 인덱스 (candidates 배열 기준)
 */
export async function selectSerendipityItem(
  interestTopics: string[],
  candidates: SummarizeInput[],
): Promise<number> {
  const { calculateInverseWeight, selectSerendipityItem: selectFromLib } = await import(
    '@/lib/serendipity'
  );

  if (candidates.length === 0) {
    throw new Error('후보 아이템이 없습니다');
  }

  // interest_profile Map 구성 (토픽은 점수 1.0으로 가정)
  const profileMap = new Map<string, number>(interestTopics.map((t) => [t, 1.0]));

  // SerendipityCandidate 형태로 변환
  const serendipityCandidates = candidates.map((item, idx) => ({
    id: String(idx),
    title: item.title,
    channel: item.channel,
    tags: [],
    score_initial: 0.5,
    inverseWeight: calculateInverseWeight([], profileMap),
  }));

  const selected = selectFromLib(serendipityCandidates, profileMap);
  if (!selected) {
    // 폴백: 0번 인덱스
    return 0;
  }

  return parseInt(selected.id, 10);
}

/**
 * 월간 인사이트 생성 (F-22)
 * lib/monthly-report.ts의 generateReport에 위임
 */
export async function generateMonthlyInsight(
  monthlyData: Record<string, unknown>,
): Promise<string> {
  const { generateReport } = await import('@/lib/monthly-report');

  // MonthlyReportData 형태로 변환 (타입 안전성 보장)
  const data = {
    month: (monthlyData.month as string | undefined) ?? '',
    topTopics: (monthlyData.topTopics as Array<{ topic: string; readCount: number; score: number }> | undefined) ?? [],
    scoreChanges: (monthlyData.scoreChanges as Array<{ topic: string; oldScore: number; newScore: number; direction: 'up' | 'down' | 'stable' }> | undefined) ?? [],
    completedItems: (monthlyData.completedItems as number | undefined) ?? 0,
    savedItems: (monthlyData.savedItems as number | undefined) ?? 0,
    archivedItems: (monthlyData.archivedItems as number | undefined) ?? 0,
    mylifeosInsights: (monthlyData.mylifeosInsights as string[] | undefined) ?? [],
    followUpQuestions: (monthlyData.followUpQuestions as string[] | undefined) ?? [],
  };

  const result = await generateReport(data);
  return result.content;
}
