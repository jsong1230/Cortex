// POST /api/context/sync — My Life OS 컨텍스트 동기화
// 내부 전용 (Cron에서만 호출) — CRON_SECRET으로 인증
// F-18: AC3 — keyword_contexts 테이블에 키워드 저장 (7일 TTL)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { syncKeywordContexts } from '@/lib/mylifeos';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * user_settings에서 mylifeos_enabled 값을 읽어온다
 * 설정이 없거나 오류 시 false 반환 (AC5)
 */
async function isMyLifeOsEnabled(): Promise<boolean> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('user_settings')
      .select('mylifeos_enabled')
      .single();

    if (error || !data) {
      return false;
    }

    return typeof data.mylifeos_enabled === 'boolean' ? data.mylifeos_enabled : false;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. CRON_SECRET 인증
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 2. My Life OS 연동 활성화 여부 확인 (AC5)
  const enabled = await isMyLifeOsEnabled();
  if (!enabled) {
    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        event: 'cortex_mylifeos_sync_skipped',
        reason: 'mylifeos_enabled=false',
        timestamp: new Date().toISOString(),
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        synced: 0,
        expired: 0,
        skipped_reason: 'mylifeos_disabled',
      },
    });
  }

  try {
    // 3. 키워드 컨텍스트 동기화 (diary + todo + note)
    const supabase = createServerClient();
    const result = await syncKeywordContexts(supabase);

    // 구조화 로깅
    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        event: 'cortex_mylifeos_sync_complete',
        synced: result.synced,
        expired: result.expired,
        timestamp: new Date().toISOString(),
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        synced: result.synced,
        expired: result.expired,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'cortex_mylifeos_sync_error',
        error: message,
        timestamp: new Date().toISOString(),
      })
    );

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
