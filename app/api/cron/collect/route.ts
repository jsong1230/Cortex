// [Cron 21:30 UTC / 06:30 KST] 콘텐츠 수집 파이프라인
// Vercel Cron Job 트리거 → 모든 채널 수집기 병렬 실행 → Claude API 요약/스코어링

import { NextRequest, NextResponse } from 'next/server';

interface CollectResult {
  collected: Record<string, number>;
  summarized: number;
  duplicatesSkipped: number;
  errors: string[];
}

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const result: CollectResult = {
    collected: { tech: 0, world: 0, culture: 0, canada: 0 },
    summarized: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  // TODO: Phase 0 — 각 채널 수집기 병렬 실행 (채널별 독립 try/catch)
  // const [techResult, worldResult, cultureResult, canadaResult] = await Promise.allSettled([
  //   collectTech(),
  //   collectWorld(),
  //   collectCulture(),
  //   collectCanada(),
  // ]);

  return NextResponse.json({ success: true, data: result });
}
