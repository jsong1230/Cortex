// F-22 AI 월간 리포트 — 데이터 집계 + 리포트 생성 + 저장 + 텔레그램 발송
// AC1: 매월 1일 실행
// AC2: 핵심 관심사, 변화, My Life OS 인사이트, 추천 후속 질문 포함
// AC3: 텔레그램 + 웹 /insights에서 조회 가능
// AC4: Top 5 읽은 주제 포함

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram';
import { CLAUDE_SONNET_MODEL } from '@/lib/constants';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface TopTopic {
  topic: string;
  readCount: number;
  score: number;
}

export interface ScoreChange {
  topic: string;
  oldScore: number;
  newScore: number;
  direction: 'up' | 'down' | 'stable';
}

export interface MonthlyReportData {
  month: string;                 // 'YYYY-MM'
  topTopics: TopTopic[];         // AC4: Top 5
  scoreChanges: ScoreChange[];   // 눈에 띄는 변화
  completedItems: number;        // 완독 아이템 수
  savedItems: number;            // 저장 아이템 수 (전체)
  archivedItems: number;         // 보관 아이템 수
  mylifeosInsights: string[];    // My Life OS 연동 인사이트 (키워드 목록)
  followUpQuestions: string[];   // 추천 후속 질문
}

export interface GeneratedReport {
  content: string;              // 전체 마크다운 리포트
  summary: string;              // 1문단 텔레그램용 요약
  topTopics: TopTopic[];        // Top 5
  tokensUsed: number;
}

export interface SavedReport {
  id: string;
  report_month: string;
  content: string;
  summary: string;
  top_topics: TopTopic[];
  generated_at: string;
  telegram_sent_at: string | null;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const REPORT_SYSTEM_PROMPT = `당신은 Cortex라는 개인 AI 브리핑 서비스의 월간 분석 엔진입니다.
사용자는 50대 초반 CTO로, LLM 인프라/클라우드 비용 최적화/MSA/팀 빌딩/스타트업 전략에 관심이 있습니다.
개인 생활: 등산(주 2-3회), 골프(주 1회), 한국-캐나다 원격 가족 생활.
My Life OS 일기를 통해 개인 키워드를 수집하고, 콘텐츠 소비와 교차 분석합니다.`;

const WEB_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cortex-briefing.vercel.app';

// ─── Anthropic 클라이언트 ─────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── 이전 달 계산 헬퍼 ───────────────────────────────────────────────────────

/**
 * 현재 날짜 기준으로 이전 달의 'YYYY-MM' 문자열을 반환
 * (매월 1일에 실행 시 지난달 분석에 사용)
 */
export function getPreviousMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed, 현재 달

  if (month === 0) {
    // 1월이면 이전 해 12월
    return `${year - 1}-12`;
  }
  const prevMonth = String(month).padStart(2, '0');
  return `${year}-${prevMonth}`;
}

/**
 * 'YYYY-MM' 문자열에서 해당 달의 시작/종료 ISO 문자열 반환
 */
