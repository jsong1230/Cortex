// GET /api/alerts/settings — 긴급 알림 설정 목록 조회
// PUT /api/alerts/settings — 트리거별 ON/OFF + 방해 금지 시간 설정
// AC7: alert_settings 테이블 관리

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import type { TriggerType } from '@/lib/alerts';

const VALID_TRIGGER_TYPES: TriggerType[] = [
  'toronto_weather',
  'keyword_breaking',
  'world_emergency',
  'culture_trend',
  'mylifeos_match',
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  void request;

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다.' },
      { status: 401 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('alert_settings')
    .select('id, trigger_type, is_enabled, quiet_hours_start, quiet_hours_end, last_triggered_at, daily_count, daily_count_reset_at')
    .order('trigger_type');

  if (error) {
    return NextResponse.json(
      { success: false, error: `설정 조회 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}

interface AlertSettingsBody {
  trigger_type: TriggerType;
  is_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다.' },
      { status: 401 }
    );
  }

  let body: AlertSettingsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body.trigger_type) {
    return NextResponse.json(
      { success: false, error: 'trigger_type은 필수입니다.' },
      { status: 400 }
    );
  }

  if (body.is_enabled === undefined || body.is_enabled === null) {
    return NextResponse.json(
      { success: false, error: 'is_enabled는 필수입니다.' },
      { status: 400 }
    );
  }

  if (!VALID_TRIGGER_TYPES.includes(body.trigger_type)) {
    return NextResponse.json(
      {
        success: false,
        error: `유효하지 않은 trigger_type입니다. 허용값: ${VALID_TRIGGER_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  const updateFields: Record<string, unknown> = {
    is_enabled: body.is_enabled,
  };

  if (body.quiet_hours_start !== undefined) {
    updateFields.quiet_hours_start = body.quiet_hours_start;
  }
  if (body.quiet_hours_end !== undefined) {
    updateFields.quiet_hours_end = body.quiet_hours_end;
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('alert_settings')
    .update(updateFields)
    .eq('trigger_type', body.trigger_type)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: `설정 업데이트 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
