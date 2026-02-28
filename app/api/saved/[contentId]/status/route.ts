// PUT  /api/saved/[contentId]/status — 읽기 상태 수동 변경 (F-19 AC3)
// GET  /api/saved/[contentId]/status — 현재 읽기 상태 조회
// 인증: Supabase Auth 세션 (쿠키 기반)
// 참조: docs/specs/F-19-reading-loop/design.md

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import {
  markAsCompleted,
  markAsReading,
  getSavedItemByContentId,
  type ReadingStatus,
} from '@/lib/reading-loop';

// UUID v4 형식 검증 정규식
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 허용되는 수동 전환 상태 (API를 통해 직접 변경 가능한 상태) */
const ALLOWED_MANUAL_STATUSES: ReadingStatus[] = ['completed', 'reading'];

interface RouteParams {
  params: { contentId: string };
}

// ─── PUT /api/saved/[contentId]/status ───────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { contentId } = params;

  // 1. 인증 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. contentId UUID 형식 검증
  if (!UUID_REGEX.test(contentId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'contentId는 유효한 UUID여야 합니다',
        errorCode: 'INVALID_CONTENT_ID',
      },
      { status: 400 }
    );
  }

  // 3. 요청 본문 파싱
  let body: { status: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // 4. status 필드 검증
  if (!body.status || !ALLOWED_MANUAL_STATUSES.includes(body.status as ReadingStatus)) {
    return NextResponse.json(
      {
        success: false,
        error: `status는 '${ALLOWED_MANUAL_STATUSES.join("' | '")}' 중 하나여야 합니다`,
        errorCode: 'INVALID_STATUS',
      },
      { status: 400 }
    );
  }

  const targetStatus = body.status as ReadingStatus;

  // 5. 상태 전환 실행
  try {
    let result;

    if (targetStatus === 'completed') {
      result = await markAsCompleted(contentId);
    } else {
      // reading 상태로 전환
      result = await markAsReading(contentId);
    }

    // 6. 레코드가 없으면 404
    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: '해당 콘텐츠의 저장 기록이 없습니다',
          errorCode: 'SAVED_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // 레코드 없음 에러 처리
    if (errMsg.includes('레코드를 찾을 수 없습니다') || errMsg.includes('Row not found')) {
      return NextResponse.json(
        {
          success: false,
          error: '해당 콘텐츠의 저장 기록이 없습니다',
          errorCode: 'SAVED_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: '상태 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// ─── GET /api/saved/[contentId]/status ───────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { contentId } = params;

  // 1. 인증 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. contentId UUID 형식 검증
  if (!UUID_REGEX.test(contentId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'contentId는 유효한 UUID여야 합니다',
        errorCode: 'INVALID_CONTENT_ID',
      },
      { status: 400 }
    );
  }

  // 3. 현재 상태 조회
  const item = await getSavedItemByContentId(contentId);

  if (!item) {
    return NextResponse.json(
      {
        success: false,
        error: '해당 콘텐츠의 저장 기록이 없습니다',
        errorCode: 'SAVED_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: item,
  });
}
