// POST /api/interactions — 웹 대시보드 반응 저장 (UPSERT)
// GET  /api/interactions — 반응 이력 조회
// 인증: Supabase Auth 세션
// 참조: docs/specs/F-11-user-interactions/design.md, docs/system/api-conventions.md
// F-23 AC4: 세렌디피티 아이템 반응 별도 추적

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { type InteractionType, VALID_INTERACTIONS } from '@/lib/interactions/types';
import { updateInterestScore } from '@/lib/scoring';
import { extractTopicsFromTags, registerTopicsToProfile } from '@/lib/topic-extractor';
import { isSerendipityItem } from '@/lib/serendipity';
import { markAsReading } from '@/lib/reading-loop';

// ─── POST /api/interactions — 반응 저장 (UPSERT) ──────────────────────────

interface InteractionBody {
  content_id: string;
  briefing_id?: string;
  interaction: InteractionType;
  memo_text?: string;
  source: 'web';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Supabase Auth 세션 검증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. 요청 본문 파싱
  let body: InteractionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // 3. 필수 필드 검증 (briefing_id는 선택)
  if (!body.content_id || !body.interaction) {
    return NextResponse.json(
      { success: false, error: 'content_id, interaction은 필수입니다' },
      { status: 400 }
    );
  }

  // 4. interaction 타입 검증
  if (!VALID_INTERACTIONS.includes(body.interaction)) {
    return NextResponse.json(
      {
        success: false,
        error: `interaction 필드는 '좋아요'|'싫어요'|'저장'|'메모'|'웹열기'|'링크클릭'|'스킵' 중 하나여야 합니다`,
        errorCode: 'INTERACTION_INVALID_TYPE',
      },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 5. 메모는 항상 새 레코드 INSERT (복수 허용)
  if (body.interaction === '메모') {
    const insertData: Record<string, unknown> = {
      content_id: body.content_id,
      briefing_id: body.briefing_id ?? null,
      interaction: body.interaction,
      source: body.source ?? 'web',
    };

    if (body.memo_text) {
      insertData.memo_text = body.memo_text;
    }

    const { data, error } = await supabase
      .from('user_interactions')
      .insert(insertData)
      .select('id, interaction, content_id')
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: '메모 저장 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: { id: data.id, interaction: data.interaction, content_id: data.content_id } },
      { status: 201 }
    );
  }

  // 6. 메모 외 반응: UPSERT (중복 방지)
  // onConflict: 'content_id,interaction' → 부분 유니크 인덱스 활용
  const upsertData: Record<string, unknown> = {
    content_id: body.content_id,
    briefing_id: body.briefing_id ?? null,
    interaction: body.interaction,
    source: body.source ?? 'web',
  };

  const { data: upsertResult, error: upsertError } = await supabase
    .from('user_interactions')
    .upsert(upsertData, {
      onConflict: 'content_id,interaction',
      ignoreDuplicates: true,
    })
    .select('id, interaction, content_id')
    .single();

  if (upsertError) {
    return NextResponse.json(
      { success: false, error: '반응 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }

  // 7. UPSERT 결과가 null이면 이미 존재하는 레코드 → 기존 레코드 조회 후 200 반환
  if (!upsertResult) {
    const { data: existing } = await supabase
      .from('user_interactions')
      .select('id, interaction, content_id')
      .eq('content_id', body.content_id)
      .eq('interaction', body.interaction)
      .single();

    return NextResponse.json(
      { success: true, data: existing ?? { content_id: body.content_id, interaction: body.interaction } },
      { status: 200 }
    );
  }

  // 8-F19. F-19 AC2: 원문 링크 클릭 시 saved_items 상태를 "읽는 중"으로 자동 전환
  // fire-and-forget — 읽기 상태 전환 실패가 반응 저장을 블록하면 안 됨
  if (body.interaction === '웹열기' || body.interaction === '링크클릭') {
    void markAsReading(body.content_id).catch(() => {
      // saved_items에 해당 레코드가 없으면 무시 (저장하지 않은 아이템 클릭)
    });
  }

  // 8. 학습 루프: content_items 태그 조회 후 interest_profile 업데이트 (AC1, AC2, AC3)
  // 비동기 fire-and-forget (학습 실패가 반응 저장을 블록하면 안 됨)
  void (async () => {
    try {
      const { data: contentItem } = await supabase
        .from('content_items')
        .select('tags')
        .eq('id', body.content_id)
        .single();

      const rawTags = (contentItem as { tags?: string[] } | null)?.tags ?? [];
      const topics = extractTopicsFromTags(rawTags);

      if (topics.length > 0) {
        // AC1: 신규 토픽 등록
        await registerTopicsToProfile(topics);
        // AC2+AC3: EMA 업데이트
        await updateInterestScore({
          contentId: body.content_id,
          interaction: body.interaction,
          tags: topics,
        });
      }

      // F-23 AC4: 세렌디피티 반응 별도 추적
      // briefing_id가 있을 때 briefings.items에서 세렌디피티 여부 확인
      if (body.briefing_id) {
        const { data: briefingRow } = await supabase
          .from('briefings')
          .select('items')
          .eq('id', body.briefing_id)
          .single();

        if (briefingRow) {
          type BriefingItemRef = { content_id: string; channel: string; title?: string };
          const briefingItems = (briefingRow.items as BriefingItemRef[]) ?? [];
          const isSerendipity = isSerendipityItem(body.content_id, briefingItems);

          if (isSerendipity) {
            // 세렌디피티 반응을 별도 메타데이터로 로깅 (AC4)
            // eslint-disable-next-line no-console
            console.info(
              JSON.stringify({
                event: 'cortex_serendipity_reaction',
                content_id: body.content_id,
                briefing_id: body.briefing_id,
                interaction: body.interaction,
                serendipity_source: 'serendipity_channel',
                timestamp: new Date().toISOString(),
              })
            );
          }
        }
      }
    } catch (learningErr) {
      const errMsg = learningErr instanceof Error ? learningErr.message : String(learningErr);
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          event: 'cortex_learning_loop_error',
          content_id: body.content_id,
          interaction: body.interaction,
          error: errMsg,
        })
      );
    }
  })();

  return NextResponse.json(
    {
      success: true,
      data: {
        id: upsertResult.id,
        interaction: upsertResult.interaction,
        content_id: upsertResult.content_id,
      },
    },
    { status: 201 }
  );
}

// ─── GET /api/interactions — 반응 이력 조회 ──────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. 인증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. 쿼리 파라미터 파싱
  const { searchParams } = new URL(request.url);
  const contentId = searchParams.get('content_id') ?? undefined;
  const interaction = searchParams.get('interaction') ?? undefined;
  const source = searchParams.get('source') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;

