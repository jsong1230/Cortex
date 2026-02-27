// F-13 토픽 추출 및 interest_profile 등록 (AC1)
// content_items.tags 필드로부터 토픽을 추출하여 interest_profile에 upsert

import { createServerClient } from '@/lib/supabase/server';

// interest_profile 기본 초기 점수
const DEFAULT_SCORE = 0.5;

// interest_profile 기존 레코드 타입
interface ExistingTopicRow {
  topic: string;
  score: number;
  interaction_count: number;
}

/**
 * content_items.tags 배열에서 유효한 토픽 목록을 추출한다 (AC1)
 * - 빈 문자열/공백 제거
 * - 중복 제거
 */
export function extractTopicsFromTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }

  return result;
}

/**
 * 추출된 토픽 목록을 interest_profile에 등록/업데이트한다 (AC1)
 * - 신규 토픽: score=0.5 기본값으로 등록
 * - 기존 토픽: 기존 score 유지 (EMA 업데이트는 updateInterestScore에서 처리)
 */
export async function registerTopicsToProfile(topics: string[]): Promise<void> {
  if (topics.length === 0) return;

  const supabase = createServerClient();

  // 1. 기존 토픽 조회 (존재 여부 확인)
  const { data: existingRows, error: selectError } = await supabase
    .from('interest_profile')
    .select('topic, score, interaction_count')
    .in('topic', topics);

  if (selectError) {
    throw new Error(`interest_profile 조회 실패: ${selectError.message}`);
  }

  // 기존 토픽 Map 구성
  const existingMap = new Map<string, ExistingTopicRow>(
    (existingRows ?? []).map((row: ExistingTopicRow) => [row.topic, row])
  );

  // 2. 신규 토픽만 필터링하여 기본값으로 등록
  const newTopics = topics.filter((topic) => !existingMap.has(topic));

  if (newTopics.length === 0) return;

  const insertRows = newTopics.map((topic) => ({
    topic,
    score: DEFAULT_SCORE,
    interaction_count: 0,
    last_updated: new Date().toISOString(),
  }));

  // 3. 신규 토픽 upsert (topic UNIQUE 제약, 기존 레코드는 변경 없음)
  const { error: upsertError } = await supabase
    .from('interest_profile')
    .upsert(insertRows, { onConflict: 'topic', ignoreDuplicates: true });

  if (upsertError) {
    throw new Error(`interest_profile 토픽 등록 실패: ${upsertError.message}`);
  }
}
