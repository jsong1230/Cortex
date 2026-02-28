// [Cron 21:30 UTC / 06:30 KST] 콘텐츠 수집 파이프라인
// Vercel Cron Job 트리거 → 모든 채널 수집기 병렬 실행 → Claude API 요약/스코어링

import { NextRequest, NextResponse } from 'next/server';
import { summarizeAndScore, selectWorldItems, type SummarizeInput } from '@/lib/summarizer';
import { createServerClient } from '@/lib/supabase/server';
import type { CollectedItem } from '@/lib/collectors/types';
import { TechCollector } from '@/lib/collectors/tech-collector';
import { WorldCollector } from '@/lib/collectors/world-collector';
import { CultureCollector } from '@/lib/collectors/culture-collector';
import { TorontoCollector } from '@/lib/collectors/toronto-collector';

/** content_items 테이블에 upsert할 레코드 타입 */
interface ContentItemRecord {
  channel: string;
  source: string;
  source_url: string;
  title: string;
  full_text?: string;
  published_at?: string;
  tags?: string[];
}

/** DB에서 조회된 미요약 아이템 */
interface DbContentItem {
  id: string;
  title: string;
  full_text: string | null;
  channel: string;
  source: string;
  published_at: string | null;
}

/** 요약 결과 업데이트 레코드 */
interface SummaryUpdateRecord {
  id: string;
  summaryAi: string;
  tags: string[];
  scoreInitial: number;
}

interface CollectResult {
  collected: Record<string, number>;
  summarized: number;
  cached: number;
  duplicatesSkipped: number;
  errors: string[];
}

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * 수집된 아이템을 content_items 테이블에 upsert (source_url 기준 중복 방지)
 * @returns upsert된 아이템 수
 */
async function insertContentItems(items: CollectedItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const supabase = createServerClient();

  const records: ContentItemRecord[] = items.map((item) => ({
    channel: item.channel,
    source: item.source,
    source_url: item.source_url,
    title: item.title,
    full_text: item.full_text,
    published_at: item.published_at?.toISOString(),
    tags: item.tags,
  }));

  const { error } = await supabase
    .from('content_items')
    .upsert(records, { onConflict: 'source_url', ignoreDuplicates: true });

  if (error) {
    throw new Error(`content_items upsert 실패: ${error.message}`);
  }

  return records.length;
}

/**
 * summary_ai IS NULL인 최근 24시간 수집 아이템 조회 (캐싱 — AC6)
 * 이미 요약된 아이템은 제외하여 Claude API 중복 호출 방지
 */
async function getUnsummarizedItems(): Promise<{ items: SummarizeInput[]; cachedCount: number }> {
  const supabase = createServerClient();

  // 24시간 전 시각 계산
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('content_items')
    .select('id, title, full_text, channel, source, published_at')
    .is('summary_ai', null)
    .gte('collected_at', since)
    .order('channel')
    .order('collected_at', { ascending: false });

  if (error) {
    throw new Error(`미요약 아이템 조회 실패: ${error.message}`);
  }

  const items: SummarizeInput[] = (data as DbContentItem[]).map((row) => ({
    id: row.id,
    title: row.title,
    fullText: row.full_text ?? undefined,
    source: row.source,
    channel: row.channel as SummarizeInput['channel'],
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
  }));

  return { items, cachedCount: 0 };
}

/**
 * 요약 결과를 content_items 테이블에 업데이트
 */
async function updateSummaries(updates: SummaryUpdateRecord[]): Promise<void> {
  if (updates.length === 0) return;

  const supabase = createServerClient();

  // 아이템별 개별 UPDATE (design.md 섹션 9.3 — 에러 격리 우선)
  await Promise.allSettled(
    updates.map((update) =>
      supabase
        .from('content_items')
        .update({
          summary_ai: update.summaryAi,
          tags: update.tags,
          score_initial: update.scoreInitial,
        })
        .eq('id', update.id),
    ),
  );
}

/**
 * CollectedItem을 SummarizeInput으로 변환
 */
