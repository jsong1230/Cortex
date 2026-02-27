// F-05 AI 요약/스코어링 — summarizer.ts 단위 테스트
// test-spec.md U-01 ~ U-26

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── 모킹 설정 ─────────────────────────────────────────────────────────────
// Claude API mock create 함수를 모듈 수준에서 공유
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  },
}));

// Supabase 클라이언트 모킹
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}));

import {
  summarizeAndScore,
  selectWorldItems,
  buildBatchPrompt,
  type SummarizeInput,
  type SummarizeResult,
} from '@/lib/summarizer';

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

/** 표준 Claude 성공 응답 생성 */
function makeClaudeResponse(
  items: Array<{ index: number; summary: string; tags: string[]; score: number }>,
  inputTokens = 500,
  outputTokens = 200,
) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(items),
      },
    ],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

/** 테스트용 SummarizeInput 생성 */
function makeInput(overrides: Partial<SummarizeInput> = {}): SummarizeInput {
  return {
    id: 'test-id-1',
    title: '테스트 제목',
    source: 'hackernews',
    channel: 'tech',
    ...overrides,
  };
}

// ─── 테스트 ────────────────────────────────────────────────────────────────

describe('summarizeAndScore', () => {
  beforeEach(() => {
    // resetAllMocks: mock 호출 기록 + 구현(mockResolvedValueOnce 큐 포함) 초기화
    vi.resetAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  // U-05: 빈 배열 입력 시 빈 결과 반환, Claude API 호출 없음
  it('U-05: 빈 배열 입력 시 빈 결과를 반환하고 Claude API를 호출하지 않는다', async () => {
    const result = await summarizeAndScore([]);

    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // U-01: TECH 아이템 배치 요약 성공
  it('U-01: TECH 아이템 3개를 배치 요약하여 SummarizeResult[]를 반환한다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: 'AI 트렌드 요약입니다', tags: ['llm', 'ai'], score: 0.8 },
        { index: 1, summary: '클라우드 비용 최적화 내용', tags: ['cloud-cost'], score: 0.7 },
        { index: 2, summary: '마이크로서비스 아키텍처 소개', tags: ['msa'], score: 0.6 },
      ]),
    );

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: 'AI 트렌드', channel: 'tech' }),
      makeInput({ id: 'id-2', title: '클라우드 비용', channel: 'tech' }),
      makeInput({ id: 'id-3', title: 'MSA 소개', channel: 'tech' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(3);
    result.forEach((r: SummarizeResult) => {
      expect(r.summaryAi).toBeTruthy();
      expect(Array.isArray(r.tags)).toBe(true);
      expect(r.scoreInitial).toBeGreaterThanOrEqual(0.0);
      expect(r.scoreInitial).toBeLessThanOrEqual(1.0);
    });
  });

  // U-02: WORLD 아이템 배치 요약 성공, scoreInitial >= 0.7
  it('U-02: WORLD 아이템 2개를 배치 요약하고 scoreInitial이 0.7 이상이다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: '주요 국제 뉴스 요약', tags: ['world-news'], score: 0.9 },
        { index: 1, summary: '경제 이슈 요약', tags: ['economy'], score: 0.8 },
      ]),
    );

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '국제 뉴스', channel: 'world' }),
      makeInput({ id: 'id-2', title: '경제 이슈', channel: 'world' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(2);
    result.forEach((r: SummarizeResult) => {
      expect(r.scoreInitial).toBeGreaterThanOrEqual(0.7);
    });
  });

  // U-03: CULTURE 아이템 5개 배치 요약 성공
  it('U-03: CULTURE 아이템 5개를 배치 요약하여 모두 유효한 요약을 반환한다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: '넷플릭스 인기 드라마 요약', tags: ['netflix'], score: 0.7 },
        { index: 1, summary: '멜론 차트 1위 곡 소개', tags: ['music'], score: 0.6 },
        { index: 2, summary: '유튜브 트렌딩 영상 요약', tags: ['youtube'], score: 0.8 },
        { index: 3, summary: '네이버 실검 키워드 분석', tags: ['trend'], score: 0.5 },
        { index: 4, summary: '문화 이슈 요약', tags: ['culture'], score: 0.6 },
      ]),
    );

    const items: SummarizeInput[] = Array.from({ length: 5 }, (_, i) =>
      makeInput({ id: `id-${i}`, title: `문화 아이템 ${i}`, channel: 'culture' }),
    );

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(5);
    result.forEach((r: SummarizeResult) => {
      expect(r.summaryAi).toBeTruthy();
    });
  });

  // U-04: TORONTO 날씨 아이템 scoreInitial >= 0.9
  it('U-04: TORONTO 날씨 아이템의 scoreInitial이 0.9 이상이다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: '토론토 뉴스 요약', tags: ['toronto-news'], score: 0.7 },
        { index: 1, summary: '캐나다 이슈 요약', tags: ['canada'], score: 0.6 },
        { index: 2, summary: '토론토 날씨: 최고 -5도, 흐림', tags: ['weather'], score: 0.95 },
      ]),
    );

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '토론토 뉴스', channel: 'canada' }),
      makeInput({ id: 'id-2', title: '캐나다 이슈', channel: 'canada' }),
      makeInput({ id: 'id-3', title: '토론토 날씨', channel: 'canada', source: 'weather' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(3);
    const weatherItem = result.find((r: SummarizeResult) => r.id === 'id-3');
    expect(weatherItem?.scoreInitial).toBeGreaterThanOrEqual(0.9);
  });

  // U-06: fullText 500자 초과 시 잘림
  it('U-06: fullText가 500자 초과인 아이템은 Claude에 500자로 잘려서 전달된다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: '긴 텍스트 요약', tags: ['test'], score: 0.7 },
      ]),
    );

    const longText = 'A'.repeat(2000);
    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '긴 텍스트', fullText: longText, channel: 'tech' }),
    ];

    await summarizeAndScore(items);

    // Claude API 호출 시 프롬프트에 2000자 전체가 포함되지 않아야 함
    const callArg = mockCreate.mock.calls[0]?.[0];
    const userPrompt: string = callArg?.messages?.[0]?.content ?? '';
    // 600자 연속된 A가 없어야 함 (500자로 잘렸으므로)
    expect(userPrompt).not.toContain('A'.repeat(600));
  });

  // U-07: fullText 없는 아이템 — title만으로 요약 성공
  it('U-07: fullText가 없는 아이템도 title만으로 요약 생성이 성공한다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: '제목만으로 생성된 요약', tags: ['test'], score: 0.5 },
      ]),
    );

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '제목만 있는 아이템', fullText: undefined, channel: 'tech' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(1);
    expect(result[0].summaryAi).toBeTruthy();
  });

  // U-08: Claude API 실패 시 폴백 (AC4)
  it('U-08: Claude API 호출이 실패하면 summaryAi=title, scoreInitial=0.5, tags=[]로 폴백한다', async () => {
    // 두 번 모두 실패 (재시도 포함)
    mockCreate.mockRejectedValueOnce(new Error('API 호출 실패'));
    mockCreate.mockRejectedValueOnce(new Error('API 호출 실패'));

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '폴백 테스트 제목', channel: 'tech' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(1);
    expect(result[0].summaryAi).toBe('폴백 테스트 제목');
    expect(result[0].scoreInitial).toBe(0.5);
    expect(result[0].tags).toEqual([]);
  });

  // U-09: Claude API 1회 실패 후 재시도 성공
  it('U-09: Claude API가 첫 번째 호출에서 실패하고 두 번째 시도에서 성공한다', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('일시적 오류'))
      .mockResolvedValueOnce(
        makeClaudeResponse([
          { index: 0, summary: '재시도 성공 요약', tags: ['retry'], score: 0.7 },
        ]),
      );

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '재시도 테스트', channel: 'tech' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(1);
    expect(result[0].summaryAi).toBe('재시도 성공 요약');
  });

  // U-10: Claude 응답 JSON 파싱 실패 시 배치 전체 폴백
  it('U-10: Claude 응답이 잘못된 JSON이면 해당 배치 전체에 폴백을 적용한다', async () => {
    // 첫 번째 호출: 잘못된 JSON
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'invalid json {{{' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    // 재시도도 동일하게 잘못된 JSON
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'invalid json {{{' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '파싱 실패 아이템 1', channel: 'tech' }),
      makeInput({ id: 'id-2', title: '파싱 실패 아이템 2', channel: 'tech' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(2);
    result.forEach((r: SummarizeResult, i: number) => {
      expect(r.summaryAi).toBe(items[i].title);
      expect(r.scoreInitial).toBe(0.5);
      expect(r.tags).toEqual([]);
    });
  });

  // U-11: Claude 응답에서 일부 아이템 누락 시 누락 아이템만 폴백
  it('U-11: Claude 응답에서 일부 아이템이 누락되면 누락 아이템만 폴백하고 나머지는 정상 처리한다', async () => {
    // 5개 입력, index 0, 2, 4만 응답
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: '아이템 0 요약', tags: ['tag0'], score: 0.8 },
        { index: 2, summary: '아이템 2 요약', tags: ['tag2'], score: 0.7 },
        { index: 4, summary: '아이템 4 요약', tags: ['tag4'], score: 0.6 },
      ]),
    );

    const items: SummarizeInput[] = Array.from({ length: 5 }, (_, i) =>
      makeInput({ id: `id-${i}`, title: `아이템 ${i}`, channel: 'tech' }),
    );

    const result = await summarizeAndScore(items);

    expect(result).toHaveLength(5);

    // index 0, 2, 4는 정상 처리
    expect(result.find((r: SummarizeResult) => r.id === 'id-0')?.summaryAi).toBe('아이템 0 요약');
    expect(result.find((r: SummarizeResult) => r.id === 'id-2')?.summaryAi).toBe('아이템 2 요약');
    expect(result.find((r: SummarizeResult) => r.id === 'id-4')?.summaryAi).toBe('아이템 4 요약');

    // index 1, 3은 폴백
    expect(result.find((r: SummarizeResult) => r.id === 'id-1')?.summaryAi).toBe('아이템 1');
    expect(result.find((r: SummarizeResult) => r.id === 'id-1')?.scoreInitial).toBe(0.5);
    expect(result.find((r: SummarizeResult) => r.id === 'id-3')?.summaryAi).toBe('아이템 3');
    expect(result.find((r: SummarizeResult) => r.id === 'id-3')?.scoreInitial).toBe(0.5);
  });

  // U-12: scoreInitial이 1.0 초과이면 1.0으로 클램핑
  it('U-12: Claude가 score=1.5를 반환하면 1.0으로 클램핑한다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: '클램핑 테스트', tags: ['test'], score: 1.5 },
      ]),
    );

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '클램핑 테스트', channel: 'tech' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result[0].scoreInitial).toBe(1.0);
  });

  // U-13: scoreInitial이 음수이면 0.0으로 클램핑
  it('U-13: Claude가 score=-0.3을 반환하면 0.0으로 클램핑한다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: '음수 클램핑 테스트', tags: ['test'], score: -0.3 },
      ]),
    );

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '음수 클램핑 테스트', channel: 'tech' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result[0].scoreInitial).toBe(0.0);
  });

  // U-14: 토큰 사용량 추적
  it('U-14: 정상 응답 시 tokensUsed가 0보다 큰 값으로 기록된다', async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse(
        [{ index: 0, summary: '토큰 추적 테스트', tags: ['test'], score: 0.7 }],
        500,
        200,
      ),
    );

    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: '토큰 추적', channel: 'tech' }),
    ];

    const result = await summarizeAndScore(items);

    expect(result[0].tokensUsed).toBeGreaterThan(0);
  });

  // U-15: SummarizeStats — summarized, failed, totalItems 검증
  it('U-15: 10개 입력, 7개 성공, 3개 실패 시 올바른 통계를 반환한다', async () => {
    // 7개만 응답 (3개 누락: index 7, 8, 9)
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse(
        Array.from({ length: 7 }, (_, i) => ({
          index: i,
          summary: `요약 ${i}`,
          tags: ['tag'],
          score: 0.7,
        })),
        700,
        350,
      ),
    );

    const items: SummarizeInput[] = Array.from({ length: 10 }, (_, i) =>
      makeInput({ id: `id-${i}`, title: `아이템 ${i}`, channel: 'tech' }),
    );

    const result = await summarizeAndScore(items);

    // 총 10개 결과 반환
    expect(result).toHaveLength(10);

    // 7개는 정상 요약 (tokensUsed > 0)
    const summarized = result.filter((r: SummarizeResult) => r.tokensUsed > 0).length;
    expect(summarized).toBe(7);

    // 3개는 폴백 (index 7, 8, 9)
    const fallbacks = result.filter((r: SummarizeResult) => r.tokensUsed === 0);
    expect(fallbacks).toHaveLength(3);
    fallbacks.forEach((r: SummarizeResult) => {
      expect(r.scoreInitial).toBe(0.5);
    });
  });

  // 채널별 그룹핑 테스트
  it('채널이 다른 아이템들은 채널별로 그룹핑되어 별도 Claude 호출을 수행한다', async () => {
    // tech 채널 응답
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: 'Tech 요약', tags: ['tech'], score: 0.8 },
        { index: 1, summary: 'Tech 요약 2', tags: ['tech'], score: 0.7 },
      ]),
    );

    // culture 채널 응답
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse([
        { index: 0, summary: 'Culture 요약', tags: ['culture'], score: 0.6 },
      ]),
    );

    const items: SummarizeInput[] = [
      makeInput({ id: 'tech-1', title: 'Tech 아이템 1', channel: 'tech' }),
      makeInput({ id: 'tech-2', title: 'Tech 아이템 2', channel: 'tech' }),
      makeInput({ id: 'culture-1', title: 'Culture 아이템', channel: 'culture' }),
    ];

    const result = await summarizeAndScore(items);

    // 총 3개 결과
    expect(result).toHaveLength(3);
    // 채널이 2개이므로 Claude API는 2번 호출
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  // ANTHROPIC_API_KEY 미설정 시 에러
  it('ANTHROPIC_API_KEY가 설정되지 않으면 에러를 throw한다', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const items: SummarizeInput[] = [makeInput({ id: 'id-1', title: '테스트', channel: 'tech' })];

    await expect(summarizeAndScore(items)).rejects.toThrow();
  });
});

