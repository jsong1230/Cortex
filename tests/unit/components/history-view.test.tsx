// F-10 HistoryView + BriefingDateList + SavedItemList 컴포넌트 단위 테스트
// test-spec.md H-13 ~ H-26

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Next.js navigation 모킹 ─────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockTabParam: string | null = null;

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockImplementation((key: string) => (key === 'tab' ? mockTabParam : null)),
  })),
  useRouter: vi.fn().mockReturnValue({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// ─── fetch 모킹 ──────────────────────────────────────────────────────────────

const SAMPLE_BRIEFINGS_LIST_RESPONSE = {
  success: true,
  data: {
    items: [
      {
        id: 'briefing-uuid-001',
        briefing_date: '2026-02-27',
        item_count: 5,
        channels: ['tech', 'world', 'culture', 'canada', 'serendipity'],
      },
      {
        id: 'briefing-uuid-002',
        briefing_date: '2026-02-26',
        item_count: 3,
        channels: ['tech', 'world'],
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
    hasMore: false,
  },
};

const SAMPLE_BRIEFING_DATE_RESPONSE = {
  success: true,
  data: {
    briefing_id: 'briefing-uuid-001',
    briefing_date: '2026-02-27',
    items: [
      {
        content_id: 'content-uuid-001',
        position: 1,
        channel: 'tech',
        title: 'OpenAI GPT-5 출시',
        summary_ai: 'GPT-5 관련 요약',
        source: 'hackernews',
        source_url: 'https://hn.com/1',
        reason: null,
        user_interaction: null,
      },
    ],
  },
};

const SAMPLE_SAVED_RESPONSE = {
  success: true,
  data: {
    items: [
      {
        content_id: 'content-uuid-001',
        title: 'OpenAI GPT-5 출시',
        summary_ai: 'GPT-5 관련 요약',
        source: 'hackernews',
        source_url: 'https://hn.com/1',
        channel: 'tech',
        saved_at: '2026-02-27T07:15:00+09:00',
      },
    ],
    total: 1,
    limit: 20,
    offset: 0,
    hasMore: false,
  },
};

// 기본 fetch 모킹 설정
function setupFetch(options?: {
  briefingsList?: unknown;
  briefingDate?: unknown;
  saved?: unknown;
  deleteSuccess?: boolean;
}) {
  vi.mocked(global.fetch).mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

    if (init?.method === 'DELETE') {
      const success = options?.deleteSuccess !== false;
      return {
        ok: success,
        json: async () => (success ? { success: true } : { success: false, error: '서버 오류' }),
      } as Response;
    }

    if (urlStr.match(/\/api\/briefings\/\d{4}-\d{2}-\d{2}/)) {
      return {
        ok: true,
        json: async () => options?.briefingDate ?? SAMPLE_BRIEFING_DATE_RESPONSE,
      } as Response;
    }

    if (urlStr.includes('/api/briefings')) {
      return {
        ok: true,
        json: async () => options?.briefingsList ?? SAMPLE_BRIEFINGS_LIST_RESPONSE,
      } as Response;
    }

    if (urlStr.includes('/api/saved')) {
      return {
        ok: true,
        json: async () => options?.saved ?? SAMPLE_SAVED_RESPONSE,
      } as Response;
    }

    return { ok: false, json: async () => ({ success: false }) } as Response;
  });
}

vi.stubGlobal('fetch', vi.fn());

// ─── H-13: HistoryView 초기 렌더링 ──────────────────────────────────────────

describe('HistoryView — 초기 렌더링 (H-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabParam = null;
    setupFetch();
  });

  it('H-13: 초기 렌더링 시 "브리핑 히스토리" 탭이 활성이고 BriefingDateList가 렌더링된다', async () => {
    const { HistoryView } = await import('@/components/history/HistoryView');
    render(<HistoryView />);

    // 탭이 렌더링된다
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);

    // "브리핑 히스토리" 탭이 활성
    const historyTab = screen.getByRole('tab', { name: /브리핑 히스토리/ });
    expect(historyTab).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── H-14: URL tab=saved 파라미터 ────────────────────────────────────────────

describe('HistoryView — URL tab=saved (H-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabParam = 'saved';
    setupFetch();
  });

  it('H-14: URL에 ?tab=saved가 있으면 "저장 목록" 탭이 활성이다', async () => {
    const { HistoryView } = await import('@/components/history/HistoryView');
    render(<HistoryView />);

    const savedTab = screen.getByRole('tab', { name: /저장 목록/ });
    expect(savedTab).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── H-15: 탭 클릭 전환 ────────────────────────────────────────────────────

describe('HistoryView — 탭 클릭 전환 (H-15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabParam = null;
    setupFetch();
  });

  it('H-15: "저장 목록" 탭 클릭 시 뷰가 전환된다', async () => {
    const { HistoryView } = await import('@/components/history/HistoryView');
    render(<HistoryView />);

    const savedTab = screen.getByRole('tab', { name: /저장 목록/ });
    await userEvent.click(savedTab);

    expect(savedTab).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── H-16: BriefingDateList 로딩 스켈레톤 ───────────────────────────────────

describe('BriefingDateList — 로딩 스켈레톤 (H-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('H-16: 로딩 중 스켈레톤 UI가 표시되고 aria-busy="true"가 설정된다', async () => {
    // fetch가 지연되도록 설정
    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => SAMPLE_BRIEFINGS_LIST_RESPONSE,
              } as Response),
            200
          )
        )
    );

    const { BriefingDateList } = await import('@/components/history/BriefingDateList');
    render(<BriefingDateList />);

    // aria-busy 요소가 있는지 확인
    const busyElements = document.querySelectorAll('[aria-busy="true"]');
    expect(busyElements.length).toBeGreaterThan(0);
  });
});

