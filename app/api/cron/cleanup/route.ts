// [Cron] 오래된 데이터 정리 — PRD 비기능 요구사항: content_items 90일 아카이브 정책
// 매주 월요일 UTC 04:00 (KST 13:00) 실행

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { log } from '@/lib/utils/logger';
import { CONTENT_ARCHIVE_DAYS } from '@/lib/constants';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CONTENT_ARCHIVE_DAYS);
  const cutoffIso = cutoff.toISOString();

  const supabase = createServerClient();
  const result: Record<string, number | string> = {};

  // 1. user_interactions — content_items FK 참조이므로 먼저 삭제
  try {
    const { count, error } = await supabase
      .from('user_interactions')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffIso);

    if (error) throw error;
    result.user_interactions_deleted = count ?? 0;
  } catch (err) {
    log({ event: 'cortex_cleanup_user_interactions_error', level: 'error', error: err });
    result.user_interactions_error = err instanceof Error ? err.message : String(err);
  }

  // 2. content_items
  try {
    const { count, error } = await supabase
      .from('content_items')
      .delete({ count: 'exact' })
      .lt('collected_at', cutoffIso);

    if (error) throw error;
    result.content_items_deleted = count ?? 0;
  } catch (err) {
    log({ event: 'cortex_cleanup_content_items_error', level: 'error', error: err });
    result.content_items_error = err instanceof Error ? err.message : String(err);
  }

  // 3. briefings — 발송 기록 (content_items와 동일한 90일 정책 적용)
  try {
    const cutoffDate = cutoff.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const { count, error } = await supabase
      .from('briefings')
      .delete({ count: 'exact' })
      .lt('briefing_date', cutoffDate);

    if (error) throw error;
    result.briefings_deleted = count ?? 0;
  } catch (err) {
    log({ event: 'cortex_cleanup_briefings_error', level: 'error', error: err });
    result.briefings_error = err instanceof Error ? err.message : String(err);
  }

  log({
    event: 'cortex_cleanup_complete',
    data: { cutoff: cutoffIso, archive_days: CONTENT_ARCHIVE_DAYS, ...result },
  });

  return NextResponse.json({ success: true, data: { cutoff: cutoffIso, ...result } });
}
