// GET /api/interactions/stats — 반응 통계 (by_type, by_source, by_channel)
// 인증: Supabase Auth 세션
// 참조: docs/specs/F-11-user-interactions/design.md, docs/system/api-conventions.md

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { VALID_INTERACTIONS, ALL_SOURCES } from '@/lib/interactions/types';

// ─── GET /api/interactions/stats ──────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. 인증
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다', errorCode: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. 날짜 파라미터 파싱 (기본: 오늘 기준 30일)
  const { searchParams } = new URL(request.url);

  const today = new Date();
  const defaultTo = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const defaultFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const from = searchParams.get('from') ?? defaultFrom;
  const to = searchParams.get('to') ?? defaultTo;

  const supabase = createServerClient();

  // 3. by_type 집계 — interaction 타입별 카운트
  const { data: typeRows } = await supabase
    .from('user_interactions')
    .select('interaction')
    .gte('created_at', from)
    .lte('created_at', `${to}T23:59:59.999Z`)
    .order('created_at', { ascending: true });

  // 4. by_source 집계 — 소스별 카운트
  const { data: sourceRows } = await supabase
    .from('user_interactions')
    .select('source')
    .gte('created_at', from)
    .lte('created_at', `${to}T23:59:59.999Z`)
    .order('created_at', { ascending: true });

  // 5. by_channel 집계 — content_items JOIN으로 채널별 카운트
  const { data: channelRows } = await supabase
    .from('user_interactions')
    .select('content_items!inner(channel)')
    .gte('created_at', from)
    .lte('created_at', `${to}T23:59:59.999Z`)
    .order('created_at', { ascending: true });

  // 6. by_type 집계 처리
  const byType: Record<string, number> = {};
  // 모든 타입을 0으로 초기화
  for (const t of VALID_INTERACTIONS) {
    byType[t] = 0;
  }

  type TypeRow = { interaction: string };
  for (const row of (typeRows ?? []) as TypeRow[]) {
    const key = row.interaction;
    if (key in byType) {
      byType[key] = (byType[key] ?? 0) + 1;
    }
  }

  // 7. by_source 집계 처리
  const bySource: Record<string, number> = {};
  // 모든 소스를 0으로 초기화
  for (const s of ALL_SOURCES) {
    bySource[s] = 0;
  }

  type SourceRow = { source: string };
  for (const row of (sourceRows ?? []) as SourceRow[]) {
    const key = row.source;
    bySource[key] = (bySource[key] ?? 0) + 1;
  }

  // 8. by_channel 집계 처리
  const byChannel: Record<string, number> = {};

  type ChannelRow = { content_items: { channel: string } | { channel: string }[] };
  for (const row of (channelRows ?? []) as unknown as ChannelRow[]) {
    // Supabase가 단일 객체 또는 배열로 반환할 수 있음
    const ci = Array.isArray(row.content_items)
      ? row.content_items[0]
      : row.content_items;
    const channel = ci?.channel;
    if (channel) {
      byChannel[channel] = (byChannel[channel] ?? 0) + 1;
    }
  }

  // 9. 전체 카운트
  const total = (typeRows ?? []).length;

  return NextResponse.json({
    success: true,
    data: {
      period: { from, to },
      total,
      by_type: byType,
      by_source: bySource,
      by_channel: byChannel,
    },
  });
}
