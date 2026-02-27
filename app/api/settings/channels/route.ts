// GET /api/settings/channels — 채널 ON/OFF 설정 조회
// PUT /api/settings/channels — 채널 ON/OFF 설정 업데이트
// F-17 AC1

import { NextRequest, NextResponse } from 'next/server';
import {
  getChannelSettings,
  updateChannelSettings,
  type ChannelSettings,
} from '@/lib/fatigue-prevention';

// ─── GET: 채널 설정 조회 ─────────────────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const settings = await getChannelSettings();

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ─── PUT: 채널 설정 업데이트 ─────────────────────────────────────────────────

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

  // 입력 검증
  if (
    typeof body !== 'object' ||
    body === null ||
    !('tech' in body) ||
    !('world' in body) ||
    !('culture' in body) ||
    !('canada' in body)
  ) {
    return NextResponse.json(
      { success: false, error: 'tech, world, culture, canada 필드가 모두 필요합니다.' },
      { status: 400 },
    );
  }

  const obj = body as Record<string, unknown>;
  if (
    typeof obj.tech !== 'boolean' ||
    typeof obj.world !== 'boolean' ||
    typeof obj.culture !== 'boolean' ||
    typeof obj.canada !== 'boolean'
  ) {
    return NextResponse.json(
      { success: false, error: '채널 설정 값은 불리언이어야 합니다.' },
      { status: 400 },
    );
  }

  const settings: ChannelSettings = {
    tech:    obj.tech,
    world:   obj.world,
    culture: obj.culture,
    canada:  obj.canada,
  };

  const result = await updateChannelSettings(settings);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error ?? '저장 실패' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: settings,
  });
}
