// My Life OS DB 연동 모듈 (읽기 전용, 격리)
// 스키마 변경 영향 최소화를 위해 모든 My Life OS 쿼리는 이 파일에서만 수행

import { createServerClient } from './supabase/server';

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

/**
 * 최근 N일 일기에서 키워드 추출
 * keyword_contexts 저장용 데이터 반환
 */
export async function getRecentDiaryKeywords(
  days = 7
): Promise<DiaryKeywords[]> {
  // TODO: Phase 3 — My Life OS 연동 활성화 여부 확인 후 실행
  if (process.env.MYLIFEOS_INTEGRATION_ENABLED !== 'true') {
    return [];
  }

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

  // TODO: Phase 3 — Claude API로 키워드 추출
  void data;
  return [];
}

/**
 * 미완료 할일에서 키워드 추출
 */
export async function getActiveTodoKeywords(): Promise<TodoKeywords[]> {
  // TODO: Phase 3
  if (process.env.MYLIFEOS_INTEGRATION_ENABLED !== 'true') {
    return [];
  }

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

  void data;
  return [];
}
