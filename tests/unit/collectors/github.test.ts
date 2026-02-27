// F-01: GitHub Trending 수집기 단위 테스트
// test-spec.md: GitHub Trending 수집기 섹션 참조

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectGitHubTrending } from '@/lib/collectors/github';

// GitHub Trending HTML fixture 생성 헬퍼
function makeTrendingHTML(count: number): string {
  const articles = Array.from({ length: count }, (_, i) => `
    <article class="Box-row">
      <h2 class="h3 lh-condensed">
        <a href="/owner${i}/repo${i}">owner${i}/repo${i}</a>
      </h2>
      <p class="col-9 color-fg-muted my-1 pr-4">
        Description for repo ${i}
      </p>
      <span itemprop="programmingLanguage">TypeScript</span>
    </article>
  `).join('');
  return `<html><body>${articles}</body></html>`;
}

function makeEmptyHTML(): string {
  return '<html><body><div>No trending repos</div></body></html>';
}

describe('collectGitHubTrending', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('정상 HTML 파싱 시 최대 20개를 반환한다', async () => {
    // Arrange: 25개 article.Box-row가 있는 HTML
    const html = makeTrendingHTML(25);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.length).toBeGreaterThan(0);
  });

  it('모든 아이템의 channel이 tech이다', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(makeTrendingHTML(5)),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result.every((item) => item.channel === 'tech')).toBe(true);
  });

  it('모든 아이템의 source가 github_trending이다', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(makeTrendingHTML(5)),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result.every((item) => item.source === 'github_trending')).toBe(true);
  });

  it('source_url은 https://github.com/owner/repo 형식이다', async () => {
    // Arrange: 특정 리포 경로를 가진 HTML
    const html = `
      <html><body>
        <article class="Box-row">
          <h2><a href="/owner/repo">owner/repo</a></h2>
          <p>A test tool</p>
          <span itemprop="programmingLanguage">TypeScript</span>
        </article>
      </body></html>
    `;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result[0].source_url).toBe('https://github.com/owner/repo');
  });

  it('title은 owner/repo: description 형식이다', async () => {
    // Arrange
    const html = `
      <html><body>
        <article class="Box-row">
          <h2><a href="/owner/repo">owner/repo</a></h2>
          <p>A tool</p>
          <span itemprop="programmingLanguage">TypeScript</span>
        </article>
      </body></html>
    `;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result[0].title).toBe('owner/repo: A tool');
  });

  it('설명이 없는 리포의 title에는 설명 없음이 포함된다', async () => {
    // Arrange: description이 빈 문자열인 HTML
    const html = `
      <html><body>
        <article class="Box-row">
          <h2><a href="/owner/repo">owner/repo</a></h2>
          <p></p>
          <span itemprop="programmingLanguage">TypeScript</span>
        </article>
      </body></html>
    `;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result[0].title).toBe('owner/repo: (설명 없음)');
  });

  it('언어 태그를 추출한다', async () => {
    // Arrange
    const html = `
      <html><body>
        <article class="Box-row">
          <h2><a href="/owner/repo">owner/repo</a></h2>
          <p>desc</p>
          <span itemprop="programmingLanguage">TypeScript</span>
        </article>
      </body></html>
    `;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result[0].tags).toEqual(['TypeScript']);
  });

  it('언어가 없는 리포의 tags는 빈 배열이다', async () => {
    // Arrange: language 없는 HTML
    const html = `
      <html><body>
        <article class="Box-row">
          <h2><a href="/owner/repo">owner/repo</a></h2>
          <p>desc</p>
        </article>
      </body></html>
    `;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result[0].tags).toEqual([]);
  });

  it('HTTP 오류 시 에러를 throw한다', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }));

    // Act & Assert
    await expect(collectGitHubTrending()).rejects.toThrow();
  });

  it('HTML 구조 변경으로 셀렉터가 매칭되지 않을 때 빈 배열을 반환한다', async () => {
    // Arrange: article.Box-row 태그가 없는 HTML
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(makeEmptyHTML()),
    }));

    // Act
    const result = await collectGitHubTrending();

    // Assert
    expect(result).toHaveLength(0);
  });
});
