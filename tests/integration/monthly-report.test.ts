// F-22 통합 테스트 — 월간 리포트 전체 플로우
// gatherMonthlyData → generateReport → saveReport → sendReportToTelegram

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Claude API 모킹 ─────────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  },
}));

// ─── 텔레그램 모킹 ────────────────────────────────────────────────────────────

const mockSendMessage = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/telegram', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/telegram')>();
  return {
    ...original,
    sendMessage: mockSendMessage,
  };
});

// ─── Supabase 모킹 ────────────────────────────────────────────────────────────

let mockInteractionsData: Record<string, unknown>[] = [];
let mockSavedItemsData: Record<string, unknown>[] = [];
let mockProfileData: Record<string, unknown>[] = [];
let mockKeywordData: Record<string, unknown>[] = [];
let mockInsertError: { message: string } | null = null;
let mockInsertData: Record<string, unknown> | null = null;

// 삽입된 리포트를 추적
let capturedInsertData: Record<string, unknown> | null = null;

const mockInsert = vi.fn().mockImplementation((data: Record<string, unknown>) => {
  capturedInsertData = data;
  return {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockInsertData, error: mockInsertError }),
  };
});

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'user_interactions') {
    return {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockInteractionsData, error: null }),
    };
  }
  if (table === 'saved_items') {
    return {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockSavedItemsData, error: null }),
    };
  }
  if (table === 'interest_profile') {
    return {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProfileData, error: null }),
    };
  }
  if (table === 'keyword_contexts') {
    return {
      select: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ data: mockKeywordData, error: null }),
    };
  }
  if (table === 'score_history') {
    return {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  }
  if (table === 'monthly_reports') {
    return {
      insert: mockInsert,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}));

// ─── cron secret 헬퍼 ────────────────────────────────────────────────────────

function makeCronRequest(url = 'http://localhost/api/cron/monthly-report') {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer test-cron-secret`,
    },
  });
}

// ─── 샘플 Claude 응답 ────────────────────────────────────────────────────────

const SAMPLE_REPORT_MARKDOWN = `## 2026년 1월 월간 리포트\n### 핵심 관심사\nLLM 위주\n### 추천 후속 질문\n1. 어떻게?`;
const SAMPLE_SUMMARY = '1월 LLM에 집중하셨습니다.';

function makeClaudeResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 1000, output_tokens: 500 },
  };
}

// ─── 통합 테스트 스위트 ──────────────────────────────────────────────────────

describe('POST /api/cron/monthly-report — 전체 플로우 통합 테스트 (F-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    capturedInsertData = null;

    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://test.vercel.app';

    mockInteractionsData = [
      { content_id: 'c-001', topic: 'llm', created_at: '2026-01-10T10:00:00Z' },
      { content_id: 'c-002', topic: 'llm', created_at: '2026-01-11T10:00:00Z' },
      { content_id: 'c-003', topic: 'cloud-cost', created_at: '2026-01-12T10:00:00Z' },
    ];
    mockSavedItemsData = [
      { status: 'completed', completed_at: '2026-01-20T10:00:00Z' },
      { status: 'archived', archived_at: '2026-01-25T10:00:00Z' },
    ];
    mockProfileData = [
      { topic: 'llm', score: 0.9 },
      { topic: 'cloud-cost', score: 0.7 },
    ];
    mockKeywordData = [
      { keywords: ['llm', 'team-building'], source: 'diary', expires_at: '2026-02-05T00:00:00Z' },
    ];
    mockInsertError = null;
    mockInsertData = { id: 'new-report-uuid' };

    mockCreate.mockResolvedValue(
      makeClaudeResponse(
        JSON.stringify({ content: SAMPLE_REPORT_MARKDOWN, summary: SAMPLE_SUMMARY }),
      ),
    );

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_interactions') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockInteractionsData, error: null }),
        };
      }
      if (table === 'saved_items') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockSavedItemsData, error: null }),
        };
      }
      if (table === 'interest_profile') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockProfileData, error: null }),
        };
      }
      if (table === 'keyword_contexts') {
        return {
          select: vi.fn().mockReturnThis(),
          gt: vi.fn().mockResolvedValue({ data: mockKeywordData, error: null }),
        };
      }
      if (table === 'score_history') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'monthly_reports') {
        return {
          insert: mockInsert,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });
  });

  it('INT-01: 인증된 cron 요청 시 200과 success:true를 반환한다', async () => {
    const { POST } = await import('@/app/api/cron/monthly-report/route');
    const response = await POST(makeCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('INT-02: cron secret 없으면 401을 반환한다', async () => {
    const { POST } = await import('@/app/api/cron/monthly-report/route');
    const request = new NextRequest('http://localhost/api/cron/monthly-report', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('INT-03: 응답에 report_month가 포함된다', async () => {
    const { POST } = await import('@/app/api/cron/monthly-report/route');
    const response = await POST(makeCronRequest());
    const body = await response.json();

    expect(body.data).toBeDefined();
    expect(typeof body.data.report_month).toBe('string');
    // YYYY-MM 형식 확인
    expect(body.data.report_month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('INT-04: monthly_reports 테이블에 삽입이 호출된다 (saveReport)', async () => {
    const { POST } = await import('@/app/api/cron/monthly-report/route');
    await POST(makeCronRequest());

    // monthly_reports 테이블에 insert가 호출되어야 함
    expect(mockInsert).toHaveBeenCalled();
    const insertedData = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedData.report_month).toBeDefined();
    expect(typeof insertedData.content).toBe('string');
    expect(typeof insertedData.summary).toBe('string');
  });

  it('INT-05: 텔레그램 sendMessage가 호출된다 (AC3)', async () => {
    const { POST } = await import('@/app/api/cron/monthly-report/route');
    await POST(makeCronRequest());

    expect(mockSendMessage).toHaveBeenCalled();
  });

  it('INT-06: ANTHROPIC_API_KEY 없으면 500을 반환한다', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const { POST } = await import('@/app/api/cron/monthly-report/route');
    const response = await POST(makeCronRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });

  it('INT-07: 텔레그램 발송 실패 시에도 리포트 저장은 완료된다', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('텔레그램 발송 실패'));

    const { POST } = await import('@/app/api/cron/monthly-report/route');
    const response = await POST(makeCronRequest());
    const body = await response.json();

    // 텔레그램 실패는 non-fatal → 200 응답
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // 리포트 저장은 완료되어야 함
    expect(mockInsert).toHaveBeenCalled();
  });

  it('INT-08: 응답에 telegram_sent 필드가 포함된다', async () => {
    const { POST } = await import('@/app/api/cron/monthly-report/route');
    const response = await POST(makeCronRequest());
    const body = await response.json();

    expect(typeof body.data.telegram_sent).toBe('boolean');
  });
});
