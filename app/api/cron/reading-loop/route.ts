// [Cron] F-19 읽기 루프 자동화 작업
// - 매일: 30일 경과 미완독 아이템 자동 보관 (AC4)
// - 매일: 25일 경과 미완독 아이템 "곧 보관 처리" 텔레그램 알림 (AC6)
// - 매월 마지막 날: 월간 미완독 요약 발송 (AC7)
// 참조: docs/specs/F-19-reading-loop/design.md

import { NextRequest, NextResponse } from 'next/server';
import {
  archiveExpiredItems,
  getItemsNearingArchive,
  getMonthlyUnreadSummary,
} from '@/lib/reading-loop';
import { sendMessage } from '@/lib/telegram';

// ─── 인증 헬퍼 ───────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ─── 날짜 헬퍼 ───────────────────────────────────────────────────────────────

/**
 * KST 기준 오늘이 해당 월의 마지막 날인지 확인 (AC7)
 */
function isLastDayOfMonth(): boolean {
  const now = new Date();
  const kstDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const kstDate = new Date(`${kstDateStr}T00:00:00+09:00`);

  // 다음 날이 1일이면 오늘이 마지막 날
  const tomorrow = new Date(kstDate.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow.getDate() === 1;
}

/**
 * KST 기준 오늘 날짜 문자열 (YYYY-MM-DD)
 */
function getTodayKstDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

// ─── POST /api/cron/reading-loop ─────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Cron 시크릿 검증
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const todayKst = getTodayKstDate();
  const results: Record<string, unknown> = { date: todayKst };

  // ─── AC4: 30일 경과 아이템 자동 보관 ─────────────────────────────────────
  let archivedCount = 0;
  try {
    archivedCount = await archiveExpiredItems();
    results.archived_count = archivedCount;

    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      event: 'cortex_reading_loop_archive',
      archived_count: archivedCount,
      date: todayKst,
    }));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      event: 'cortex_reading_loop_archive_error',
      error: errMsg,
      date: todayKst,
    }));
    results.archive_error = errMsg;
  }

  // ─── AC6: 25일 경과 "곧 보관 처리" 텔레그램 알림 ─────────────────────────
  try {
    const nearingItems = await getItemsNearingArchive();

    if (nearingItems.length > 0) {
      const lines: string[] = [
        '⚠️ <b>곧 보관 처리될 아이템 알림</b>',
        '',
        '저장 후 25일이 지났지만 아직 읽지 않은 아이템이 있습니다:',
        '',
      ];

      for (const item of nearingItems) {
        const savedDate = item.saved_at.slice(0, 10);
        lines.push(`• <a href="${item.source_url}">${item.title}</a> (저장일: ${savedDate})`);
      }

      lines.push('');
      lines.push('📌 5일 이내에 읽지 않으면 자동으로 보관됩니다.');

      await sendMessage({
        text: lines.join('\n'),
        parseMode: 'HTML',
      });

      results.near_archive_notified = nearingItems.length;

      // eslint-disable-next-line no-console
      console.info(JSON.stringify({
        event: 'cortex_reading_loop_near_archive_notified',
        count: nearingItems.length,
        date: todayKst,
      }));
    } else {
      results.near_archive_notified = 0;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      event: 'cortex_reading_loop_near_archive_error',
      error: errMsg,
      date: todayKst,
    }));
    results.near_archive_error = errMsg;
  }

  // ─── AC7: 매월 마지막 날 월간 미완독 요약 발송 ───────────────────────────
  if (isLastDayOfMonth()) {
    try {
      const summary = await getMonthlyUnreadSummary();

      if (summary.total > 0) {
        const [year, month] = todayKst.split('-');
        const message = [
          `📊 <b>${year}년 ${month}월 미완독 요약</b>`,
          '',
          `📚 전체 미완독: ${summary.total}개`,
          `🔖 저장됨 (읽기 전): ${summary.saved}개`,
          `📖 읽는 중: ${summary.reading}개`,
          '',
          '다음 달에는 더 많이 읽어봐요! 💪',
        ].join('\n');

        await sendMessage({
          text: message,
          parseMode: 'HTML',
        });

        results.monthly_summary_sent = true;
        results.monthly_unread_total = summary.total;

        // eslint-disable-next-line no-console
        console.info(JSON.stringify({
          event: 'cortex_reading_loop_monthly_summary',
          total: summary.total,
          saved: summary.saved,
          reading: summary.reading,
          date: todayKst,
        }));
      } else {
        results.monthly_summary_sent = false;
        results.monthly_summary_skipped = '미완독 아이템 없음';
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        event: 'cortex_reading_loop_monthly_summary_error',
        error: errMsg,
        date: todayKst,
      }));
      results.monthly_summary_error = errMsg;
    }
  }

  return NextResponse.json({
    success: true,
    data: results,
  });
}
