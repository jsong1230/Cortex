// GET /api/content/[id] — 콘텐츠 아이템 상세 조회
// 인증: Supabase Auth 세션 (쿠키 기반)
// 참조: docs/specs/F-09-web-item-detail/design.md

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

// UUID 유효성 검증 정규식
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// briefings.items JSONB 배열 아이템 타입
interface BriefingItem {
  content_id: string;
  position?: number;
  channel?: string;
  reason?: string | null;
}

// 관련 아이템 타입
interface RelatedItem {
  content_id: string;
  channel: string;
  title: string;
  summary_ai: string | null;
  source: string;
  source_url: string;
}

interface RouteContext {
  params: { id: string };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // 1. Supabase Auth 세션 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. URL 파라미터에서 content id 추출
  const { id: contentId } = context.params;

  // 3. UUID 형식 유효성 검증
  if (!UUID_REGEX.test(contentId)) {
    return NextResponse.json(
      {
        success: false,
        error: '유효하지 않은 콘텐츠 ID 형식입니다',
        errorCode: 'INVALID_CONTENT_ID',
      },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 4. content_items 단건 조회
  const { data: contentItem, error: contentError } = await supabase
    .from('content_items')
    .select('id, channel, title, summary_ai, source, source_url, tags, collected_at')
    .eq('id', contentId)
    .maybeSingle();

  if (contentError) {
    return NextResponse.json(
      { success: false, error: '콘텐츠 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  // 5. 콘텐츠 없으면 404
  if (!contentItem) {
    return NextResponse.json(
      {
        success: false,
        error: '해당 콘텐츠를 찾을 수 없습니다',
        errorCode: 'CONTENT_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  // 6-A. user_interactions — 최신 반응 조회 (메모 제외)
  const { data: reactionRows } = await supabase
    .from('user_interactions')
    .select('interaction')
    .eq('content_id', contentId)
    .neq('interaction', '메모')
    .order('created_at', { ascending: false })
    .limit(1);

  const userInteraction = (reactionRows?.[0] as { interaction: string } | undefined)?.interaction ?? null;

  // 6-B. user_interactions — 최신 메모 텍스트 조회
  const { data: memoRows } = await supabase
    .from('user_interactions')
    .select('memo_text')
    .eq('content_id', contentId)
    .eq('interaction', '메모')
    .order('created_at', { ascending: false })
    .limit(1);

  const memoText = (memoRows?.[0] as { memo_text: string | null } | undefined)?.memo_text ?? null;

  // 7. briefings — 최근 7일 조회 후 JS에서 해당 content_id 필터링하여 reason 추출
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const { data: recentBriefings } = await supabase
    .from('briefings')
    .select('id, items')
    .gte('briefing_date', sevenDaysAgoStr)
    .order('briefing_date', { ascending: false })
    .limit(7);

  let reason: string | null = null;
  let briefingId: string | null = null;

  if (recentBriefings && recentBriefings.length > 0) {
    const matchingBriefing = (recentBriefings as Array<{ id: string; items: BriefingItem[] }>).find(
      (b) =>
        Array.isArray(b.items) &&
        b.items.some((item: BriefingItem) => item.content_id === contentId)
    );

    if (matchingBriefing) {
      briefingId = matchingBriefing.id;
      const matchingItem = matchingBriefing.items.find(
        (item: BriefingItem) => item.content_id === contentId
      );
      reason = matchingItem?.reason ?? null;
    }
  }

  // 8. 관련 아이템 조회 (tags overlap, 자기 자신 제외, 최대 5건)
  const currentTags = (contentItem as { tags?: string[] | null }).tags;
  let relatedItems: RelatedItem[] = [];

  if (currentTags && currentTags.length > 0) {
    const { data: relatedRows } = await supabase
      .from('content_items')
      .select('id, channel, title, summary_ai, source, source_url')
      .overlaps('tags', currentTags)
      .neq('id', contentId)
      .order('collected_at', { ascending: false })
      .limit(5);

    relatedItems = (relatedRows ?? [])
      .slice(0, 5)
      .map((item: Record<string, unknown>) => ({
        content_id: item.id as string,
        channel: item.channel as string,
        title: item.title as string,
        summary_ai: (item.summary_ai as string | null) ?? null,
        source: item.source as string,
        source_url: item.source_url as string,
      }));
  }

  // 9. 응답 조립
  const typedItem = contentItem as {
    id: string;
    channel: string;
    title: string;
    summary_ai: string | null;
    source: string;
    source_url: string;
    tags: string[] | null;
    collected_at: string;
  };

  return NextResponse.json({
    success: true,
    data: {
      content_id: typedItem.id,
      channel: typedItem.channel,
      title: typedItem.title,
      summary_ai: typedItem.summary_ai,
      source: typedItem.source,
      source_url: typedItem.source_url,
      tags: typedItem.tags,
      collected_at: typedItem.collected_at,
      reason,
      briefing_id: briefingId,
      user_interaction: userInteraction,
      memo_text: memoText,
      related_items: relatedItems,
    },
  });
}