describe('selectWorldItems', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  // U-16: WORLD 헤드라인에서 최대 2개 선정
  it('U-16: 10개 헤드라인 중 최대 2개 인덱스를 선정한다', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ selected: [2, 7], reason: '구조적 변화 이슈' }),
        },
      ],
      usage: { input_tokens: 300, output_tokens: 50 },
    });

    const headlines = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      title: `헤드라인 ${i}`,
    }));

    const result = await selectWorldItems(headlines);

    expect(result.selectedIndices.length).toBeLessThanOrEqual(2);
    expect(result.selectedIndices).toContain(2);
    expect(result.selectedIndices).toContain(7);
  });

  // U-17: 헤드라인이 2개 이하인 경우 최대 2개 선정
  it('U-17: 헤드라인이 2개인 경우 최대 2개를 선정한다', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ selected: [0, 1], reason: '모두 중요한 이슈' }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 30 },
    });

    const headlines = [
      { index: 0, title: '헤드라인 0' },
      { index: 1, title: '헤드라인 1' },
    ];

    const result = await selectWorldItems(headlines);

    expect(result.selectedIndices.length).toBeLessThanOrEqual(2);
  });

  // U-18: 빈 헤드라인 목록 — Claude 호출 없음
  it('U-18: 빈 헤드라인 목록 입력 시 selectedIndices=[]를 반환하고 Claude를 호출하지 않는다', async () => {
    const result = await selectWorldItems([]);

    expect(result.selectedIndices).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // U-19: Claude 선정 실패 시 상위 2개 폴백
  it('U-19: Claude API 선정 실패 시 상위 2개 인덱스 [0, 1]을 반환한다', async () => {
    mockCreate.mockRejectedValueOnce(new Error('선정 실패'));
    mockCreate.mockRejectedValueOnce(new Error('선정 실패'));

    const headlines = Array.from({ length: 5 }, (_, i) => ({
      index: i,
      title: `헤드라인 ${i}`,
    }));

    const result = await selectWorldItems(headlines);

    expect(result.selectedIndices).toEqual([0, 1]);
  });
});

