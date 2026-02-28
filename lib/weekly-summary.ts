// F-24 주간 AI 요약 모듈
// AC1: 이번 주 기술 트렌드 3줄 요약
// AC2: 세렌디피티 효과 측정 및 보고
// AC3: "이번 주 당신의 관심은 {토픽}에 집중됐어요" AI 한줄 포커스 코멘트

import Anthropic from '@anthropic-ai/sdk';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

/** 세렌디피티 효과 측정 리포트 (AC2) */
export interface SerendipityReport {
  /** 이번 주 브리핑에 포함된 세렌디피티 아이템 총 수 */
  totalSerendipityItems: number;
  /** 세렌디피티 아이템에 대한 긍정 반응 수 (좋아요, 저장) */
  positiveReactions: number;
  /** 세렌디피티를 통해 발견된 새 토픽 목록 */
  discoveredTopics: string[];
  /** 효과 점수 (0~100): positiveReactions / totalSerendipityItems * 100 */
  effectScore: number;
}

/** 주간 AI 요약 데이터 (F-24 전용) */
export interface WeeklySummaryData {
  /** AC1: 이번 주 기술 트렌드 3줄 요약 */
  techTrendsSummary: string;
  /** AC2: 세렌디피티 효과 측정 리포트 */
  serendipityEffect: SerendipityReport;
  /** AC3: AI 포커스 한줄 코멘트 */
  focusComment: string;
}

// ─── Supabase 클라이언트 인터페이스 (의존성 역전) ─────────────────────────────

/** weekly-summary가 사용하는 Supabase 클라이언트 최소 인터페이스 */
export interface WeeklySummarySupabaseClient {
  from: (table: string) => WeeklySummaryQueryBuilder;
}

interface WeeklySummaryQueryBuilder
  extends Promise<{ data: unknown[] | null; error: unknown }> {
  select: (columns: string) => WeeklySummaryQueryBuilder;
  eq: (column: string, value: unknown) => WeeklySummaryQueryBuilder;
  in: (column: string, values: unknown[]) => WeeklySummaryQueryBuilder;
  gte: (column: string, value: unknown) => WeeklySummaryQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => WeeklySummaryQueryBuilder;
  limit: (count: number) => WeeklySummaryQueryBuilder;
}

// ─── Claude API 설정 ──────────────────────────────────────────────────────────

// 토큰 절약을 위해 짧은 프롬프트 사용 (sonnet 모델)
const WEEKLY_SUMMARY_SYSTEM_PROMPT = `당신은 Cortex 개인 AI 브리핑 서비스의 주간 요약 엔진입니다.
사용자는 50대 초반 CTO로, LLM 인프라/클라우드 비용 최적화/MSA/팀 빌딩에 관심이 있습니다.
응답은 항상 한국어로, 간결하고 통찰력 있게 작성하세요.`;

/**
 * Anthropic 클라이언트 lazy 생성
 */
function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Claude API 단순 호출 (F-24 전용 — 짧은 프롬프트 최적화)
 */
async function callClaude(prompt: string): Promise<string> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: WEEKLY_SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude 응답에 텍스트 블록이 없습니다');
  }

  return textBlock.text.trim();
}

// ─── 이번 주 시작일 계산 유틸리티 ──────────────────────────────────────────────

/**
 * KST 기준 이번 주 월요일 00:00의 UTC ISO 문자열 반환
 */
