// F-22 월간 리포트 — Claude API 리포트 생성 단위 테스트
// report-generation.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Claude API 모킹 ───────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  },
}));

// ─── 헬퍼 — 표준 Claude 성공 응답 ────────────────────────────────────────

function makeClaudeResponse(text: string, inputTokens = 1000, outputTokens = 500) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

// ─── 샘플 리포트 마크다운 ────────────────────────────────────────────────

const SAMPLE_REPORT_MARKDOWN = `## 2026년 1월 월간 리포트

### 핵심 관심사
이번 달 LLM 인프라와 클라우드 비용 최적화에 집중하셨습니다.

### 눈에 띄는 변화
클라우드 관심도가 전월 대비 15% 상승했습니다.

### My Life OS 연동 인사이트
일기에서 "team-building" 키워드가 자주 등장하며, 관련 아티클 반응이 높았습니다.

### 추천 후속 질문
1. LLM 비용을 줄이기 위한 모델 경량화 전략은?
2. 멀티클라우드 환경에서의 비용 최적화 방안은?

### Top 5 읽은 주제
1. LLM (3회)
2. cloud-cost (1회)
3. msa (1회)`;

const SAMPLE_SUMMARY = '1월에는 LLM과 클라우드 비용 최적화에 집중하셨습니다. 관심사 점수가 전반적으로 상승했습니다.';

// ─── 샘플 데이터 ─────────────────────────────────────────────────────────

const SAMPLE_DATA = {
  month: '2026-01',
  topTopics: [
    { topic: 'llm', readCount: 3, score: 0.9 },
    { topic: 'cloud-cost', readCount: 1, score: 0.7 },
    { topic: 'msa', readCount: 1, score: 0.6 },
  ],
  scoreChanges: [
    { topic: 'llm', oldScore: 0.75, newScore: 0.9, direction: 'up' as const },
    { topic: 'cloud-cost', oldScore: 0.7, newScore: 0.7, direction: 'stable' as const },
  ],
  completedItems: 3,
  savedItems: 5,
  archivedItems: 1,
  mylifeosInsights: ['llm', 'team-building', 'cloud-cost'],
  followUpQuestions: [],
};

// ─── 테스트 스위트 ──────────────────────────────────────────────────────────

describe('generateReport — Claude API 리포트 생성 (F-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  it('RG-01: 정상 데이터로 generateReport 호출 시 content와 summary가 반환된다', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(
        JSON.stringify({ content: SAMPLE_REPORT_MARKDOWN, summary: SAMPLE_SUMMARY }),
      ),
    );

    const { generateReport } = await import('@/lib/monthly-report');
    const result = await generateReport(SAMPLE_DATA);

    expect(result).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(typeof result.summary).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('RG-02: generateReport 결과에 topTopics가 포함된다', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(
        JSON.stringify({ content: SAMPLE_REPORT_MARKDOWN, summary: SAMPLE_SUMMARY }),
      ),
    );

    const { generateReport } = await import('@/lib/monthly-report');
    const result = await generateReport(SAMPLE_DATA);

    expect(Array.isArray(result.topTopics)).toBe(true);
    expect(result.topTopics.length).toBeLessThanOrEqual(5);
  });

  it('RG-03: Claude API 호출 시 month 정보가 프롬프트에 포함된다', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(
        JSON.stringify({ content: SAMPLE_REPORT_MARKDOWN, summary: SAMPLE_SUMMARY }),
      ),
    );

    const { generateReport } = await import('@/lib/monthly-report');
    await generateReport(SAMPLE_DATA);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0] as {
      messages: Array<{ content: string }>;
    };
    const prompt = callArgs.messages[0].content;
    expect(prompt).toContain('2026-01');
  });

  it('RG-04: Claude API 실패 시 폴백 리포트를 반환한다 (에러 미발생)', async () => {
    mockCreate.mockRejectedValue(new Error('API 호출 실패'));

    const { generateReport } = await import('@/lib/monthly-report');
    const result = await generateReport(SAMPLE_DATA);

    // 에러가 throw되지 않고 폴백 결과를 반환해야 함
    expect(result).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(typeof result.summary).toBe('string');
  });

  it('RG-05: Claude JSON 파싱 실패 시 폴백 리포트를 반환한다', async () => {
    mockCreate.mockResolvedValue(makeClaudeResponse('이것은 JSON이 아닙니다'));

    const { generateReport } = await import('@/lib/monthly-report');
    const result = await generateReport(SAMPLE_DATA);

    expect(result).toBeDefined();
    expect(typeof result.content).toBe('string');
  });

  it('RG-06: ANTHROPIC_API_KEY 미설정 시 에러를 throw한다', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const { generateReport } = await import('@/lib/monthly-report');

    await expect(generateReport(SAMPLE_DATA)).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('RG-07: 생성된 content는 마크다운 형식을 포함한다', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(
        JSON.stringify({ content: SAMPLE_REPORT_MARKDOWN, summary: SAMPLE_SUMMARY }),
      ),
    );

    const { generateReport } = await import('@/lib/monthly-report');
    const result = await generateReport(SAMPLE_DATA);

    // 마크다운 헤더(##)가 포함되어야 함
    expect(result.content).toContain('#');
  });

  it('RG-08: generateReport 결과에 tokensUsed가 포함된다', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(
        JSON.stringify({ content: SAMPLE_REPORT_MARKDOWN, summary: SAMPLE_SUMMARY }),
        1000,
        500,
      ),
    );

    const { generateReport } = await import('@/lib/monthly-report');
    const result = await generateReport(SAMPLE_DATA);

    expect(typeof result.tokensUsed).toBe('number');
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});

describe('generateMonthlyInsight — summarizer.ts 통합 (F-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  it('MI-01: generateMonthlyInsight가 더 이상 "Not implemented"를 throw하지 않는다', async () => {
    // F-22 구현 후 generateMonthlyInsight는 실제로 동작해야 함
    // Claude API는 모킹되어 있으므로 호출 시 폴백 결과를 반환
    mockCreate.mockRejectedValue(new Error('mock'));

    const { generateMonthlyInsight } = await import('@/lib/summarizer');
    // "Not implemented" 에러가 아닌 실제 구현 결과를 반환해야 함
    const result = await generateMonthlyInsight({
      month: '2026-01',
      topTopics: [],
      scoreChanges: [],
      completedItems: 0,
      savedItems: 0,
      archivedItems: 0,
      mylifeosInsights: [],
      followUpQuestions: [],
    });

    expect(typeof result).toBe('string');
  });
});
