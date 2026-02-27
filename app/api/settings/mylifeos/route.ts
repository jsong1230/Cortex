// GET /api/settings/mylifeos — My Life OS 연동 상태 조회
// PUT /api/settings/mylifeos — My Life OS 연동 ON/OFF 설정
// F-20 AC5

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/** user_settings에서 mylifeos_enabled 값을 읽어온다 */
async function getMyLifeOsEnabled(): Promise<boolean> {
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

// ─── GET: My Life OS 연동 상태 조회 ──────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const enabled = await getMyLifeOsEnabled();

    return NextResponse.json({
      success: true,
      data: { enabled },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ─── PUT: My Life OS 연동 ON/OFF 설정 ────────────────────────────────────────

export async function PUT(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '요청 본문 파싱 실패' },
      { status: 400 },
    );
  }

  // enabled 필드 검증
  if (
    typeof body !== 'object' ||
    body === null ||
    !('enabled' in body)
  ) {
    return NextResponse.json(
      { success: false, error: 'enabled 필드가 필요합니다.' },
      { status: 400 },
    );
  }

  const obj = body as Record<string, unknown>;
  if (typeof obj.enabled !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'enabled 값은 불리언이어야 합니다.' },
      { status: 400 },
    );
  }

  const enabled = obj.enabled;

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          id: 'singleton',
          mylifeos_enabled: enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (error) {
      return NextResponse.json(
        { success: false, error: `저장 실패: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { enabled },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