describe('buildBatchPrompt', () => {
  // U-23: TECH 채널 프롬프트에 관심도 기준 포함
  it('U-23: TECH 채널 프롬프트에 "관심도", "실무 적용", "최신성" 키워드가 포함된다', () => {
    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: 'Tech 아이템', channel: 'tech' }),
    ];

    const prompt = buildBatchPrompt(items, 'tech');

    expect(prompt).toContain('관심도');
    expect(prompt).toContain('실무 적용');
    expect(prompt).toContain('최신성');
  });

  // U-24: CULTURE 채널 프롬프트에 트렌드 기준 포함
  it('U-24: CULTURE 채널 프롬프트에 "순위", "검색량" 키워드가 포함된다', () => {
    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: 'Culture 아이템', channel: 'culture' }),
    ];

    const prompt = buildBatchPrompt(items, 'culture');

    expect(prompt).toContain('순위');
    expect(prompt).toContain('검색량');
  });

  // U-25: TORONTO 채널 프롬프트에 가족/토론토 맥락 포함
  it('U-25: TORONTO 채널 프롬프트에 "가족", "토론토" 키워드가 포함된다', () => {
    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: 'Toronto 아이템', channel: 'canada' }),
    ];

    const prompt = buildBatchPrompt(items, 'canada');

    expect(prompt).toContain('가족');
    expect(prompt).toContain('토론토');
  });

  // U-26: fullText 500자 잘림 확인
  it('U-26: 1000자 fullText를 가진 아이템의 프롬프트 내 텍스트가 500자로 제한된다', () => {
    const longText = 'B'.repeat(1000);
    const items: SummarizeInput[] = [
      makeInput({ id: 'id-1', title: 'Long Text', fullText: longText, channel: 'tech' }),
    ];

    const prompt = buildBatchPrompt(items, 'tech');

    // 600자 연속 B는 없어야 함 (500자로 잘렸으므로)
    expect(prompt).not.toContain('B'.repeat(600));
    // 정확히 500자 B는 있어야 함
    expect(prompt).toContain('B'.repeat(500));
  });
});
