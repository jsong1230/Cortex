// My Life OS DB 연동 모듈 (읽기 전용, 격리)
// F-18: My Life OS 컨텍스트 연동
// 스키마 변경 영향 최소화를 위해 모든 My Life OS 쿼리는 이 파일에서만 수행
// AC6: 일기 원문은 저장하지 않고 키워드만 추출 (프라이버시)

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── 인터페이스 ──────────────────────────────────────────────────────────────

/** 키워드 추출 결과 */
export interface KeywordExtractionResult {
  source: 'diary' | 'todo' | 'note';
  sourceId: string;
  keywords: string[];
}

/** keyword_contexts 테이블 레코드 */
export interface KeywordContext {
  id?: string;
  source: string;
  source_id: string;
  keywords: string[];
  expires_at: string;
}

/** 동기화 결과 */
export interface SyncResult {
  synced: number;
  expired: number;
}

// 하위 호환 인터페이스 (기존 코드 지원)
export interface DiaryKeywords {
  sourceId: string;
  keywords: string[];
  date: string;
}

export interface TodoKeywords {
  sourceId: string;
  keywords: string[];
  title: string;
}

// ─── 키워드 TTL 설정 ──────────────────────────────────────────────────────────

const KEYWORD_TTL_DAYS = 7;

// ─── Claude API 키워드 추출 ───────────────────────────────────────────────────

const DIARY_KEYWORD_SYSTEM_PROMPT = `당신은 일기 텍스트에서 핵심 키워드를 추출하는 AI입니다.
개인 정보 보호를 위해 원문을 그대로 반환하지 않고, 토픽/주제 키워드만 추출합니다.
키워드는 영어 소문자로 통일하고, 공백 대신 하이픈을 사용합니다.`;

/**
 * Claude API를 사용해 일기 텍스트에서 키워드 추출 (AC6: 원문 미저장)
 * ANTHROPIC_API_KEY 미설정 시 graceful degradation (빈 배열 반환)
 */
async function extractKeywordsFromText(text: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return [];
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 256,
      system: DIARY_KEYWORD_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `다음 텍스트에서 핵심 토픽 키워드를 최대 5개 추출하세요.
텍스트: "${text.slice(0, 500)}"

응답 형식 (JSON):
{"keywords": ["keyword1", "keyword2", "keyword3"]}

규칙:
- 키워드는 영어 소문자
- 공백 대신 하이픈 (예: "cloud-cost", "team-building")
- 순수 JSON만 반환`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return [];
    }

    const cleaned = textBlock.text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned) as { keywords: string[] };
    if (!Array.isArray(parsed.keywords)) {
      return [];
    }

    return parsed.keywords.filter((k) => typeof k === 'string').slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * 제목 텍스트에서 단순 토큰화로 키워드 추출 (AI 불필요 — todo/note용)
 * 한국어 조사, 영어 불용어 제거 후 의미 있는 단어만 추출
 */
function extractKeywordsFromTitle(title: string): string[] {
  // 특수문자 제거, 공백으로 분할
  const tokens = title
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  // 영어 단어는 소문자로 변환, 한국어는 그대로
  const normalized = tokens.map((t) => (/^[a-zA-Z]/.test(t) ? t.toLowerCase() : t));

  // 중복 제거 후 최대 5개
  return Array.from(new Set(normalized)).slice(0, 5);
}

// ─── 키워드 추출 함수 ─────────────────────────────────────────────────────────

/**
 * 최근 7일 diary_entries에서 키워드 추출 (AC1)
 * Claude API 사용, 원문 미저장 (AC6)
 *
 * @param supabase Supabase 클라이언트 (DI 방식 — 테스트 가능성)
 */