function toSummarizeInput(item: CollectedItem & { id: string }): SummarizeInput {
  return {
    id: item.id,
    title: item.title,
    fullText: item.full_text,
    source: item.source,
    channel: item.channel,
    publishedAt: item.published_at,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const result: CollectResult = {
    collected: { tech: 0, world: 0, culture: 0, canada: 0 },
    summarized: 0,
    cached: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  // 1. 채널별 수집기 병렬 실행 (채널별 독립 에러 격리)
  // 수집기 생성과 실행을 각 Promise 내에서 처리 (생성 실패 시 해당 채널만 rejected)
  const [techResult, worldResult, cultureResult, canadaResult] = await Promise.allSettled([
    (async () => new TechCollector().collect())(),
    (async () => new WorldCollector().collect())(),
    (async () => new CultureCollector().collect())(),
    (async () => new TorontoCollector().collect())(),
  ]);

  const allCollectedItems: CollectedItem[] = [];

  // 수집 결과 합산
  for (const [channelResult, channelName] of [
    [techResult, 'tech'],
    [worldResult, 'world'],
    [cultureResult, 'culture'],
    [canadaResult, 'canada'],
  ] as const) {
    if (channelResult.status === 'fulfilled') {
      allCollectedItems.push(...channelResult.value.items);
      result.collected[channelName] = channelResult.value.items.length;
      for (const err of channelResult.value.errors) {
        result.errors.push(`${channelName.toUpperCase()}_COLLECT: ${err.message}`);
      }
    } else {
      const msg = channelResult.reason instanceof Error
        ? channelResult.reason.message
        : '알 수 없는 오류';
      result.errors.push(`${channelName.toUpperCase()}_COLLECT_FAILED: ${msg}`);
    }
  }

  // 2. 수집된 아이템을 content_items에 upsert (source_url 기준 중복 방지)
  if (allCollectedItems.length > 0) {
    try {
      await insertContentItems(allCollectedItems);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'DB INSERT 실패';
      result.errors.push(`DB_INSERT_FAILED: ${errorMessage}`);
    }
  }

  // 3. WORLD 채널 아이템 선정 (Claude API)
  const worldItems = allCollectedItems.filter((item) => item.channel === 'world');
  let selectedWorldUrls: Set<string> = new Set();

  if (worldItems.length > 0) {
    try {
      const worldSelection = await selectWorldItems(
        worldItems.map((item, idx) => ({ index: idx, title: item.title })),
      );
      // 선정된 아이템의 source_url을 기록
      selectedWorldUrls = new Set(
        worldSelection.selectedIndices.map((idx) => worldItems[idx]?.source_url).filter(Boolean),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'WORLD 선정 실패';
      result.errors.push(`WORLD_SELECTION_FAILED: ${errorMessage}`);
      // 선정 실패 시 상위 2개를 기본 선택
      selectedWorldUrls = new Set(worldItems.slice(0, 2).map((item) => item.source_url));
    }
  }

  // 4. summary_ai IS NULL인 아이템 조회 (캐싱 — AC6: 이미 요약된 아이템 제외)
  let unsummarizedItems: SummarizeInput[] = [];
  let cachedCount = 0;

  try {
    // Supabase가 모킹된 경우(테스트) 또는 환경변수가 없는 경우 폴백 처리
    const queryResult = await getUnsummarizedItems();
    unsummarizedItems = queryResult.items;
    cachedCount = queryResult.cachedCount;
  } catch {
    // DB 연결 실패 시 수집된 아이템을 직접 사용 (폴백)
    const nonWorldItems = allCollectedItems.filter((item) => item.channel !== 'world');
    const selectedWorld = worldItems.filter((item) => selectedWorldUrls.has(item.source_url));

    // 폴백: id 없으므로 source_url을 임시 id로 사용
    unsummarizedItems = [...nonWorldItems, ...selectedWorld].map((item) =>
      toSummarizeInput({ ...item, id: item.source_url }),
    );
    cachedCount = 0;
  }

  // WORLD 아이템 필터링: 선정된 것만 요약 대상으로 유지
  if (selectedWorldUrls.size > 0) {
    unsummarizedItems = unsummarizedItems.filter(
      (item) => item.channel !== 'world' || selectedWorldUrls.has(item.id),
    );
  }

  result.cached = cachedCount;

  // 5. Claude API 배치 요약 + 스코어링 (F-05 핵심)
  if (unsummarizedItems.length > 0) {
    try {
      const summaryResults = await summarizeAndScore(unsummarizedItems);

      // 6. 요약 결과를 content_items에 UPDATE
      const updates: SummaryUpdateRecord[] = summaryResults.map((r) => ({
        id: r.id,
        summaryAi: r.summaryAi,
        tags: r.tags,
        scoreInitial: r.scoreInitial,
      }));

      try {
        await updateSummaries(updates);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'DB UPDATE 실패';
        result.errors.push(`DB_UPDATE_FAILED: ${errorMessage}`);
      }

      const successCount = summaryResults.filter((r) => r.tokensUsed > 0).length;
      const failCount = summaryResults.filter((r) => r.tokensUsed === 0).length;
      result.summarized = successCount;

      if (failCount > 0) {
        result.errors.push(`SUMMARIZE_PARTIAL_FAIL: ${failCount}개 폴백 처리됨`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Claude API 실패';
      result.errors.push(`CLAUDE_API_FAILED: ${errorMessage}`);
    }
  }

  return NextResponse.json({ success: true, data: result });
}
