// PUT /api/alerts/settings — 긴급 알림 트리거 ON/OFF 설정
// 인증: Supabase Auth 세션

import { NextRequest, NextResponse } from 'next/server';

type TriggerType =
  | 'toronto_weather'
  | 'keyword_breaking'
  | 'world_emergency'
  | 'culture_trend'
  | 'mylifeos_match';

interface AlertSettingsBody {
  trigger_type: TriggerType;
  is_enabled: boolean;
  quiet_hours_start?: string; // HH:MM
  quiet_hours_end?: string;   // HH:MM
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  let body: AlertSettingsBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body.trigger_type || body.is_enabled === undefined) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // TODO: Phase 2
  // alert_settings 테이블 upsert

  void body; // 사용 예정

  return NextResponse.json(
    { success: false, error: 'Not implemented' },
    { status: 501 }
  );
}
