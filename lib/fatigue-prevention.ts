// 피로도 방지 장치 모듈
// F-17 설계서: docs/specs/F-17-fatigue-prevention/design.md
// AC1: 채널별 ON/OFF, AC2: /mute N, AC3: 7일 무반응 자동 감소, AC4: 반복 이슈 축약

import { createServerClient } from '@/lib/supabase/server';
import type { BriefingItem } from '@/lib/telegram';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

/** 채널 ON/OFF 설정 */
export interface ChannelSettings {
  tech: boolean;
  world: boolean;
  culture: boolean;
  canada: boolean;
}

/** 뮤트 상태 */
export interface MuteStatus {
  isMuted: boolean;
  muteUntil: string | null;
}

/** updateChannelSettings 결과 */
export interface UpdateResult {
  success: boolean;
  error?: string;
}

/** "계속 팔로우 중" 마킹이 추가된 브리핑 아이템 */
export type BriefingItemWithFollowing = BriefingItem & {
  is_following: boolean;
};

// ─── 상수 ─────────────────────────────────────────────────────────────────────

/** 채널 기본값 (모두 ON) */
export const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  tech: true,
  world: true,
  culture: true,
  canada: true,
};

/** 아이템 자동 감소 최대값 (4개) */
export const MAX_ITEM_REDUCTION = 4;

/** 무반응 스트릭 감지 기간 (일) */
const NO_REACTION_DAYS = 7;

/** 반복 이슈 감지 최소 연속일 */
const REPEAT_ISSUE_DAYS = 3;

/** user_settings 테이블 싱글톤 행 식별자 */
const SINGLETON_SETTINGS_ID = 'singleton';

// ─── 채널 설정 ────────────────────────────────────────────────────────────────

/**
 * user_settings에서 채널 ON/OFF 설정을 읽어온다.
 * 행이 없거나 DB 오류 시 기본값(모두 ON)을 반환한다.
 */
export async function getChannelSettings(): Promise<ChannelSettings> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('user_settings')
      .select('channel_settings')
      .single();

    if (error || !data) {
      return { ...DEFAULT_CHANNEL_SETTINGS };
    }

    const settings = data.channel_settings as ChannelSettings | null;
    if (!settings) {
      return { ...DEFAULT_CHANNEL_SETTINGS };
    }

    return settings;
  } catch {
    return { ...DEFAULT_CHANNEL_SETTINGS };
  }
}

/**
 * user_settings에 채널 ON/OFF 설정을 저장한다.
 * 싱글톤 행 UPSERT 방식으로 처리한다.
 */