function getMonthRange(month: string): { start: string; end: string } {
  const [year, mm] = month.split('-').map(Number);
  const start = new Date(year, mm - 1, 1);
  const end = new Date(year, mm, 1); // 다음 달 1일 = 이 달 마지막 날 다음
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// ─── gatherMonthlyData ────────────────────────────────────────────────────────

/**
 * 지정 월의 모든 데이터를 집계
 * - user_interactions: 토픽별 읽기 수 집계 → topTopics
 * - interest_profile: 현재 스코어
 * - score_history: 스코어 변화 (시작 vs 종료)
 * - saved_items: 완독/저장/보관 카운트
 * - keyword_contexts: My Life OS 키워드
 */
export async function gatherMonthlyData(
  supabase: SupabaseClient,
  month: string,
): Promise<MonthlyReportData> {
  const { start, end } = getMonthRange(month);

  // ─── 1. user_interactions — 토픽별 읽기 수 집계 ────────────────────────
  let topTopics: TopTopic[] = [];
  try {
    const { data: interactionsData, error: interactionsError } = await supabase
      .from('user_interactions')
      .select('content_id, topic, created_at')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false });

    if (!interactionsError && interactionsData) {
      // 토픽별 카운트 집계
      const topicCounts = new Map<string, number>();
      for (const row of interactionsData as Array<{ topic?: string; content_id: string }>) {
        const topic = row.topic;
        if (topic) {
          topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
        }
      }

      // interest_profile에서 스코어 조회
      const { data: profileData } = await supabase
        .from('interest_profile')
        .select('topic, score')
        .order('score', { ascending: false });

      const profileMap = new Map<string, number>();
      if (profileData) {
        for (const row of profileData as Array<{ topic: string; score: number }>) {
          profileMap.set(row.topic, row.score);
        }
      }

      // topTopics 구성 (readCount 내림차순, 최대 5개) — AC4
      topTopics = Array.from(topicCounts.entries())
        .map(([topic, readCount]) => ({
          topic,
          readCount,
          score: profileMap.get(topic) ?? 0,
        }))
        .sort((a, b) => b.readCount - a.readCount)
        .slice(0, 5);
    }
  } catch {
    // DB 오류 시 빈 배열로 graceful degradation
  }

  // ─── 2. score_history — 스코어 변화 분석 ──────────────────────────────
  let scoreChanges: ScoreChange[] = [];
  try {
    const { data: historyData } = await supabase
      .from('score_history')
      .select('topic, score, recorded_at')
      .gte('recorded_at', start)
      .lt('recorded_at', end)
      .order('recorded_at', { ascending: true });

    if (historyData && (historyData as unknown[]).length > 0) {
      // 토픽별 첫 번째와 마지막 스코어를 비교
      const firstScores = new Map<string, number>();
      const lastScores = new Map<string, number>();

      for (const row of historyData as Array<{ topic: string; score: number }>) {
        if (!firstScores.has(row.topic)) {
          firstScores.set(row.topic, row.score);
        }
        lastScores.set(row.topic, row.score);
      }

      scoreChanges = Array.from(firstScores.entries()).map(([topic, oldScore]) => {
        const newScore = lastScores.get(topic) ?? oldScore;
        const diff = newScore - oldScore;
        const direction: 'up' | 'down' | 'stable' =
          diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'stable';
        return { topic, oldScore, newScore, direction };
      });
    }
  } catch {
    // non-fatal
  }

  // ─── 3. saved_items — 완독/저장/보관 카운트 ───────────────────────────
  let completedItems = 0;
  let savedItems = 0;
  let archivedItems = 0;

  try {
    const { data: savedData, error: savedError } = await supabase
      .from('saved_items')
      .select('status, completed_at, archived_at, saved_at')
      .gte('saved_at', start)
      .lt('saved_at', end)
      .order('saved_at', { ascending: false });

    if (!savedError && savedData) {
      const rows = savedData as Array<{ status: string }>;
      savedItems = rows.length;
      completedItems = rows.filter((r) => r.status === 'completed').length;
      archivedItems = rows.filter((r) => r.status === 'archived').length;
    }
  } catch {
    // graceful degradation
  }

  // ─── 4. keyword_contexts — My Life OS 키워드 추출 ──────────────────────
  let mylifeosInsights: string[] = [];
  try {
    const { data: keywordData } = await supabase
      .from('keyword_contexts')
      .select('keywords, source')
      .gt('expires_at', new Date().toISOString());

    if (keywordData) {
      const allKeywords = new Set<string>();
      for (const row of keywordData as Array<{ keywords: string[] }>) {
        if (Array.isArray(row.keywords)) {
          for (const kw of row.keywords) {
            allKeywords.add(kw);
          }
        }
      }
      mylifeosInsights = Array.from(allKeywords).slice(0, 10);
    }
  } catch {
    // non-fatal
  }

  return {
    month,
    topTopics,
    scoreChanges,
    completedItems,
    savedItems,
    archivedItems,
    mylifeosInsights,
    followUpQuestions: [], // generateReport에서 채움
  };
}

// ─── generateReport ───────────────────────────────────────────────────────────

/**
 * Claude API를 사용하여 월간 리포트 생성
 * - 핵심 관심사 분석 (AC2)
 * - 눈에 띄는 변화 (AC2)
 * - My Life OS 연동 인사이트 (AC2)
 * - 추천 후속 질문 (AC2)
 * - Top 5 읽은 주제 (AC4)
 */
export async function generateReport(data: MonthlyReportData): Promise<GeneratedReport> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
  }

  const anthropic = getAnthropicClient();

  const prompt = `다음 데이터를 바탕으로 ${data.month} 월간 리포트를 작성하세요.

## 집계 데이터

### Top ${data.topTopics.length} 읽은 주제 (AC4)
${data.topTopics.map((t, i) => `${i + 1}. ${t.topic} (${t.readCount}회, 관심도: ${(t.score * 10).toFixed(1)})`).join('\n')}

### 스코어 변화
${data.scoreChanges.map((c) => `- ${c.topic}: ${c.oldScore.toFixed(2)} → ${c.newScore.toFixed(2)} (${c.direction === 'up' ? '↑' : c.direction === 'down' ? '↓' : '→'})`).join('\n') || '변화 데이터 없음'}

### 읽기 통계
- 완독: ${data.completedItems}건
- 전체 저장: ${data.savedItems}건
- 보관 처리: ${data.archivedItems}건

### My Life OS 키워드
${data.mylifeosInsights.join(', ') || '키워드 없음'}

## 작성 지침

다음 섹션을 포함한 마크다운 리포트를 작성하세요:
1. **핵심 관심사** — 이번 달 가장 많이 읽은 주제와 패턴 분석
2. **눈에 띄는 변화** — 관심도 점수 변화와 새로 나타난 관심사
3. **My Life OS 연동 인사이트** — 일기/메모 키워드와 콘텐츠 소비의 교차 분석
4. **추천 후속 질문** — 3~5개의 심화 탐구 질문
5. **Top 5 읽은 주제** — 목록 형식

응답 형식 (JSON):
{
  "content": "전체 마크다운 리포트 내용",
  "summary": "텔레그램용 1문단 요약 (100자 이내)"
}

규칙:
- content는 ## 헤더를 사용하는 마크다운 형식
- summary는 핵심 인사이트 1~2문장
- 응답은 순수 JSON만 반환 (마크다운 코드블록 없이)`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 4096,
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return buildFallbackReport(data, 0);
    }

    // JSON 파싱
    const cleaned = textBlock.text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned) as { content: string; summary: string };

    if (typeof parsed.content !== 'string' || typeof parsed.summary !== 'string') {
      return buildFallbackReport(data, 0);
    }

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    return {
      content: parsed.content,
      summary: parsed.summary,
      topTopics: data.topTopics,
      tokensUsed,
    };
  } catch {
    // API 실패 시 폴백
    return buildFallbackReport(data, 0);
  }
}