export async function extractDiaryKeywords(
  supabase: SupabaseClient,
): Promise<KeywordExtractionResult[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from('diary_entries')
    .select('id, content, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`diary_entries 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // ANTHROPIC_API_KEY 없으면 graceful degradation
  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  // 각 일기에서 키워드 추출 (원문 미저장 — AC6)
  const results: KeywordExtractionResult[] = [];
  for (const entry of data) {
    const keywords = await extractKeywordsFromText(entry.content as string);
    if (keywords.length > 0) {
      results.push({
        source: 'diary',
        sourceId: entry.id as string,
        keywords,
      });
    }
  }

  return results;
}

/**
 * 미완료 todos에서 제목 키워드 추출 (AC2)
 * 단순 토큰화 사용 (AI 불필요)
 *
 * @param supabase Supabase 클라이언트 (DI 방식)
 */
export async function extractTodoKeywords(
  supabase: SupabaseClient,
): Promise<KeywordExtractionResult[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('id, title')
    .eq('completed', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`todos 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data
    .map((todo) => ({
      source: 'todo' as const,
      sourceId: todo.id as string,
      keywords: extractKeywordsFromTitle(todo.title as string),
    }))
    .filter((r) => r.keywords.length > 0);
}

/**
 * 최근 7일 notes에서 제목 키워드 추출 (AC2)
 * 단순 토큰화 사용 (AI 불필요)
 *
 * @param supabase Supabase 클라이언트 (DI 방식)
 */
export async function extractNoteKeywords(
  supabase: SupabaseClient,
): Promise<KeywordExtractionResult[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from('notes')
    .select('id, title, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`notes 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data
    .map((note) => ({
      source: 'note' as const,
      sourceId: note.id as string,
      keywords: extractKeywordsFromTitle(note.title as string),
    }))
    .filter((r) => r.keywords.length > 0);
}

// ─── 동기화 메인 함수 ─────────────────────────────────────────────────────────

/**
 * 키워드 컨텍스트 전체 동기화 메인 함수 (AC3)
 * diary + todo + note 키워드를 추출해 keyword_contexts 테이블에 저장
 * expires_at = 현재 + 7일 (TTL)
 *
 * @param supabase Supabase 클라이언트
 * @returns { synced: number, expired: number }
 */
export async function syncKeywordContexts(supabase: SupabaseClient): Promise<SyncResult> {
  // 1. 각 소스에서 키워드 추출 (병렬 처리 — 실패해도 다른 소스는 계속)
  const [diaryResults, todoResults, noteResults] = await Promise.allSettled([
    extractDiaryKeywords(supabase),
    extractTodoKeywords(supabase),
    extractNoteKeywords(supabase),
  ]);

  const allResults: KeywordExtractionResult[] = [
    ...(diaryResults.status === 'fulfilled' ? diaryResults.value : []),
    ...(todoResults.status === 'fulfilled' ? todoResults.value : []),
    ...(noteResults.status === 'fulfilled' ? noteResults.value : []),
  ];

  let synced = 0;

  // 2. keyword_contexts upsert (7일 TTL)
  if (allResults.length > 0) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + KEYWORD_TTL_DAYS);

    const upsertData: KeywordContext[] = allResults.map((result) => ({
      source: result.source,
      source_id: result.sourceId,
      keywords: result.keywords,
      expires_at: expiresAt.toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from('keyword_contexts')
      .upsert(upsertData, { onConflict: 'source,source_id' });

    if (!upsertError) {
      synced = upsertData.length;
    }
  }

  // 3. 만료된 컨텍스트 정리
  let expired = 0;
  try {
    const { error: deleteError } = await supabase
      .from('keyword_contexts')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (!deleteError) {
      expired = 0; // Supabase 삭제 결과에서 count 확인 어려움 → 0으로 처리
    }
  } catch {
    // 정리 실패는 non-fatal
  }

  return { synced, expired };
}

// ─── 컨텍스트 매칭 ───────────────────────────────────────────────────────────

/**
 * 콘텐츠 태그와 활성 키워드 컨텍스트를 매칭
 * 매칭되면 이유 문자열 반환, 없으면 null (AC4)
 *
 * 형식: "지난주 메모: {키워드} 관련 아티클 포함"
 *
 * @param contentTags 콘텐츠의 토픽 태그 배열
 * @param keywordContexts 활성 keyword_contexts 목록
 * @returns 매칭 이유 문자열 또는 null
 */
export function matchContentToKeywords(
  contentTags: string[],
  keywordContexts: KeywordContext[],
): string | null {
  if (contentTags.length === 0 || keywordContexts.length === 0) {
    return null;
  }

  // 대소문자 무시 비교를 위해 소문자 변환
  const lowerTags = contentTags.map((t) => t.toLowerCase());

  const matchedKeywords: string[] = [];

  for (const ctx of keywordContexts) {
    for (const keyword of ctx.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerTags.some((tag) => tag === lowerKeyword || tag.includes(lowerKeyword) || lowerKeyword.includes(tag))) {
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }
  }

  if (matchedKeywords.length === 0) {
    return null;
  }

  // AC4: "지난주 메모: {키워드} 관련 아티클 포함" 형식
  const keywordStr = matchedKeywords.slice(0, 3).join(', ');
  return `지난주 메모: ${keywordStr} 관련 아티클 포함`;
}

/**
 * 콘텐츠 태그와 키워드 컨텍스트의 매칭 점수 계산
 * 매칭된 키워드 수 / 전체 태그 수 (0.0~1.0)
 *
 * @param contentTags 콘텐츠의 토픽 태그 배열
 * @param keywordContexts 활성 keyword_contexts 목록
 * @returns 컨텍스트 점수 (0.0~1.0)
 */
export function calculateContextScore(
  contentTags: string[],
  keywordContexts: KeywordContext[],
): number {
  if (contentTags.length === 0 || keywordContexts.length === 0) {
    return 0;
  }

  const lowerTags = contentTags.map((t) => t.toLowerCase());

  // 모든 활성 키워드를 하나의 Set으로 합산
  const allKeywords = new Set<string>();
  for (const ctx of keywordContexts) {
    for (const kw of ctx.keywords) {
      allKeywords.add(kw.toLowerCase());
    }
  }

  // 매칭된 태그 수 계산
  const allKeywordsArray = Array.from(allKeywords);
  let matchCount = 0;
  for (const tag of lowerTags) {
    for (const kw of allKeywordsArray) {
      if (tag === kw || tag.includes(kw) || kw.includes(tag)) {
        matchCount++;
        break;
      }
    }
  }

  // 점수 = 매칭된 태그 수 / 전체 태그 수
  const score = matchCount / contentTags.length;
  return Math.min(1.0, Math.max(0.0, score));
}

// ─── 활성 키워드 조회 ─────────────────────────────────────────────────────────

/**
 * 만료되지 않은 모든 keyword_contexts 조회 (AC3)
 * DB 오류 시 빈 배열 반환 (graceful degradation)
 *
 * @param supabase Supabase 클라이언트
 */
export async function getActiveKeywords(supabase: SupabaseClient): Promise<KeywordContext[]> {
  try {
    const { data, error } = await supabase
      .from('keyword_contexts')
      .select('id, source, source_id, keywords, expires_at')
      .gt('expires_at', new Date().toISOString());

    if (error || !data) {
      return [];
    }

    return data as KeywordContext[];
  } catch {
    return [];
  }
}

// ─── 하위 호환 함수 (기존 코드 지원) ─────────────────────────────────────────

/**
 * 최근 N일 일기에서 키워드 추출 (하위 호환 래퍼)
 * @deprecated extractDiaryKeywords(supabase) 사용 권장
 */
export async function getRecentDiaryKeywords(days = 7): Promise<DiaryKeywords[]> {
  if (process.env.MYLIFEOS_INTEGRATION_ENABLED !== 'true') {
    return [];
  }

  const { createServerClient } = await import('./supabase/server');
  const supabase = createServerClient();

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('diary_entries')
    .select('id, content, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`diary_entries 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  const results: DiaryKeywords[] = [];
  for (const entry of data) {
    const keywords = await extractKeywordsFromText(entry.content as string);
    if (keywords.length > 0) {
      results.push({
        sourceId: entry.id as string,
        keywords,
        date: (entry.created_at as string).slice(0, 10),
      });
    }
  }

  return results;
}

/**
 * 미완료 할일에서 키워드 추출 (하위 호환 래퍼)
 * @deprecated extractTodoKeywords(supabase) 사용 권장
 */
export async function getActiveTodoKeywords(): Promise<TodoKeywords[]> {
  if (process.env.MYLIFEOS_INTEGRATION_ENABLED !== 'true') {
    return [];
  }

  const { createServerClient } = await import('./supabase/server');
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('todos')
    .select('id, title')
    .eq('completed', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`todos 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((todo) => ({
    sourceId: todo.id as string,
    keywords: extractKeywordsFromTitle(todo.title as string),
    title: todo.title as string,
  }));
}
