// [Cron] 월간 리포트 생성 + 텔레그램 발송 (F-22)
// 매월 1일 01:00 UTC (KST 10:00) 실행
// AC1: 지난달 완독 아이템 + My Life OS 일기를 교차 분석
// AC2: 핵심 관심사, 변화, 인사이트, 추천 후속 질문
// AC3: 텔레그램 + 웹 /insights에서 조회 가능
// AC4: Top 5 읽은 주제

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  gatherMonthlyData,
  generateReport,
  saveReport,
  sendReportToTelegram,
  markReportAsSent,
  getPreviousMonth,
} from '@/lib/monthly-report';

/**
 * Vercel Cron Secret 검증
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── 1. 인증 ────────────────────────────────────────────────────────────
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  // ANTHROPIC_API_KEY 사전 검증
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다',
        errorCode: 'CONFIG_ERROR',
      },
      { status: 500 },
    );
  }

  // ─── 2. 대상 월 결정 (AC1: 지난달 분석) ────────────────────────────────
  const reportMonth = getPreviousMonth();

  // eslint-disable-next-line no-console
  console.info(
    JSON.stringify({
      event: 'cortex_monthly_report_start',
      report_month: reportMonth,
      timestamp: new Date().toISOString(),
    }),
  );

  try {
    const supabase = createServerClient();

    // ─── 3. 데이터 집계 ─────────────────────────────────────────────────
    const monthlyData = await gatherMonthlyData(supabase, reportMonth);

    // ─── 4. Claude API로 리포트 생성 (AC2) ─────────────────────────────
    const generatedReport = await generateReport(monthlyData);

    // ─── 5. DB 저장 ─────────────────────────────────────────────────────
    let savedReportId: string | undefined;
    try {
      const saved = await saveReport(supabase, reportMonth, generatedReport);
      savedReportId = saved.id;
    } catch (saveError) {
      // 저장 실패는 fatal — 텔레그램 발송 전 중단
      const errMsg = saveError instanceof Error ? saveError.message : String(saveError);
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          event: 'cortex_monthly_report_save_error',
          error: errMsg,
          report_month: reportMonth,
        }),
      );
      return NextResponse.json(
        {
          success: false,
          error: `리포트 저장 실패: ${errMsg}`,
          errorCode: 'SAVE_ERROR',
        },
        { status: 500 },
      );
    }

    // ─── 6. 텔레그램 발송 (AC3) — non-fatal ───────────────────────────
    let telegramSent = false;
    try {
      await sendReportToTelegram(generatedReport, reportMonth);
      await markReportAsSent(supabase, reportMonth);
      telegramSent = true;
    } catch (telegramError) {
      // 텔레그램 발송 실패는 non-fatal — 리포트 저장은 완료됨
      const errMsg = telegramError instanceof Error ? telegramError.message : String(telegramError);
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          event: 'cortex_monthly_report_telegram_error',
          error: errMsg,
          report_month: reportMonth,
        }),
      );
    }

    // ─── 7. 구조화 로깅 ──────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        event: 'cortex_monthly_report_complete',
        report_month: reportMonth,
        report_id: savedReportId,
        top_topics: generatedReport.topTopics.length,
        tokens_used: generatedReport.tokensUsed,
        telegram_sent: telegramSent,
        timestamp: new Date().toISOString(),
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        report_month: reportMonth,
        report_id: savedReportId,
        top_topics_count: generatedReport.topTopics.length,
        tokens_used: generatedReport.tokensUsed,
        telegram_sent: telegramSent,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_monthly_report_fatal_error',
        error: errMsg,
        report_month: reportMonth,
      }),
    );
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 },
    );
  }
}