/**
 * Claude API 실패 시 폴백 리포트 생성
 */
function buildFallbackReport(data: MonthlyReportData, tokensUsed: number): GeneratedReport {
  const topicsList = data.topTopics
    .map((t, i) => `${i + 1}. **${t.topic}** (${t.readCount}회)`)
    .join('\n');

  const content = `## ${data.month} 월간 리포트

### 핵심 관심사
이번 달 총 ${data.savedItems}건의 콘텐츠를 저장하고 ${data.completedItems}건을 완독하셨습니다.

### Top ${data.topTopics.length} 읽은 주제
${topicsList || '데이터 없음'}

### My Life OS 연동 인사이트
${data.mylifeosInsights.length > 0 ? `연동 키워드: ${data.mylifeosInsights.join(', ')}` : '키워드 연동 데이터 없음'}

### 추천 후속 질문
1. 이번 달 가장 많이 읽은 주제에 대해 더 깊이 탐구해보시겠어요?
2. 완독하지 못한 ${data.savedItems - data.completedItems}건의 아이템을 다시 살펴보시겠어요?`;

  const summary = `${data.month} 리포트: ${data.savedItems}건 저장, ${data.completedItems}건 완독. ` +
    (data.topTopics[0] ? `최고 관심 주제: ${data.topTopics[0].topic}` : '');

  return {
    content,
    summary,
    topTopics: data.topTopics,
    tokensUsed,
  };
}

// ─── saveReport ───────────────────────────────────────────────────────────────

/**
 * 생성된 리포트를 monthly_reports 테이블에 저장
 */
export async function saveReport(
  supabase: SupabaseClient,
  month: string,
  report: GeneratedReport,
): Promise<SavedReport> {
  const record = {
    report_month: month,
    content: report.content,
    summary: report.summary,
    top_topics: report.topTopics,
    generated_at: new Date().toISOString(),
    telegram_sent_at: null,
  };

  const { data, error } = await supabase
    .from('monthly_reports')
    .insert(record)
    .select('id, report_month, content, summary, top_topics, generated_at, telegram_sent_at')
    .single();

  if (error || !data) {
    throw new Error(`월간 리포트 저장 실패: ${error?.message ?? '알 수 없는 오류'}`);
  }

  return data as SavedReport;
}

// ─── sendReportToTelegram ─────────────────────────────────────────────────────

/**
 * 월간 리포트를 텔레그램으로 발송 (AC3)
 * 요약본만 발송 + 웹 링크 포함
 */
export async function sendReportToTelegram(
  report: GeneratedReport | SavedReport,
  month: string,
): Promise<void> {
  const summary = 'summary' in report ? report.summary : '';
  const topTopics = 'topTopics' in report ? report.topTopics : (report as SavedReport).top_topics;

  const topicLines = topTopics
    .slice(0, 5)
    .map((t, i) => `  ${i + 1}. ${t.topic} (${t.readCount}회)`)
    .join('\n');

  const text = `📊 <b>${month} 월간 리포트</b>

${summary}

<b>Top ${topTopics.slice(0, 5).length} 주제</b>
${topicLines}

<a href="${WEB_URL}/insights">전체 리포트 보기 →</a>`;

  await sendMessage({
    text,
    parseMode: 'HTML',
  });
}

/**
 * 월간 리포트 텔레그램 발송 후 telegram_sent_at 업데이트
 */
export async function markReportAsSent(
  supabase: SupabaseClient,
  reportMonth: string,
): Promise<void> {
  await supabase
    .from('monthly_reports')
    .update({ telegram_sent_at: new Date().toISOString() })
    .eq('report_month', reportMonth);
}
