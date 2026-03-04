// 텔레그램 봇 명령어 처리 모듈
// F-07 설계서: docs/specs/F-07-telegram-commands/design.md
// 명령어: /good, /bad, /save, /more, /keyword, /stats, /mute

import { sendMessage, parseCallbackData } from '@/lib/telegram';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate, toKST } from '@/lib/utils/date';

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

export interface ParsedCommand {
  command: string;
  args: string[];
}

/** 텔레그램 Update 객체 (관련 필드만) */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUser {
  id: number;
  first_name: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

/** briefings.items JSONB 아이템 형태 */
interface BriefingItem {
  content_id: string;
  position: number;
  channel: string;
}

/** briefings 테이블 레코드 */
interface BriefingRecord {
  id: string;
  briefing_date: string;
  items: BriefingItem[];
  telegram_sent_at: string | null;
  created_at: string;
}

/** interest_profile 테이블 레코드 */
interface InterestTopicRecord {
  topic: string;
  score: number;
  interaction_count?: number;
}

// ─── parseCommand ────────────────────────────────────────────────────────────

/**
 * 텔레그램 메시지 텍스트에서 명령어와 인자를 파싱한다.
 * - 슬래시(`/`)로 시작해야 한다
 * - 봇 명칭 포함 형태 `/cmd@BotName` 처리
 * - 명령어는 소문자로 정규화
 * - 반환 null: 명령어 형식이 아닌 경우
 */
export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  if (!parts[0]) return null;

  // 봇 명칭 제거: /good@CortexBot → good
  const commandRaw = parts[0].split('@')[0];
  if (!commandRaw) return null;

  const command = commandRaw.toLowerCase();
  const args = parts.slice(1).filter((a) => a.length > 0);

  return { command, args };
}

// ─── 최신 브리핑 조회 헬퍼 ───────────────────────────────────────────────────

async function getLatestBriefing(): Promise<BriefingRecord | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('briefings')
    .select('id, briefing_date, items, telegram_sent_at, created_at')
    .order('briefing_date', { ascending: false })
    .limit(1);

  if (!data || !Array.isArray(data) || data.length === 0) return null;
  const record = data[0] as BriefingRecord;
  return record;
}

/** 오늘 날짜(KST) 기준 브리핑 조회 */
async function getTodayBriefing(): Promise<BriefingRecord | null> {
  const todayKST = formatDate(toKST(new Date()));
  const supabase = createServerClient();
  const { data } = await supabase
    .from('briefings')
    .select('id, briefing_date, items, telegram_sent_at, created_at')
    .eq('briefing_date', todayKST)
    .limit(1);

  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as BriefingRecord;
}

// ─── user_interactions INSERT 헬퍼 ──────────────────────────────────────────

/**
 * 텔레그램 반응을 user_interactions에 기록한다.
 * 메모 외 반응은 DB partial unique index(idx_interactions_content_type_unique)를 활용해
 * ON CONFLICT DO NOTHING으로 원자적 중복 방지한다.
 * 메모는 항상 새 레코드로 INSERT한다.
 */
async function insertInteraction(
  contentId: string,
  briefingId: string | null,
  interaction: string,
): Promise<void> {
  const supabase = createServerClient();

  const data = {
    content_id: contentId,
    briefing_id: briefingId,
    interaction,
    source: 'telegram_bot',
  };

  if (interaction === '메모') {
    // 메모는 중복 허용 — 항상 INSERT
    const { error } = await supabase.from('user_interactions').insert(data);
    if (error) throw new Error(`interaction insert 실패: ${error.message}`);
  } else {
    // 메모 외 반응: partial unique index 기반 ON CONFLICT DO NOTHING
    // (004_interaction_unique_constraint.sql: content_id + interaction WHERE interaction != '메모')
    const { error } = await supabase
      .from('user_interactions')
      .upsert(data, { onConflict: 'content_id,interaction', ignoreDuplicates: true });
    if (error) throw new Error(`interaction upsert 실패: ${error.message}`);
  }
}

// ─── handleGood ─────────────────────────────────────────────────────────────

/**
 * /good — 마지막 브리핑 전체 긍정 반응 기록 (AC1)
 */
export async function handleGood(): Promise<string> {
  const briefing = await getLatestBriefing();

  if (!briefing) {
    return '아직 브리핑이 없습니다. 내일 아침을 기다려주세요!';
  }

  const items = Array.isArray(briefing.items) ? briefing.items : [];
  for (const item of items) {
    await insertInteraction(item.content_id, briefing.id, '좋아요');
  }

  return '브리핑에 좋아요를 남겼습니다! 오늘 브리핑이 마음에 드셨군요 😊';
}

