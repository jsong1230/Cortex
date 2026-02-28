// F-19 읽기 루프 — 저장 아이템 상태 관리 모듈
// AC1: 상태 관리 (saved/reading/completed/archived)
// AC2: 원문 링크 클릭 시 "읽는 중" 자동 전환
// AC3: 수동 완독 처리
// AC4: 30일 경과 자동 보관
// AC5: Weekly Digest 미완독 리마인더
// AC6: 25일 경과 "곧 보관 처리" 알림
// AC7: 월간 미완독 요약

import { createServerClient } from '@/lib/supabase/server';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export type ReadingStatus = 'saved' | 'reading' | 'completed' | 'archived';

/** saved_items 테이블 레코드 */
export interface SavedItem {
  id: string;
  content_id: string;
  status: ReadingStatus;
  saved_at: string;
  reading_started_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
}

/** getUnreadItems / getItemsNearingArchive 응답 아이템 (content_items 조인) */
export interface SavedItemWithContent extends SavedItem {
  title: string;
  source_url: string;
}

/** getMonthlyUnreadSummary 응답 */
export interface MonthlyUnreadSummary {
  total: number;
  saved: number;
  reading: number;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

/** 자동 보관 기준 일수 (AC4) */
const ARCHIVE_THRESHOLD_DAYS = 30;

/** "곧 보관" 알림 기준 일수 (AC6) */
const NEAR_ARCHIVE_DAYS = 25;

// ─── saveItem ─────────────────────────────────────────────────────────────────

/**
 * 콘텐츠를 saved_items에 저장 (status='saved')
 * 이미 존재하면 UPSERT로 멱등 처리 (기존 상태 유지)
 */
export async function saveItem(contentId: string): Promise<SavedItem> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('saved_items')
    .upsert(
      {
        content_id: contentId,
        status: 'saved',
        saved_at: new Date().toISOString(),
      },
      {
        onConflict: 'content_id',
        ignoreDuplicates: true, // 기존 status 보존
      }
    )
    .select('id, content_id, status, saved_at, reading_started_at, completed_at, archived_at')
    .single();

  if (error) {
    // 중복으로 인해 upsert가 null을 반환하는 경우 기존 레코드 조회
    const { data: existing, error: selectError } = await supabase
      .from('saved_items')
      .select('id, content_id, status, saved_at, reading_started_at, completed_at, archived_at')
      .eq('content_id', contentId)
      .single();

    if (selectError || !existing) {
      throw new Error(`saveItem 실패: ${error.message}`);
    }

    return existing as SavedItem;
  }

  // ignoreDuplicates로 data가 null인 경우 기존 레코드 조회
  if (!data) {
    const { data: existing } = await supabase
      .from('saved_items')
      .select('id, content_id, status, saved_at, reading_started_at, completed_at, archived_at')
      .eq('content_id', contentId)
      .single();

    return (existing ?? { content_id: contentId, status: 'saved' }) as SavedItem;
  }

  return data as SavedItem;
}

// ─── markAsReading ───────────────────────────────────────────────────────────

/**
 * 아이템을 "읽는 중" 상태로 전환 (AC2)
 * 원문 링크 클릭 시 자동 호출 (interactions route에서 fire-and-forget)
 * 이미 completed/archived 상태인 경우 상태 변경하지 않음
 */
export async function markAsReading(contentId: string): Promise<SavedItem | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('saved_items')
    .update({
      status: 'reading',
      reading_started_at: new Date().toISOString(),
    })
    .eq('content_id', contentId)
    .select('id, content_id, status, saved_at, reading_started_at, completed_at, archived_at')
    .single();

  if (error || !data) {
    return null;
  }

  return data as SavedItem;
}

// ─── markAsCompleted ─────────────────────────────────────────────────────────

/**
 * 아이템을 "완독" 상태로 전환 (AC3)
 * 사용자가 수동으로 완독 체크 시 호출
 */
export async function markAsCompleted(contentId: string): Promise<SavedItem> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('saved_items')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('content_id', contentId)
    .select('id, content_id, status, saved_at, reading_started_at, completed_at, archived_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'markAsCompleted: 레코드를 찾을 수 없습니다');
  }

  return data as SavedItem;
}

// ─── getSavedItemByContentId ─────────────────────────────────────────────────

/**
 * content_id로 saved_items 레코드 조회
 * 존재하지 않으면 null 반환
 */