export async function updateChannelSettings(
  settings: ChannelSettings,
): Promise<UpdateResult> {
  try {
    const supabase = createServerClient();
    const error = await supabase
      .from('user_settings')
      .upsert(
        {
          id: SINGLETON_SETTINGS_ID,
          channel_settings: settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (error.error) {
      return { success: false, error: error.error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ─── 뮤트 관리 ────────────────────────────────────────────────────────────────

/**
 * 현재 뮤트 상태를 확인한다.
 * mute_until이 미래 시각이면 뮤트 상태이다.
 */
export async function getMuteStatus(): Promise<MuteStatus> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('user_settings')
      .select('mute_until')
      .single();

    if (error || !data) {
      return { isMuted: false, muteUntil: null };
    }

    const muteUntil = data.mute_until as string | null;
    if (!muteUntil) {
      return { isMuted: false, muteUntil: null };
    }

    const muteUntilDate = new Date(muteUntil);
    const now = new Date();
    const isMuted = muteUntilDate > now;

    return { isMuted, muteUntil };
  } catch {
    return { isMuted: false, muteUntil: null };
  }
}

/**
 * N일간 뮤트를 설정한다.
 * N <= 0이면 뮤트를 해제한다 (mute_until = null).
 * DB 오류 시 에러를 throw한다.
 */
export async function setMute(days: number): Promise<void> {
  const muteUntil =
    days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const supabase = createServerClient();
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      {
        id: SINGLETON_SETTINGS_ID,
        mute_until: muteUntil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

  if (error) {
    throw new Error(`뮤트 설정 실패: ${error.message}`);
  }
}

// ─── 무반응 스트릭 감지 ───────────────────────────────────────────────────────

/**
 * 최근 7일간 사용자 반응이 없으면 true를 반환한다.
 * DB 오류 시 false를 반환한다 (안전 기본값 — 감소 방지).
 */
export async function checkNoReactionStreak(): Promise<boolean> {
  try {
    const supabase = createServerClient();
    const sevenDaysAgo = new Date(
      Date.now() - NO_REACTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabase
      .from('user_interactions')
      .select('id')
      .gte('created_at', sevenDaysAgo);

    if (error) {
      return false;
    }

    const rows = data ?? [];
    return rows.length === 0;
  } catch {
    return false;
  }
}

/**
 * item_reduction을 2씩 증가시킨다. 최대 MAX_ITEM_REDUCTION(4)에서 고정.
 * 새 감소량을 반환한다.
 */
export async function updateItemReduction(): Promise<number> {
  const supabase = createServerClient();

  // 현재 값 조회
  const { data } = await supabase
    .from('user_settings')
    .select('item_reduction')
    .single();

  const current = (data?.item_reduction as number | null) ?? 0;
  const next = Math.min(current + 2, MAX_ITEM_REDUCTION);

  await supabase
    .from('user_settings')
    .upsert(
      {
        id: SINGLETON_SETTINGS_ID,
        item_reduction: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

  return next;
}

// ─── 반복 이슈 감지 ───────────────────────────────────────────────────────────

/**
 * 현재 아이템 목록에서 최근 N일간 연속으로 등장한 이슈를 감지한다.
 *
 * 매칭 전략:
 * 1. tags가 undefined/null → 타이틀 키워드 기반 매칭 (2개 이상 공통 키워드)
 * 2. tags가 빈 배열([]) → 태그 기반 매칭만 (결과: 매칭 불가)
 * 3. tags가 있음 → 태그 중첩 기반 매칭 (1개 이상 공통 태그)
 *
 * 반환값: 반복 이슈로 감지된 아이템 id Set
 */
export function detectRepeatingIssues(
  currentItems: BriefingItem[],
  pastItemsList: BriefingItem[][],
): Set<string> {
  // REPEAT_ISSUE_DAYS일이 되려면 과거 목록이 최소 REPEAT_ISSUE_DAYS-1개 필요
  if (pastItemsList.length < REPEAT_ISSUE_DAYS - 1) {
    return new Set<string>();
  }

  const repeatingIds = new Set<string>();

  for (const currentItem of currentItems) {
    // tags가 undefined/null → 타이틀 키워드 매칭 사용
    // tags가 배열(빈 배열 포함) → 태그 기반 매칭만 사용
    const useTagMatching = Array.isArray(currentItem.tags);
    const useTitleMatching = !useTagMatching; // tags=undefined/null일 때만

    const currentTags = useTagMatching ? new Set(currentItem.tags as string[]) : new Set<string>();
    const currentKeywords = useTitleMatching ? extractKeywords(currentItem.title) : [];

    // 매칭 수단이 없으면 건너뜀
    if (currentTags.size === 0 && currentKeywords.length === 0) {
      continue;
    }

    // 과거 REPEAT_ISSUE_DAYS-1일 각각에서 일치하는 아이템이 있는지 확인
    let consecutiveDays = 0;

    for (const pastItems of pastItemsList.slice(0, REPEAT_ISSUE_DAYS - 1)) {
      const hasMatch = pastItems.some((pastItem) => {
        // 태그 기반 매칭 (tags가 배열이고 비어있지 않을 때)
        if (currentTags.size > 0) {
          const pastTags = new Set(pastItem.tags ?? []);
          const sharedTags = Array.from(currentTags).filter((t) => pastTags.has(t));
          if (sharedTags.length > 0) return true;
        }

        // 타이틀 키워드 매칭 (tags가 undefined/null일 때만)
        if (useTitleMatching && currentKeywords.length > 0) {
          const pastKeywords = new Set(extractKeywords(pastItem.title));
          const sharedKeywords = currentKeywords.filter((k) => pastKeywords.has(k));
          if (sharedKeywords.length >= 2) return true;
        }

        return false;
      });

      if (hasMatch) {
        consecutiveDays++;
      }
    }

    // REPEAT_ISSUE_DAYS일(오늘 포함) 연속이면 반복 이슈
    if (consecutiveDays >= REPEAT_ISSUE_DAYS - 1) {
      repeatingIds.add(currentItem.id);
    }
  }

  return repeatingIds;
}

/**
 * 타이틀에서 유의미한 키워드를 추출한다.
 * 2자 이상의 단어 중 조사/접속사류를 제외한다.
 */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    '및', '의', '이', '가', '을', '를', '은', '는', '에', '에서',
    '으로', '로', '과', '와', '이나', '또는', '하지만', '그리고',
    '하여', '에서의', '에의', '위해', '위한', '대한', '관한',
  ]);

  return title
    .split(/[\s,·\-—]+/)
    .map((w) => w.replace(/[^\uAC00-\uD7A3\u4E00-\u9FFFa-zA-Z0-9]/g, ''))
    .filter((w) => w.length >= 2 && !stopWords.has(w));
}

/**
 * 아이템에 "계속 팔로우 중" 마킹을 추가한다.
 */
export function markAsFollowing(item: BriefingItem): BriefingItemWithFollowing {
  return {
    ...item,
    is_following: true,
  };
}