// ─── handleBad ──────────────────────────────────────────────────────────────

/**
 * /bad — 마지막 브리핑 전체 부정 반응 기록 + 후속 질문 (AC2)
 */
export async function handleBad(): Promise<string> {
  const briefing = await getLatestBriefing();

  if (!briefing) {
    return '아직 브리핑이 없습니다. 내일 아침을 기다려주세요!';
  }

  const items = Array.isArray(briefing.items) ? briefing.items : [];
  for (const item of items) {
    await insertInteraction(item.content_id, briefing.id, '싫어요');
  }

  return '브리핑에 싫어요를 남겼습니다.\n어떤 주제가 별로였나요? /keyword 명령어로 관심 없는 주제를 알려주시면 학습에 반영할게요.\n예) /keyword 주식';
}

// ─── handleSave ─────────────────────────────────────────────────────────────

/**
 * /save N — 오늘 브리핑 N번째 아이템 저장 (AC3)
 */
export async function handleSave(n: number): Promise<string> {
  // 유효성 검증: 1 이상의 정수여야 함
  if (!Number.isInteger(n) || n < 1) {
    return '유효하지 않은 번호입니다. /save 1 형식으로 입력해주세요.';
  }

  const briefing = await getTodayBriefing();
  if (!briefing) {
    return '오늘 브리핑이 없습니다. 내일 아침을 기다려주세요!';
  }

  const items = Array.isArray(briefing.items) ? briefing.items : [];
  const target = items.find((item) => item.position === n);

  if (!target) {
    return `유효하지 않은 번호입니다. 오늘 브리핑에는 ${items.length}개의 아이템이 있습니다.`;
  }

  await insertInteraction(target.content_id, briefing.id, '저장');
  return `${n}번째 아이템을 저장했습니다! /history 또는 웹에서 확인할 수 있어요.`;
}

// ─── handleMore ─────────────────────────────────────────────────────────────

/**
 * /more — 오늘 브리핑 웹 상세 페이지 URL 발송 (AC4)
 * 동기 함수 (DB 조회 불필요)
 */
export function handleMore(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cortex-briefing.vercel.app';
  const todayKST = formatDate(toKST(new Date()));
  return `오늘 브리핑 웹 상세 페이지:\n${appUrl}/briefings/${todayKST}`;
}

// ─── handleKeyword ──────────────────────────────────────────────────────────

/**
 * /keyword XXX — 관심 키워드를 interest_profile에 추가 (AC5)
 */
export async function handleKeyword(word: string): Promise<string> {
  const trimmed = word.trim();
  if (!trimmed) {
    return '키워드를 입력해주세요. 예) /keyword LLM';
  }

  const supabase = createServerClient();
  await supabase.from('interest_profile').upsert(
    {
      topic: trimmed,
      score: 0.7,
      interaction_count: 1,
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'topic' },
  );

  return `'${trimmed}'를 관심 키워드로 추가했습니다! 다음 브리핑부터 반영돼요.`;
}

// ─── handleStats ────────────────────────────────────────────────────────────

/**
 * /stats — 이번 달 관심 토픽 Top 5 + 읽은 아티클 수 (AC6)
 */
export async function handleStats(): Promise<string> {
  const supabase = createServerClient();

  // 이번 달 첫날 계산 (KST)
  const now = toKST(new Date());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearMonth = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  // 이번 달 반응 수 조회 (좋아요, 저장, 링크클릭, 웹열기)
  const { data: interactions } = await supabase
    .from('user_interactions')
    .select('id')
    .gte('created_at', monthStart)
    .filter('interaction', 'in', '("좋아요","저장","링크클릭","웹열기")');

  const articleCount = Array.isArray(interactions) ? interactions.length : 0;

  // 관심 토픽 Top 5 조회
  const { data: topics } = await supabase
    .from('interest_profile')
    .select('topic, score')
    .order('score', { ascending: false })
    .limit(5);

  const topicList = Array.isArray(topics) ? (topics as InterestTopicRecord[]) : [];

  if (topicList.length === 0 && articleCount === 0) {
    return `📊 ${yearMonth} 통계\n\n아직 이번 달 통계가 없습니다. 브리핑에 반응을 남겨보세요!`;
  }

  const lines: string[] = [];
  lines.push(`📊 이번 달 통계 (${yearMonth})`);
  lines.push('');

  if (topicList.length > 0) {
    lines.push('🔥 관심 토픽 Top 5:');
    topicList.forEach((t, i) => {
      const score = (t.score * 10).toFixed(1);
      lines.push(`${i + 1}. ${t.topic} (관심도 ${score})`);
    });
    lines.push('');
  }

  lines.push(`📚 읽은 아티클: ${articleCount}건`);

  return lines.join('\n');
}