export async function getSavedItemByContentId(contentId: string): Promise<SavedItem | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('saved_items')
    .select('id, content_id, status, saved_at, reading_started_at, completed_at, archived_at')
    .eq('content_id', contentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as SavedItem;
}

// ─── archiveExpiredItems ──────────────────────────────────────────────────────

/**
 * 30일 경과 미완독 아이템을 "보관" 상태로 일괄 전환 (AC4)
 * Cron 작업에서 매일 호출
 * @returns 보관 처리된 아이템 수
 */
export async function archiveExpiredItems(): Promise<number> {
  const supabase = createServerClient();

  // 30일 전 기준 날짜 계산
  const thresholdDate = new Date(
    Date.now() - ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('saved_items')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .lt('saved_at', thresholdDate)
    .not('status', 'in', '("completed","archived")')
    .select('id');

  if (error) {
    throw new Error(`archiveExpiredItems 실패: ${error.message}`);
  }

  return (data ?? []).length;
}

// ─── getItemsNearingArchive ───────────────────────────────────────────────────

/**
 * 25~30일 사이의 미완독 아이템 조회 (AC6 "곧 보관 처리" 알림용)
 * @returns title, source_url이 포함된 아이템 목록
 */
export async function getItemsNearingArchive(): Promise<SavedItemWithContent[]> {
  const supabase = createServerClient();

  const now = Date.now();
  // 25일 전 (이 날짜 이전에 저장된 것)
  const nearArchiveDate = new Date(
    now - NEAR_ARCHIVE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  // 30일 전 (이 날짜 이후에 저장된 것 → 아직 30일 미만)
  const archiveDate = new Date(
    now - ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('saved_items')
    .select('id, content_id, status, saved_at, reading_started_at, completed_at, archived_at, content_items(title, source_url)')
    .gte('saved_at', archiveDate)      // 30일 이내 (아직 archived 미만)
    .lt('saved_at', nearArchiveDate)   // 25일 이전 (25일 경과)
    .not('status', 'in', '("completed","archived")')
    .order('saved_at', { ascending: true });

  if (error) {
    throw new Error(`getItemsNearingArchive 실패: ${error.message}`);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const ci = row.content_items as { title: string; source_url: string } | null;
    return {
      id: row.id as string,
      content_id: row.content_id as string,
      status: row.status as ReadingStatus,
      saved_at: row.saved_at as string,
      reading_started_at: (row.reading_started_at as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
      archived_at: (row.archived_at as string | null) ?? null,
      title: ci?.title ?? '',
      source_url: ci?.source_url ?? '',
    };
  });
}

// ─── getUnreadItems ───────────────────────────────────────────────────────────

/**
 * 미완독 아이템 목록 조회 (status = 'saved' | 'reading') — AC5 Weekly Digest용
 * @returns title, source_url이 포함된 아이템 목록 (최신 저장순)
 */
export async function getUnreadItems(): Promise<SavedItemWithContent[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('saved_items')
    .select('id, content_id, status, saved_at, reading_started_at, completed_at, archived_at, content_items(title, source_url)')
    .in('status', ['saved', 'reading'])
    .order('saved_at', { ascending: false });

  if (error) {
    throw new Error(`getUnreadItems 실패: ${error.message}`);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const ci = row.content_items as { title: string; source_url: string } | null;
    return {
      id: row.id as string,
      content_id: row.content_id as string,
      status: row.status as ReadingStatus,
      saved_at: row.saved_at as string,
      reading_started_at: (row.reading_started_at as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
      archived_at: (row.archived_at as string | null) ?? null,
      title: ci?.title ?? '',
      source_url: ci?.source_url ?? '',
    };
  });
}

// ─── getMonthlyUnreadSummary ──────────────────────────────────────────────────

/**
 * 월간 미완독 요약 조회 (AC7 월간 리포트용)
 * @returns 상태별 카운트 (total, saved, reading)
 */
export async function getMonthlyUnreadSummary(): Promise<MonthlyUnreadSummary> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('saved_items')
    .select('status')
    .in('status', ['saved', 'reading']);

  if (error) {
    throw new Error(`getMonthlyUnreadSummary 실패: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ status: string }>;
  const savedCount = rows.filter((r) => r.status === 'saved').length;
  const readingCount = rows.filter((r) => r.status === 'reading').length;

  return {
    total: rows.length,
    saved: savedCount,
    reading: readingCount,
  };
}
