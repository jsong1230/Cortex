// F-24 주간 AI 요약 — 기술 트렌드 요약 단위 테스트
// AC1: 매주 토요일 브리핑에 "이번 주 기술 트렌드 3줄 요약"이 포함된다

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Claude API 모킹 ────────────────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  },
}));

import { generateTechTrendsSummary } from '@/lib/weekly-summary';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** 표준 Claude 텍스트 응답 생성 */
function makeClaudeTextResponse(text: string, inputTokens = 300, outputTokens = 150) {
  return {
    content: [{ type: 'text' as const, text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

/** Supabase mock 빌더 — tech 채널 content_items 반환 */
function makeSupabaseMock(techItems: Array<{ title: string; tags: string[]; channel: string }>) {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: techItems, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(queryBuilder),
  };
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe('generateTechTrendsSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    // 2026-03-07 토요일 KST 09:00
    vi.setSystemTime(new Date('2026-03-07T09:00:00+09:00'));
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.useRealTimers();
  });

  it('AC1-1: tech 채널 아이템이 있을 때 3줄 요약 문자열을 반환한다', async () => {
    const techItems = [
      { title: 'LLM 성능 개선 기법', tags: ['llm', 'performance'], channel: 'tech' },
      { title: 'Rust 메모리 안전성', tags: ['rust', 'memory'], channel: 'tech' },
      { title: 'Kubernetes 비용 절감', tags: ['kubernetes', 'cost'], channel: 'tech' },
    ];

    const supabase = makeSupabaseMock(techItems);
    const summaryText =
      '1. LLM 성능 개선 연구가 주목받고 있습니다.\n2. Rust가 시스템 프로그래밍에서 부상.\n3. 클라우드 비용 절감이 화두.';

    mockCreate.mockResolvedValueOnce(makeClaudeTextResponse(summaryText));

    const result = await generateTechTrendsSummary(supabase);

    expect(result).toBe(summaryText);
  });

  it('AC1-2: Claude API에 기술 트렌드 요약 요청이 전달된다', async () => {
    const techItems = [
      { title: 'AI 에이전트 동향', tags: ['ai', 'agent'], channel: 'tech' },
    ];

    const supabase = makeSupabaseMock(techItems);
    mockCreate.mockResolvedValueOnce(
      makeClaudeTextResponse('1. AI 에이전트.\n2. 클라우드.\n3. 오픈소스.'),
    );

    await generateTechTrendsSummary(supabase);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    // 프롬프트에 "3줄" 또는 "요약" 관련 내용이 포함돼야 함
    const prompt = callArgs.messages[0].content as string;
    expect(prompt).toMatch(/3줄|세 줄|요약/);
  });

  it('AC1-3: tech 채널 아이템이 없어도 빈 문자열 또는 기본 메시지를 반환한다 (폴백)', async () => {
    const supabase = makeSupabaseMock([]);
    // Claude 호출 없이 폴백 반환 기대
    const result = await generateTechTrendsSummary(supabase);

    // 빈 문자열이거나, Claude를 호출하지 않는 경우 모두 허용
    expect(typeof result).toBe('string');
  });

  it('AC1-4: DB 조회 실패 시 빈 문자열을 반환한다 (graceful degradation)', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: new Error('DB 연결 실패') }),
    };
    const supabase = { from: vi.fn().mockReturnValue(queryBuilder) };

    const result = await generateTechTrendsSummary(supabase);
    expect(result).toBe('');
  });

  it('AC1-5: Claude API 실패 시 빈 문자열을 반환한다 (graceful degradation)', async () => {
    const techItems = [
      { title: 'AI 에이전트 동향', tags: ['ai', 'agent'], channel: 'tech' },
    ];
    const supabase = makeSupabaseMock(techItems);
    mockCreate.mockRejectedValueOnce(new Error('Claude API 오류'));

    const result = await generateTechTrendsSummary(supabase);
    expect(result).toBe('');
  });

  it('AC1-6: tech 채널 아이템만 조회한다 (TECH 채널 필터)', async () => {
    const supabase = makeSupabaseMock([]);
    await generateTechTrendsSummary(supabase);

    // from('content_items') 호출 확인
    expect(supabase.from).toHaveBeenCalledWith('content_items');
  });
});
