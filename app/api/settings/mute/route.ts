// GET    /api/settings/mute — 뮤트 상태 조회
// POST   /api/settings/mute — N일간 뮤트 설정
// DELETE /api/settings/mute — 뮤트 해제
// F-17 AC2

import { NextRequest, NextResponse } from 'next/server';
import { getMuteStatus, setMute } from '@/lib/fatigue-prevention';

// ─── GET: 뮤트 상태 조회 ─────────────────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const status = await getMuteStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ─── POST: N일간 뮤트 설정 ───────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '요청 본문 파싱 실패' },
      { status: 400 },
    );
  }

  // 입력 검증: days 필드 존재 여부
  if (
    typeof body !== 'object' ||
    body === null ||
    !('days' in body)
  ) {
    return NextResponse.json(
      { success: false, error: 'days 필드가 필요합니다.' },
      { status: 400 },
    );
  }

  const days = (body as Record<string, unknown>).days;

  // days 타입 및 범위 검증
  if (
    typeof days !== 'number' ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  ) {
    return NextResponse.json(
      { success: false, error: 'days는 1 이상 365 이하의 정수여야 합니다.' },
      { status: 400 },
    );
  }

  try {
    await setMute(days);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }

  const muteUntil = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000,
  ).toISOString();

  return NextResponse.json({
    success: true,
    data: {
      isMuted: true,
      days,
      muteUntil,
    },
  });
}

// ─── DELETE: 뮤트 해제 ───────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest): Promise<NextResponse> {
  try {
    await setMute(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { isMuted: false, muteUntil: null },
  });
}