function getWeekStartIso(): string {
  const now = new Date();
  const kstDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const kstDate = new Date(`${kstDateStr}T00:00:00+09:00`);
  const dayOfWeek = kstDate.getDay(); // 0:일, 6:토
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(kstDate.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
  return weekStart.toISOString();
}

// ─── AC1: 기술 트렌드 요약 ────────────────────────────────────────────────────

/** content_items 조회 행 타입 */
interface TechContentRow {
  title: string;
  tags: string[] | null;
  channel: string;
}

/**
 * 이번 주 tech 채널 아이템을 기반으로 기술 트렌드 3줄 요약 생성 (AC1)
 *
 * @param supabase Supabase 클라이언트
 * @returns 3줄 요약 문자열 (줄바꿈 구분). 데이터 없거나 오류 시 빈 문자열
 */
export async function generateTechTrendsSummary(
  supabase: WeeklySummarySupabaseClient,
): Promise<string> {
  const weekStartIso = getWeekStartIso();

  // ─ tech 채널 아이템 조회 ──────────────────────────────────────────────────
  let techItems: TechContentRow[] = [];

  try {
    const result = await supabase
      .from('content_items')
      .select('title, tags, channel')
      .eq('channel', 'tech')
      .gte('collected_at', weekStartIso)
      .order('score_initial', { ascending: false })
      .limit(20);

    techItems = ((result.data ?? []) as TechContentRow[]).filter(
      (row) => row && typeof row.title === 'string',
    );
  } catch {
    return '';
  }

  if (techItems.length === 0) {
    return '';
  }

  // ─ 태그 빈도 집계로 주요 테마 추출 ───────────────────────────────────────
  const tagCount = new Map<string, number>();
  for (const item of techItems) {
    for (const tag of item.tags ?? []) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  const topTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // ─ Claude API 호출 — 3줄 요약 생성 ────────────────────────────────────────
  const titleList = techItems
    .slice(0, 10)
    .map((item, idx) => `${idx + 1}. ${item.title}`)
    .join('\n');

  const prompt = `이번 주 기술 뉴스 제목 목록입니다:
${titleList}

주요 태그: ${topTags.join(', ')}

위 내용을 바탕으로 이번 주 기술 트렌드를 3줄로 요약해주세요.
각 줄은 "1. ", "2. ", "3. "으로 시작하며, 핵심 트렌드를 한 문장씩 담아주세요.
응답은 3줄 요약만 반환하세요 (다른 설명 없이).`;

  try {
    return await callClaude(prompt);
  } catch {
    return '';
  }
}

// ─── AC2: 세렌디피티 효과 측정 ───────────────────────────────────────────────

/** briefings 테이블 행 타입 */
interface BriefingRow {
  id: string;
  briefing_date: string;
  items: Array<{
    content_id: string;
    channel: string;
    title?: string;
    tags?: string[];
  }>;
}

/** user_interactions 조회 행 타입 */
interface InteractionRow {
  content_id: string;
  action: string;
}

/** 긍정 반응으로 인정하는 action 목록 */
const POSITIVE_ACTIONS = new Set(['like', '좋아요', 'save', '저장']);

/**
 * 이번 주 브리핑의 세렌디피티 효과 측정 (AC2)
 *
 * - 이번 주 briefings에서 channel='serendipity' 아이템 추출
 * - user_interactions에서 해당 아이템에 대한 긍정 반응 집계
 * - effectScore = positiveReactions / totalSerendipityItems * 100
 *
 * @param supabase Supabase 클라이언트
 * @returns SerendipityReport (오류 시 기본 리포트)
 */
export async function measureSerendipityEffect(
  supabase: WeeklySummarySupabaseClient,
): Promise<SerendipityReport> {
  const defaultReport: SerendipityReport = {
    totalSerendipityItems: 0,
    positiveReactions: 0,
    discoveredTopics: [],
    effectScore: 0,
  };

  const weekStartIso = getWeekStartIso();

  // ─ 이번 주 briefings 조회 ─────────────────────────────────────────────────
  let briefings: BriefingRow[] = [];

  try {
    const result = await supabase
      .from('briefings')
      .select('id, briefing_date, items')
      .gte('briefing_date', weekStartIso)
      .order('briefing_date', { ascending: false });

    briefings = (result.data ?? []) as BriefingRow[];
  } catch {
    return defaultReport;
  }

  if (briefings.length === 0) {
    return defaultReport;
  }

  // ─ 세렌디피티 아이템 추출 ────────────────────────────────────────────────
  const serendipityItems: Array<{ content_id: string; tags: string[] }> = [];

  for (const briefing of briefings) {
    const items = briefing.items ?? [];
    for (const item of items) {
      if (item.channel === 'serendipity') {
        serendipityItems.push({
          content_id: item.content_id,
          tags: item.tags ?? [],
        });
      }
    }
  }

  if (serendipityItems.length === 0) {
    return defaultReport;
  }

  // ─ 세렌디피티 아이템에 대한 반응 조회 ───────────────────────────────────
  const serendipityIds = serendipityItems.map((i) => i.content_id);
  let interactions: InteractionRow[] = [];

  try {
    const result = await supabase
      .from('user_interactions')
      .select('content_id, action')
      .in('content_id', serendipityIds)
      .gte('created_at', weekStartIso);

    interactions = (result.data ?? []) as InteractionRow[];
  } catch {
    // 반응 조회 실패 시 반응 0으로 계산
    interactions = [];
  }

  // ─ 긍정 반응 집계 ─────────────────────────────────────────────────────────
  const reactionsByItem = new Map<string, number>();
  for (const interaction of interactions) {
    if (POSITIVE_ACTIONS.has(interaction.action)) {
      reactionsByItem.set(
        interaction.content_id,
        (reactionsByItem.get(interaction.content_id) ?? 0) + 1,
      );
    }
  }

  const positiveReactions = Array.from(reactionsByItem.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  // ─ 발견된 토픽 수집 (긍정 반응이 있는 세렌디피티 아이템의 태그) ──────────
  const discoveredTopics: string[] = [];
  for (const item of serendipityItems) {
    if (reactionsByItem.has(item.content_id)) {
      for (const tag of item.tags) {
        if (!discoveredTopics.includes(tag)) {
          discoveredTopics.push(tag);
        }
      }
    }
  }

  // ─ effectScore 계산 ───────────────────────────────────────────────────────
  const totalSerendipityItems = serendipityItems.length;
  const effectScore =
    totalSerendipityItems > 0
      ? Math.round((positiveReactions / totalSerendipityItems) * 100)
      : 0;

  return {
    totalSerendipityItems,
    positiveReactions,
    discoveredTopics,
    effectScore,
  };
}

// ─── AC3: AI 포커스 코멘트 생성 ───────────────────────────────────────────────

/** user_interactions + content_items 조인 행 타입 */
interface InteractionWithTagsRow {
  content_id: string;
  action: string;
  content_items: { tags: string[] } | null;
}

/** 기본 포커스 코멘트 (Claude 호출 실패 또는 데이터 없을 때 사용) */
const DEFAULT_FOCUS_COMMENT = '이번 주도 다양한 주제로 지식을 넓혔네요.';

/**
 * 이번 주 인터랙션 패턴 기반 AI 포커스 코멘트 생성 (AC3)
 * "이번 주 당신의 관심은 {토픽}에 집중됐어요" 형식
 *
 * @param supabase Supabase 클라이언트
 * @returns AI 한줄 코멘트 문자열 (오류 시 기본 코멘트)
 */
export async function generateFocusComment(
  supabase: WeeklySummarySupabaseClient,
): Promise<string> {
  const weekStartIso = getWeekStartIso();

  // ─ 이번 주 인터랙션 조회 (content_items 태그 포함) ───────────────────────
  let interactions: InteractionWithTagsRow[] = [];

  try {
    const result = await supabase
      .from('user_interactions')
      .select('content_id, action, content_items(tags)')
      .gte('created_at', weekStartIso);

    interactions = (result.data ?? []) as InteractionWithTagsRow[];
  } catch {
    return DEFAULT_FOCUS_COMMENT;
  }

  if (interactions.length === 0) {
    return DEFAULT_FOCUS_COMMENT;
  }

  // ─ 태그 빈도 집계 ─────────────────────────────────────────────────────────
  const tagCount = new Map<string, number>();

  for (const row of interactions) {
    const tags = row.content_items?.tags ?? [];
    for (const tag of tags) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  if (tagCount.size === 0) {
    return DEFAULT_FOCUS_COMMENT;
  }

  // 상위 3개 태그 추출
  const topTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => `${tag}(${count}회)`);

  // ─ Claude API 호출 — 포커스 코멘트 생성 ──────────────────────────────────
  const prompt = `이번 주 사용자의 주요 관심 태그:
${topTags.join(', ')}

위 패턴을 보고, "이번 주 당신의 관심은 {핵심 토픽}에 집중됐어요" 형식으로
자연스러운 한 문장 코멘트를 작성하세요.

규칙:
- 1문장, 30~50자 내외
- 따뜻하고 통찰력 있는 톤
- 응답은 문장만 반환 (JSON 없이)`;

  try {
    const comment = await callClaude(prompt);
    return comment;
  } catch {
    return DEFAULT_FOCUS_COMMENT;
  }
}

// ─── 메인 함수: generateWeeklySummary ────────────────────────────────────────

/**
 * F-24 주간 AI 요약 전체 생성 (AC1 + AC2 + AC3)
 * 각 컴포넌트는 독립적으로 실패 처리 (채널별 독립 원칙)
 *
 * @param supabase Supabase 클라이언트
 * @returns WeeklySummaryData
 */
export async function generateWeeklySummary(
  supabase: WeeklySummarySupabaseClient,
): Promise<WeeklySummaryData> {
  // 세 컴포넌트를 병렬 처리 (독립 실패 허용)
  const [techTrendsSummary, serendipityEffect, focusComment] = await Promise.all([
    generateTechTrendsSummary(supabase).catch(() => ''),
    measureSerendipityEffect(supabase).catch(
      (): SerendipityReport => ({
        totalSerendipityItems: 0,
        positiveReactions: 0,
        discoveredTopics: [],
        effectScore: 0,
      }),
    ),
    generateFocusComment(supabase).catch(() => DEFAULT_FOCUS_COMMENT),
  ]);

  return {
    techTrendsSummary,
    serendipityEffect,
    focusComment,
  };
}