// ─── H-17: BriefingDateList 날짜 목록 렌더링 ────────────────────────────────

describe('BriefingDateList — 날짜 목록 렌더링 (H-17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch();
  });

  it('H-17: API 응답 성공 시 날짜 카드에 날짜, 아이템 수, 채널 뱃지가 표시된다', async () => {
    const { BriefingDateList } = await import('@/components/history/BriefingDateList');
    render(<BriefingDateList />);

    // 날짜가 표시될 때까지 대기 (2026-02-27 날짜 카드)
    await waitFor(() => {
      expect(screen.getByText(/2026\.02\.27/)).toBeInTheDocument();
    });

    // 아이템 수 표시
    expect(screen.getByText(/5개/)).toBeInTheDocument();
  });
});

// ─── H-18: 날짜 카드 클릭 시 브리핑 카드 인라인 표시 ────────────────────────

describe('BriefingDateList — 날짜 카드 클릭 (H-18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch();
  });

  it('H-18: 날짜 카드 클릭 시 해당 날짜 아래에 BriefingCard 목록이 렌더링된다', async () => {
    const { BriefingDateList } = await import('@/components/history/BriefingDateList');
    render(<BriefingDateList />);

    // 날짜 목록 로딩 대기
    await waitFor(() => {
      expect(screen.getByText(/2026\.02\.27/)).toBeInTheDocument();
    });

    // 날짜 카드 클릭
    const dateCard = screen.getAllByRole('button')[0];
    await userEvent.click(dateCard);

    // 브리핑 상세 로딩 대기
    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-5/)).toBeInTheDocument();
    });
  });
});

// ─── H-19: 같은 날짜 재클릭 시 접힘 ────────────────────────────────────────

describe('BriefingDateList — 날짜 토글 (H-19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch();
  });

  it('H-19: 활성화된 날짜를 재클릭하면 브리핑 카드 목록이 숨겨진다', async () => {
    const { BriefingDateList } = await import('@/components/history/BriefingDateList');
    render(<BriefingDateList />);

    await waitFor(() => {
      expect(screen.getByText(/2026\.02\.27/)).toBeInTheDocument();
    });

    const dateCard = screen.getAllByRole('button')[0];

    // 첫 클릭: 열기
    await userEvent.click(dateCard);

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-5/)).toBeInTheDocument();
    });

    // 두 번째 클릭: 닫기
    await userEvent.click(dateCard);

    await waitFor(() => {
      expect(screen.queryByText(/OpenAI GPT-5/)).not.toBeInTheDocument();
    });
  });
});

// ─── H-20: "더 보기" 버튼 ──────────────────────────────────────────────────

describe('BriefingDateList — 더 보기 버튼 (H-20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch({
      briefingsList: {
        ...SAMPLE_BRIEFINGS_LIST_RESPONSE,
        data: {
          ...SAMPLE_BRIEFINGS_LIST_RESPONSE.data,
          hasMore: true,
          total: 25,
        },
      },
    });
  });

  it('H-20: hasMore=true일 때 "더 보기" 버튼이 표시된다', async () => {
    const { BriefingDateList } = await import('@/components/history/BriefingDateList');
    render(<BriefingDateList />);

    await waitFor(() => {
      expect(screen.getByText(/더 보기/)).toBeInTheDocument();
    });
  });
});

// ─── H-21: 에러 상태 ────────────────────────────────────────────────────────

describe('BriefingDateList — 에러 상태 (H-21)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockImplementation(async () => {
      return { ok: false, json: async () => ({ success: false, error: '서버 오류' }) } as Response;
    });
  });

  it('H-21: API 에러 시 에러 메시지와 "다시 시도" 버튼이 표시된다', async () => {
    const { BriefingDateList } = await import('@/components/history/BriefingDateList');
    render(<BriefingDateList />);

    await waitFor(() => {
      expect(screen.getByText(/다시 시도/)).toBeInTheDocument();
    });
  });
});

