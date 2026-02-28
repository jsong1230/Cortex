// F-24 주간 AI 요약 — AI 포커스 코멘트 단위 테스트
// AC3: "이번 주 당신의 관심은 {토픽}에 집중됐어요" AI 한줄 코멘트가 포함된다

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Claude API 모킹 ────────────────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  },
}));

import { generateFocusComment } from '@/lib/weekly-summary';

// ─── Supabase mock 빌더 ───────────────────────────────────────────────────────

interface InteractionRow {
  content_id: string;
  action: string;
  content_items: {
    tags: string[];
  } | null;
}

function makeSupabaseMock(interactions: InteractionRow[]) {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ data: interactions, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(queryBuilder),
  };
}

function makeClaudeTextResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    usage: { input_tokens: 200, output_tokens: 80 },
  };
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe('generateFocusComment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    vi.setSystemTime(new Date('2026-03-07T09:00:00+09:00'));
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.useRealTimers();
  });

  it('AC3-1: 이번 주 인터랙션이 있을 때 AI 코멘트 문자열을 반환한다', async () => {
    const interactions: InteractionRow[] = [
      {
        content_id: 'c1',
        action: 'like',
        content_items: { tags: ['llm', 'ai'] },
      },
      {
        content_id: 'c2',
        action: 'like',
        content_items: { tags: ['llm', 'transformer'] },
      },
      {
        content_id: 'c3',
        action: 'save',
        content_items: { tags: ['cloud-cost', 'aws'] },
      },
    ];

    const supabase = makeSupabaseMock(interactions);
    const commentText = '이번 주 당신의 관심은 LLM 기술에 집중됐어요.';
    mockCreate.mockResolvedValueOnce(makeClaudeTextResponse(commentText));

    const result = await generateFocusComment(supabase);

    expect(result).toBe(commentText);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('AC3-2: Claude API에 "관심" 또는 "집중" 관련 프롬프트가 전달된다', async () => {
    const interactions: InteractionRow[] = [
      {
        content_id: 'c1',
        action: 'like',
        content_items: { tags: ['kubernetes'] },
      },
    ];

    const supabase = makeSupabaseMock(interactions);
    mockCreate.mockResolvedValueOnce(
      makeClaudeTextResponse('이번 주 당신의 관심은 Kubernetes에 집중됐어요.'),
    );

    await generateFocusComment(supabase);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    const prompt = callArgs.messages[0].content as string;
    // 프롬프트에 집중 / 관심 관련 내용이 포함돼야 함
    expect(prompt).toMatch(/관심|집중|focus/i);
  });

  it('AC3-3: 인터랙션이 없으면 기본 코멘트를 반환한다 (Claude 미호출)', async () => {
    const supabase = makeSupabaseMock([]);

    const result = await generateFocusComment(supabase);

    // Claude를 호출하지 않고 기본 메시지 반환
    expect(mockCreate).not.toHaveBeenCalled();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('AC3-4: Claude API 실패 시 기본 코멘트를 반환한다 (graceful degradation)', async () => {
    const interactions: InteractionRow[] = [
      {
        content_id: 'c1',
        action: 'like',
        content_items: { tags: ['rust'] },
      },
    ];

    const supabase = makeSupabaseMock(interactions);
    mockCreate.mockRejectedValueOnce(new Error('Claude API 오류'));

    const result = await generateFocusComment(supabase);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('AC3-5: DB 조회 실패 시 기본 코멘트를 반환한다', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: null, error: new Error('DB 오류') }),
    };
    const supabase = { from: vi.fn().mockReturnValue(queryBuilder) };

    const result = await generateFocusComment(supabase);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('AC3-6: 반환된 코멘트는 한 문장이다 (개행 없이 trim된 문자열)', async () => {
    const interactions: InteractionRow[] = [
      {
        content_id: 'c1',
        action: 'like',
        content_items: { tags: ['startup', 'team-building'] },
      },
    ];

    const supabase = makeSupabaseMock(interactions);
    const rawComment = '  이번 주 당신의 관심은 스타트업 전략에 집중됐어요.  ';
    mockCreate.mockResolvedValueOnce(makeClaudeTextResponse(rawComment));

    const result = await generateFocusComment(supabase);

    // trim이 적용돼야 함
    expect(result).toBe(rawComment.trim());
  });

  it('AC3-7: user_interactions 테이블에서 이번 주 데이터를 조회한다', async () => {
    const supabase = makeSupabaseMock([]);

    await generateFocusComment(supabase);

    expect(supabase.from).toHaveBeenCalledWith('user_interactions');
  });
});