// ─── handleMute ─────────────────────────────────────────────────────────────

/**
 * /mute N — N일간 브리핑 중단 (방학 모드) (AC7)
 * N=0이면 뮤트 해제
 */
export async function handleMute(n: number): Promise<string> {
  const supabase = createServerClient();

  if (n <= 0) {
    // 뮤트 해제
    await supabase.from('alert_settings').upsert(
      {
        trigger_type: 'briefing_mute',
        is_enabled: false,
        daily_count: 0,
        last_triggered_at: new Date().toISOString(),
      },
      { onConflict: 'trigger_type' },
    );
    return '브리핑 수신이 재개됩니다!';
  }

  // N일간 뮤트 설정
  await supabase.from('alert_settings').upsert(
    {
      trigger_type: 'briefing_mute',
      is_enabled: true,
      daily_count: n,
      last_triggered_at: new Date().toISOString(),
    },
    { onConflict: 'trigger_type' },
  );

  return `${n}일간 브리핑을 중단합니다. 다시 받으려면 /mute 0 을 입력하세요.`;
}

// ─── handleUnknown ──────────────────────────────────────────────────────────

/**
 * 알 수 없는 명령어 시 도움말 반환
 */
export function handleUnknown(command: string): string {
  return `알 수 없는 명령어: /${command}

사용 가능한 명령어:
/good — 오늘 브리핑 좋아요
/bad — 오늘 브리핑 싫어요 + 피드백
/save N — N번째 아이템 저장
/more — 오늘 브리핑 웹 URL
/keyword XXX — 관심 키워드 추가
/stats — 이번 달 통계
/mute N — N일간 브리핑 중단`;
}

// ─── handleCallbackQuery ────────────────────────────────────────────────────

/**
 * 인라인 버튼 콜백 처리
 * 콜백 데이터 형식: "{action}:{content_id}"
 * action: like | dislike | save
 */
export async function handleCallbackQuery(
  callbackQuery: TelegramCallbackQuery,
): Promise<void> {
  const { data } = callbackQuery;
  if (!data) return;

  const parsed = parseCallbackData(data);
  if (!parsed) return;

  const { action, contentId } = parsed;

  let interaction: string;
  switch (action) {
    case 'like':
      interaction = '좋아요';
      break;
    case 'dislike':
      interaction = '싫어요';
      break;
    case 'save':
      interaction = '저장';
      break;
    default:
      return; // 알 수 없는 action은 무시
  }

  // UPSERT로 중복 반응 방지
  await insertInteraction(contentId, null, interaction);
}

// ─── dispatchCommand ────────────────────────────────────────────────────────

/**
 * 파싱된 명령어를 해당 핸들러로 디스패치하고
 * 텔레그램으로 응답을 발송한다.
 */
export async function dispatchCommand(
  parsed: ParsedCommand,
): Promise<void> {
  let responseText: string;

  // eslint-disable-next-line no-console
  console.info(JSON.stringify({ event: 'cortex_command_dispatch', command: parsed.command, args: parsed.args }));

  switch (parsed.command) {
    case 'good':
      responseText = await handleGood();
      break;

    case 'bad':
      responseText = await handleBad();
      break;

    case 'save': {
      const rawN = parsed.args[0];
      const n = rawN ? parseInt(rawN, 10) : 0;
      if (!rawN || isNaN(n)) {
        responseText = '유효하지 않은 번호입니다. /save 1 형식으로 입력해주세요.';
      } else {
        responseText = await handleSave(n);
      }
      break;
    }

    case 'more':
      responseText = handleMore();
      break;

    case 'keyword': {
      const word = parsed.args.join(' ');
      responseText = await handleKeyword(word);
      break;
    }

    case 'stats':
      responseText = await handleStats();
      break;

    case 'mute': {
      const rawN = parsed.args[0];
      const n = rawN ? parseInt(rawN, 10) : NaN;
      if (!rawN || isNaN(n)) {
        responseText = '/mute N 형식으로 입력해주세요. 예) /mute 3';
      } else {
        responseText = await handleMute(n);
      }
      break;
    }

    default:
      responseText = handleUnknown(parsed.command);
      break;
  }

  // eslint-disable-next-line no-console
  console.info(JSON.stringify({ event: 'cortex_command_response', command: parsed.command, response: responseText.slice(0, 100) }));

  await sendMessage({ text: responseText });
}
