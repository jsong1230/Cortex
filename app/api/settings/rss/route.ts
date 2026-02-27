// GET    /api/settings/rss — 사용자 정의 RSS URL 목록 조회
// POST   /api/settings/rss — RSS URL 추가 (URL 검증 포함)
// DELETE /api/settings/rss — RSS URL 삭제
// F-20 AC1

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface RssSource {
  url: string;
  name: string;
  channel: 'tech' | 'world' | 'culture' | 'canada';
}

const VALID_CHANNELS = ['tech', 'world', 'culture', 'canada'] as const;

// ─── 유틸리티 ─────────────────────────────────────────────────────────────────

/** URL 형식 검증 */
function isValidUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** user_settings에서 custom_rss_urls를 읽어온다 */
async function getRssUrls(): Promise<RssSource[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('user_settings')
    .select('custom_rss_urls')
    .single();

  if (error || !data) {
    return [];
  }

  const urls = data.custom_rss_urls as RssSource[] | null;
  return Array.isArray(urls) ? urls : [];
}

/** user_settings에 custom_rss_urls를 저장한다 */
async function saveRssUrls(urls: RssSource[]): Promise<{ error: { message: string } | null }> {
  const supabase = createServerClient();
  const result = await supabase
    .from('user_settings')
    .upsert(
      {
        id: 'singleton',
        custom_rss_urls: urls,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

  return { error: result.error };
}

// ─── GET: RSS URL 목록 조회 ───────────────────────────────────────────────────

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const urls = await getRssUrls();

    return NextResponse.json({
      success: true,
      data: urls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ─── POST: RSS URL 추가 ───────────────────────────────────────────────────────

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

  // url 필드 검증
  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof (body as Record<string, unknown>).url !== 'string'
  ) {
    return NextResponse.json(
      { success: false, error: 'url 필드가 필요합니다.' },
      { status: 400 },
    );
  }

  const obj = body as Record<string, unknown>;
  const url = obj.url as string;

  // URL 형식 검증
  if (!isValidUrl(url)) {
    return NextResponse.json(
      { success: false, error: '유효하지 않은 URL 형식입니다. http:// 또는 https:// 로 시작해야 합니다.' },
      { status: 400 },
    );
  }

  // name 처리 (없으면 URL에서 추출)
  const name =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim()
      : new URL(url).hostname;

  // channel 검증 (없으면 기본값 'tech')
  const channel = typeof obj.channel === 'string' ? obj.channel : 'tech';
  if (!VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
    return NextResponse.json(
      {
        success: false,
        error: `유효하지 않은 channel입니다. 허용값: ${VALID_CHANNELS.join(', ')}`,
      },
      { status: 400 },
    );
  }

  try {
    const existingUrls = await getRssUrls();

    // 중복 URL 검사
    const isDuplicate = existingUrls.some((item) => item.url === url);
    if (isDuplicate) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 RSS URL입니다.' },
        { status: 409 },
      );
    }

    const newSource: RssSource = {
      url,
      name,
      channel: channel as RssSource['channel'],
    };

    const updatedUrls = [...existingUrls, newSource];
    const { error: saveError } = await saveRssUrls(updatedUrls);

    if (saveError) {
      return NextResponse.json(
        { success: false, error: `저장 실패: ${saveError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedUrls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ─── DELETE: RSS URL 삭제 ─────────────────────────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '요청 본문 파싱 실패' },
      { status: 400 },
    );
  }

  // url 필드 검증
  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof (body as Record<string, unknown>).url !== 'string'
  ) {
    return NextResponse.json(
      { success: false, error: 'url 필드가 필요합니다.' },
      { status: 400 },
    );
  }

  const urlToDelete = (body as Record<string, unknown>).url as string;

  try {
    const existingUrls = await getRssUrls();

    // 존재 여부 확인
    const targetIndex = existingUrls.findIndex((item) => item.url === urlToDelete);
    if (targetIndex === -1) {
      return NextResponse.json(
        { success: false, error: '등록되지 않은 RSS URL입니다.' },
        { status: 404 },
      );
    }

    const updatedUrls = existingUrls.filter((item) => item.url !== urlToDelete);
    const { error: saveError } = await saveRssUrls(updatedUrls);

    if (saveError) {
      return NextResponse.json(
        { success: false, error: `삭제 실패: ${saveError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedUrls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
