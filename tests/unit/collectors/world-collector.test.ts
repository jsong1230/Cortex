// F-02: WorldCollector 오케스트레이터 단위 테스트
// test-spec.md: WorldCollector 및 교차 소스 가중치, 카테고리 태그 섹션 참조

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CollectedItem } from '@/lib/collectors/types';

// rss 모킹
vi.mock('@/lib/collectors/rss', () => ({
  collectMultipleRssFeeds: vi.fn(),
  collectRssFeed: vi.fn(),
  RSS_FEEDS: [],
}));

import { WorldCollector } from '@/lib/collectors/world-collector';
import {
  scoreByCrossSourceAppearance,
  extractCategoryTag,
} from '@/lib/collectors/world-collector';
import { collectMultipleRssFeeds } from '@/lib/collectors/rss';

// CollectedItem fixture 생성 헬퍼
const makeWorldItem = (
  source: string,
  title: string,
  opts: Partial<CollectedItem> = {}
): CollectedItem => ({
  channel: 'world' as const,
  source,
  source_url: `https://example.com/${source}/${encodeURIComponent(title)}`,
  title,
  published_at: new Date('2026-02-28T09:00:00Z'),
  tags: [],
  ...opts,
});

describe('WorldCollector', () => {
  let collector: WorldCollector;

  beforeEach(() => {
    collector = new WorldCollector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('name, channel 속성', () => {
    it('이름이 world-collector이다', () => {
      expect(collector.name).toBe('world-collector');
    });

    it('채널이 world이다', () => {
      expect(collector.channel).toBe('world');
    });
  });

  describe('collect()', () => {
    it('7개 RSS 피드 모두 성공 시 items가 있고 errors는 빈 배열이다', async () => {
      // Arrange
      const mockItems = [
        makeWorldItem('naver_politics', '정치 뉴스 1'),
        makeWorldItem('naver_economy', '경제 뉴스 1'),
        makeWorldItem('naver_society', '사회 뉴스 1'),
        makeWorldItem('naver_it', 'IT 뉴스 1'),
        makeWorldItem('daum_news', '다음 뉴스 1'),
        makeWorldItem('yonhap', '연합뉴스 1'),
        makeWorldItem('bbc_korea', 'BBC Korea 1'),
      ];
      // collectMultipleRssFeeds는 RssCollectedItem을 반환하므로 변환 형태로 모킹
      vi.mocked(collectMultipleRssFeeds).mockResolvedValue(
        mockItems.map((item) => ({
          channel: item.channel,
          source: item.source,
          sourceUrl: item.source_url,
          title: item.title,
          publishedAt: item.published_at,
        })) as ReturnType<typeof collectMultipleRssFeeds> extends Promise<infer T> ? T : never
      );

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('일부 피드 실패 시 성공한 피드 데이터가 포함된다', async () => {
      // Arrange: 일부 피드만 반환 (나머지 실패)
      const mockItems = [
        makeWorldItem('naver_economy', '경제 뉴스 1'),
        makeWorldItem('daum_news', '다음 뉴스 1'),
      ];
      vi.mocked(collectMultipleRssFeeds).mockResolvedValue(
        mockItems.map((item) => ({
          channel: item.channel,
          source: item.source,
          sourceUrl: item.source_url,
          title: item.title,
          publishedAt: item.published_at,
        })) as ReturnType<typeof collectMultipleRssFeeds> extends Promise<infer T> ? T : never
      );

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('모든 피드 실패 시 빈 배열과 errors를 반환한다', async () => {
      // Arrange
      vi.mocked(collectMultipleRssFeeds).mockRejectedValue(new Error('모든 RSS 실패'));

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('모든 아이템의 channel이 world이다', async () => {
      // Arrange
      vi.mocked(collectMultipleRssFeeds).mockResolvedValue([
        { channel: 'world', source: 'naver_politics', sourceUrl: 'https://ex.com/1', title: '정치 뉴스' },
        { channel: 'world', source: 'daum_news', sourceUrl: 'https://ex.com/2', title: '다음 뉴스' },
      ] as ReturnType<typeof collectMultipleRssFeeds> extends Promise<infer T> ? T : never);

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items.every((item) => item.channel === 'world')).toBe(true);
    });

    it('source가 올바르게 매핑된다', async () => {
      // Arrange
      vi.mocked(collectMultipleRssFeeds).mockResolvedValue([
        { channel: 'world', source: 'naver_politics', sourceUrl: 'https://ex.com/1', title: '정치 뉴스' },
        { channel: 'world', source: 'daum_news', sourceUrl: 'https://ex.com/2', title: '다음 뉴스' },
      ] as ReturnType<typeof collectMultipleRssFeeds> extends Promise<infer T> ? T : never);

      // Act
      const result = await collector.collect();

      // Assert
      const sources = result.items.map((item) => item.source);
      expect(sources).toContain('naver_politics');
      expect(sources).toContain('daum_news');
    });

    it('naver_politics 소스 아이템에 politics 태그가 포함된다', async () => {
      // Arrange
      vi.mocked(collectMultipleRssFeeds).mockResolvedValue([
        { channel: 'world', source: 'naver_politics', sourceUrl: 'https://ex.com/1', title: '정치 뉴스' },
      ] as ReturnType<typeof collectMultipleRssFeeds> extends Promise<infer T> ? T : never);

      // Act
      const result = await collector.collect();

      // Assert
      const politicsItem = result.items.find((item) => item.source === 'naver_politics');
      expect(politicsItem?.tags).toContain('politics');
    });

    it('아이템이 200개이면 상위 15개 이하로 선별된다', async () => {
      // Arrange: 200개 아이템
      const manyItems = Array.from({ length: 200 }, (_, i) => ({
        channel: 'world' as const,
        source: 'naver_politics',
        sourceUrl: `https://ex.com/${i}`,
        title: `뉴스 ${i}`,
      }));
      vi.mocked(collectMultipleRssFeeds).mockResolvedValue(
        manyItems as ReturnType<typeof collectMultipleRssFeeds> extends Promise<infer T> ? T : never
      );

      // Act
      const result = await collector.collect();

      // Assert
      expect(result.items.length).toBeLessThanOrEqual(15);
    });
  });
});

describe('scoreByCrossSourceAppearance', () => {
  it('동일 이슈가 3개 소스에서 등장 시 crossSourceScore가 3 이상이다', () => {
    // Arrange: 동일 이슈 제목이 3개 소스에서 등장
    const items: CollectedItem[] = [
      makeWorldItem('naver_politics', '윤 대통령 탄핵 가결'),
      makeWorldItem('daum_news', '윤 대통령 탄핵 가결'),
      makeWorldItem('yonhap', '윤 대통령 탄핵 가결'),
    ];

    // Act
    const result = scoreByCrossSourceAppearance(items);

    // Assert: 교차 소스 점수 >= 3
    const maxScore = Math.max(...result.map((s) => s.crossSourceScore));
    expect(maxScore).toBeGreaterThanOrEqual(3);
  });

  it('단일 소스 이슈의 crossSourceScore는 1이다', () => {
    // Arrange: 유일한 이슈 1개
    const items: CollectedItem[] = [
      makeWorldItem('naver_politics', '특정 이슈 단독 보도'),
    ];

    // Act
    const result = scoreByCrossSourceAppearance(items);

    // Assert
    expect(result[0].crossSourceScore).toBe(1);
  });

  it('유사 제목은 동일 이슈로 판정한다', () => {
    // Arrange: 키워드 교집합 > 0.5인 제목
    const items: CollectedItem[] = [
      makeWorldItem('naver_economy', '삼성전자 반도체 투자 확대'),
      makeWorldItem('daum_news', '삼성전자 반도체 투자 20조'),
    ];

    // Act
    const result = scoreByCrossSourceAppearance(items);

    // Assert: 두 아이템이 동일 이슈로 묶여 점수 >= 2
    const maxScore = Math.max(...result.map((s) => s.crossSourceScore));
    expect(maxScore).toBeGreaterThanOrEqual(2);
  });

  it('완전히 다른 제목은 다른 이슈로 판정한다', () => {
    // Arrange
    const items: CollectedItem[] = [
      makeWorldItem('naver_politics', '기후변화 대응'),
      makeWorldItem('daum_news', '프로야구 개막'),
    ];

    // Act
    const result = scoreByCrossSourceAppearance(items);

    // Assert: 교집합 없으므로 각각 score === 1
    expect(result.every((s) => s.crossSourceScore === 1)).toBe(true);
  });

  it('교차 소스 점수 내림차순으로 정렬된다', () => {
    // Arrange: 서로 다른 crossSourceScore를 가진 아이템
    const items: CollectedItem[] = [
      makeWorldItem('source1', '단일 이슈'),
      makeWorldItem('naver_politics', '공통 이슈 키워드'),
      makeWorldItem('daum_news', '공통 이슈 키워드'),
      makeWorldItem('yonhap', '공통 이슈 키워드'),
    ];

    // Act
    const result = scoreByCrossSourceAppearance(items);

    // Assert: 정렬 확인
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].crossSourceScore).toBeGreaterThanOrEqual(result[i + 1].crossSourceScore);
    }
  });

  it('동일 점수 시 최신 published_at 우선으로 정렬된다', () => {
    // Arrange: 동일 점수, 다른 날짜
    const items: CollectedItem[] = [
      makeWorldItem('source1', '이슈 A', { published_at: new Date('2026-02-27T09:00:00Z') }),
      makeWorldItem('source2', '이슈 B', { published_at: new Date('2026-02-28T09:00:00Z') }),
    ];

    // Act
    const result = scoreByCrossSourceAppearance(items);

    // Assert: 더 최신인 2026-02-28이 먼저
    if (result[0].crossSourceScore === result[1].crossSourceScore) {
      expect(result[0].item.published_at!.getTime()).toBeGreaterThanOrEqual(
        result[1].item.published_at!.getTime()
      );
    }
  });

  it('빈 배열 입력 시 빈 배열을 반환한다', () => {
    // Act
    const result = scoreByCrossSourceAppearance([]);

    // Assert
    expect(result).toHaveLength(0);
  });

  it('단일 아이템 입력 시 crossSourceScore === 1로 반환한다', () => {
    // Arrange
    const items: CollectedItem[] = [makeWorldItem('source1', '단일 아이템')];

    // Act
    const result = scoreByCrossSourceAppearance(items);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].crossSourceScore).toBe(1);
  });
});

describe('extractCategoryTag', () => {
  it('naver_politics -> politics 태그를 반환한다', () => {
    expect(extractCategoryTag('naver_politics')).toEqual(['politics']);
  });

  it('naver_economy -> economy 태그를 반환한다', () => {
    expect(extractCategoryTag('naver_economy')).toEqual(['economy']);
  });

  it('naver_society -> society 태그를 반환한다', () => {
    expect(extractCategoryTag('naver_society')).toEqual(['society']);
  });

  it('naver_it -> it_science 태그를 반환한다', () => {
    expect(extractCategoryTag('naver_it')).toEqual(['it_science']);
  });

  it('daum_news -> general 태그를 반환한다', () => {
    expect(extractCategoryTag('daum_news')).toEqual(['general']);
  });

  it('yonhap -> general 태그를 반환한다', () => {
    expect(extractCategoryTag('yonhap')).toEqual(['general']);
  });

  it('bbc_korea -> international 태그를 반환한다', () => {
    expect(extractCategoryTag('bbc_korea')).toEqual(['international']);
  });

  it('미등록 소스 -> 빈 배열을 반환한다', () => {
    expect(extractCategoryTag('unknown_source')).toEqual([]);
  });
});

describe('collectMultipleRssFeeds WORLD 연동', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('WORLD 피드 설정 7개를 전달하면 7개 피드를 병렬 호출한다', async () => {
    // Arrange
    vi.mocked(collectMultipleRssFeeds).mockResolvedValue([]);

    const collector = new WorldCollector();
    await collector.collect();

    // Assert: collectMultipleRssFeeds가 7개 설정으로 호출됨
    expect(vi.mocked(collectMultipleRssFeeds)).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ source: 'naver_politics' }),
        expect.objectContaining({ source: 'naver_economy' }),
        expect.objectContaining({ source: 'naver_society' }),
        expect.objectContaining({ source: 'naver_it' }),
        expect.objectContaining({ source: 'daum_news' }),
        expect.objectContaining({ source: 'yonhap' }),
        expect.objectContaining({ source: 'bbc_korea' }),
      ])
    );
  });

  it('네이버 정치 RSS는 limit 20으로 설정된다', async () => {
    // Arrange
    vi.mocked(collectMultipleRssFeeds).mockResolvedValue([]);

    const collector = new WorldCollector();
    await collector.collect();

    // Assert
    expect(vi.mocked(collectMultipleRssFeeds)).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ source: 'naver_politics', limit: 20 }),
      ])
    );
  });

  it('다음 뉴스 RSS는 limit 50으로 설정된다', async () => {
    // Arrange
    vi.mocked(collectMultipleRssFeeds).mockResolvedValue([]);

    const collector = new WorldCollector();
    await collector.collect();

    // Assert
    expect(vi.mocked(collectMultipleRssFeeds)).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ source: 'daum_news', limit: 50 }),
      ])
    );
  });

  it('연합뉴스 RSS는 limit 100으로 설정된다', async () => {
    // Arrange
    vi.mocked(collectMultipleRssFeeds).mockResolvedValue([]);

    const collector = new WorldCollector();
    await collector.collect();

    // Assert
    expect(vi.mocked(collectMultipleRssFeeds)).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ source: 'yonhap', limit: 100 }),
      ])
    );
  });
});