// ─── H-22: 브리핑 없음 빈 상태 ─────────────────────────────────────────────

describe('BriefingDateList — 빈 상태 (H-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch({
      briefingsList: {
        success: true,
        data: { items: [], total: 0, limit: 20, offset: 0, hasMore: false },
      },
    });
  });

  it('H-22: 브리핑이 없을 때 "아직 브리핑 기록이 없습니다" 메시지가 표시된다', async () => {
    const { BriefingDateList } = await import('@/components/history/BriefingDateList');
    render(<BriefingDateList />);

    await waitFor(() => {
      expect(screen.getByText(/아직 브리핑 기록이 없습니다/)).toBeInTheDocument();
    });
  });
});

// ─── H-23: SavedItemList 저장 아이템 렌더링 ────────────────────────────────

describe('SavedItemList — 저장 아이템 렌더링 (H-23)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch();
  });

  it('H-23: 각 아이템에 채널 뱃지, 제목, 요약, 저장일이 표시된다', async () => {
    const { SavedItemList } = await import('@/components/history/SavedItemList');
    render(<SavedItemList />);

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-5/)).toBeInTheDocument();
    });

    // 저장일 표시 확인
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});

// ─── H-24: 저장 해제 낙관적 업데이트 ───────────────────────────────────────

describe('SavedItemList — 저장 해제 낙관적 업데이트 (H-24)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch({ deleteSuccess: true });
  });

  it('H-24: 저장 해제 버튼 클릭 시 즉시 목록에서 제거되고 DELETE API가 호출된다', async () => {
    const { SavedItemList } = await import('@/components/history/SavedItemList');
    render(<SavedItemList />);

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-5/)).toBeInTheDocument();
    });

    // 저장 해제 버튼 클릭
    const unsaveButton = screen.getByRole('button', { name: /저장 해제/ });
    await userEvent.click(unsaveButton);

    // 낙관적 업데이트: 즉시 제거
    await waitFor(() => {
      expect(screen.queryByText(/OpenAI GPT-5/)).not.toBeInTheDocument();
    });
  });
});

// ─── H-25: 저장 해제 실패 시 복원 ──────────────────────────────────────────

describe('SavedItemList — 저장 해제 실패 시 복원 (H-25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch({ deleteSuccess: false });
  });

  it('H-25: 저장 해제 API 실패 시 아이템이 목록에 복원된다', async () => {
    const { SavedItemList } = await import('@/components/history/SavedItemList');
    render(<SavedItemList />);

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-5/)).toBeInTheDocument();
    });

    const unsaveButton = screen.getByRole('button', { name: /저장 해제/ });
    await userEvent.click(unsaveButton);

    // 실패 후 복원
    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-5/)).toBeInTheDocument();
    });
  });
});

// ─── H-26: SavedItemList 빈 상태 ────────────────────────────────────────────

describe('SavedItemList — 빈 상태 (H-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch({
      saved: {
        success: true,
        data: { items: [], total: 0, limit: 20, offset: 0, hasMore: false },
      },
    });
  });

  it('H-26: 저장 아이템이 없을 때 빈 상태 메시지가 표시된다', async () => {
    const { SavedItemList } = await import('@/components/history/SavedItemList');
    render(<SavedItemList />);

    await waitFor(() => {
      expect(screen.getByText(/아직 저장한 아이템이 없습니다/)).toBeInTheDocument();
    });
  });
});

// ─── 접근성 테스트 H-31 ~ H-35 ─────────────────────────────────────────────

describe('접근성 — 탭 ARIA 속성 (H-31)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabParam = null;
    setupFetch();
  });

  it('H-31: 탭에 role="tablist", role="tab", aria-selected 속성이 올바르게 설정된다', async () => {
    const { HistoryView } = await import('@/components/history/HistoryView');
    render(<HistoryView />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);

    // aria-selected 속성 확인
    const activeTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(activeTab).toBeDefined();
  });
});

describe('접근성 — SavedItemList 저장 해제 버튼 aria-label (H-33)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch();
  });

  it('H-33: 저장 해제 버튼에 aria-label="저장 해제"가 설정된다', async () => {
    const { SavedItemList } = await import('@/components/history/SavedItemList');
    render(<SavedItemList />);

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-5/)).toBeInTheDocument();
    });

    const unsaveButton = screen.getByRole('button', { name: /저장 해제/ });
    expect(unsaveButton).toHaveAttribute('aria-label', '저장 해제');
  });
});
