// 텔레그램 사용자 관리 (등록, 조회)
// telegram_users 테이블: telegram_id ↔ Supabase UUID 매핑
// 멀티유저 지원 (014_multi_user.sql)

import { createServerClient } from '@/lib/supabase/server';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface TelegramUserRecord {
  id: string;               // UUID (다른 테이블의 user_id FK)
  telegram_id: number;      // 텔레그램 발급 ID
  chat_id: number;          // DM 발송용 chat_id
  first_name: string | null;
  username: string | null;
  is_active: boolean;
}

// ─── 조회 ────────────────────────────────────────────────────────────────────

/**
 * telegram_id로 등록된 사용자를 조회한다.
 * 없거나 비활성이면 null 반환.
 */
export async function getUserByTelegramId(
  telegramId: number,
): Promise<TelegramUserRecord | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('telegram_users')
    .select('id, telegram_id, chat_id, first_name, username, is_active')
    .eq('telegram_id', telegramId)
    .single();

  if (error || !data) return null;
  return data as TelegramUserRecord;
}

/**
 * 브리핑 발송 대상 활성 사용자 전체 목록을 반환한다.
 * 등록된 사용자가 없으면 빈 배열.
 */
export async function getActiveUsers(): Promise<TelegramUserRecord[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('telegram_users')
    .select('id, telegram_id, chat_id, first_name, username, is_active')
    .eq('is_active', true)
    .order('created_at');

  if (error || !data) return [];
  return data as TelegramUserRecord[];
}

// ─── 등록/갱신 ───────────────────────────────────────────────────────────────

/**
 * /start 명령어: 신규 사용자 등록 또는 기존 사용자 정보 갱신.
 * telegram_id UNIQUE 충돌 시 chat_id/first_name/username을 업데이트한다.
 */
export async function upsertTelegramUser(params: {
  telegramId: number;
  chatId: number;
  firstName?: string;
  username?: string;
}): Promise<TelegramUserRecord> {
  const supabase = createServerClient();
  const upsertData = {
    telegram_id: params.telegramId,
    chat_id: params.chatId,
    first_name: params.firstName ?? null,
    username: params.username ?? null,
    is_active: true,
  };

  const { data, error } = await supabase
    .from('telegram_users')
    .upsert(upsertData, { onConflict: 'telegram_id' })
    .select('id, telegram_id, chat_id, first_name, username, is_active')
    .single();

  if (error || !data) {
    throw new Error(`사용자 등록 실패: ${error?.message ?? '알 수 없는 오류'}`);
  }
  return data as TelegramUserRecord;
}