  // limit: 기본 50, 최대 100
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);

  // offset: 기본 0, 음수는 0으로
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
  const offset = isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

  // 3. 쿼리 빌드
  const supabase = createServerClient();

  let query = supabase
    .from('user_interactions')
    .select(
      'id, content_id, briefing_id, interaction, memo_text, source, created_at, content_items!inner(title, channel)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (contentId) {
    query = query.eq('content_id', contentId);
  }
  if (interaction) {
    query = query.eq('interaction', interaction);
  }
  if (source) {
    query = query.eq('source', source);
  }
  if (from) {
    query = query.gte('created_at', from);
  }
  if (to) {
    // to 날짜 포함 (하루 끝까지)
    query = query.lte('created_at', `${to}T23:59:59.999Z`);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, error: '이력 조회 중 오류가 발생했습니다', errorCode: 'INTERACTION_INVALID_QUERY' },
      { status: 400 }
    );
  }

  // 4. 응답 변환 (content_items 중첩 필드를 평탄화)
  type RawItem = {
    id: string;
    content_id: string;
    briefing_id: string | null;
    interaction: string;
    memo_text: string | null;
    source: string;
    created_at: string;
    content_items: { title: string; channel: string };
  };

  const items = (data ?? []).map((row: unknown) => {
    const r = row as RawItem;
    return {
      id: r.id,
      content_id: r.content_id,
      briefing_id: r.briefing_id,
      interaction: r.interaction,
      memo_text: r.memo_text,
      source: r.source,
      created_at: r.created_at,
      content_title: r.content_items?.title ?? null,
      content_channel: r.content_items?.channel ?? null,
    };
  });

  const total = count ?? items.length;
  const hasMore = offset + limit < total;

  return NextResponse.json({
    success: true,
    data: { items, total, limit, offset, hasMore },
  });
}
