# F-01: TECH 채널 수집 -- 테스트 명세

## 참조
- 설계서: `docs/specs/F-01-tech-collector/design.md`
- 인수조건: `docs/project/features.md` #F-01
- 공통 타입: `lib/collectors/types.ts`

---

## 단위 테스트

### 공통 타입/유틸리티 (`lib/collectors/types.ts`, `lib/collectors/utils.ts`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `safeCollect` | 정상 실행 시 items 반환 | 성공하는 함수 | `{ items: [...], error: undefined }` |
| `safeCollect` | 함수 throw 시 빈 배열 + error 반환 | throw하는 함수 | `{ items: [], error: { source, message, timestamp } }` |
| `safeCollect` | 비동기 reject 시 빈 배열 + error 반환 | reject하는 Promise | `{ items: [], error: { ... } }` |

### Hacker News 수집기 (`lib/collectors/hackernews.ts`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectHackerNews` | 정상 응답 시 상위 10개 반환 | mock: topstories 50개 ID + 개별 아이템 | `CollectedItem[]` 길이 10, 스코어 내림차순 |
| `collectHackerNews` | 모든 아이템의 channel이 'tech' | 정상 mock 데이터 | 모든 item.channel === 'tech' |
| `collectHackerNews` | 모든 아이템의 source가 'hackernews' | 정상 mock 데이터 | 모든 item.source === 'hackernews' |
| `collectHackerNews` | url이 있는 아이템의 source_url | mock: `{ url: 'https://example.com' }` | `source_url === 'https://example.com'` |
| `collectHackerNews` | url이 없는 아이템의 source_url | mock: `{ id: 12345, url: undefined }` | `source_url === 'https://news.ycombinator.com/item?id=12345'` |
| `collectHackerNews` | published_at 변환 정확성 | mock: `{ time: 1709078400 }` | `published_at === new Date(1709078400 * 1000)` |
| `collectHackerNews` | title/url 없는 아이템 필터링 | mock: title이 null인 아이템 포함 | 해당 아이템 제외 |
| `collectHackerNews` | topstories API 실패 시 throw | mock: fetch 500 응답 | Error throw (safeCollect에서 잡힘) |
| `collectHackerNews` | 개별 아이템 fetch 실패 시 해당 건만 제외 | mock: 50개 중 5개 실패 | 성공한 45개에서 상위 10개 선별 |

### GitHub Trending 수집기 (`lib/collectors/github.ts`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectGitHubTrending` | 정상 HTML 파싱 시 최대 20개 반환 | mock: trending HTML (article.Box-row 25개) | `CollectedItem[]` 길이 20 |
| `collectGitHubTrending` | 모든 아이템의 channel이 'tech' | 정상 mock HTML | 모든 item.channel === 'tech' |
| `collectGitHubTrending` | 모든 아이템의 source가 'github_trending' | 정상 mock HTML | 모든 item.source === 'github_trending' |
| `collectGitHubTrending` | source_url 형식 | mock: repoPath='/owner/repo' | `source_url === 'https://github.com/owner/repo'` |
| `collectGitHubTrending` | title 형식 | mock: owner/repo, description='A tool' | `title === 'owner/repo: A tool'` |
| `collectGitHubTrending` | 설명 없는 리포 처리 | mock: description 빈 문자열 | `title === 'owner/repo: (설명 없음)'` |
| `collectGitHubTrending` | 언어 태그 추출 | mock: language='TypeScript' | `tags === ['TypeScript']` |
| `collectGitHubTrending` | 언어 없는 리포 처리 | mock: language 없음 | `tags === []` |
| `collectGitHubTrending` | HTTP 오류 시 throw | mock: fetch 503 응답 | Error throw |
| `collectGitHubTrending` | HTML 구조 변경 (셀렉터 미매칭) 시 빈 배열 | mock: article 태그 없는 HTML | `CollectedItem[]` 길이 0 |

### RSS 수집기 (`lib/collectors/rss.ts`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectRssFeed` | 정상 RSS 파싱 | mock: 유효한 RSS XML | `RssCollectedItem[]` 반환 |
| `collectRssFeed` | limit 적용 | config: `{ limit: 5 }`, mock: 20개 아이템 | 길이 5 |
| `collectRssFeed` | link/title 없는 아이템 필터링 | mock: link null인 아이템 포함 | 해당 아이템 제외 |
| `collectRssFeed` | pubDate 파싱 | mock: `pubDate: 'Mon, 28 Feb 2026 ...'` | 유효한 Date 객체 |
| `collectRssFeed` | pubDate 없는 아이템 | mock: pubDate 없음 | `published_at === undefined` |
| `collectMultipleRssFeeds` | 모든 피드 성공 | mock: 3개 피드 성공 | 3개 피드 아이템 합산 |
| `collectMultipleRssFeeds` | 일부 피드 실패 | mock: 3개 중 1개 실패 | 성공 2개 피드 아이템 + console.error 호출 |
| `collectMultipleRssFeeds` | 모든 피드 실패 | mock: 3개 모두 실패 | 빈 배열 + console.error 3회 |

### TechCollector 오케스트레이터 (`lib/collectors/tech-collector.ts`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `TechCollector.collect` | 3개 소스 모두 성공 | mock: HN 10개 + GitHub 20개 + RSS 5개 | `items.length === 35`, `errors.length === 0` |
| `TechCollector.collect` | HN 실패, 나머지 성공 | mock: HN throw, GitHub 20개, RSS 5개 | `items.length === 25`, `errors.length === 1` |
| `TechCollector.collect` | GitHub 실패, 나머지 성공 | mock: GitHub throw, HN 10개, RSS 5개 | `items.length === 15`, `errors.length === 1` |
| `TechCollector.collect` | 3개 소스 모두 실패 | mock: 3개 모두 throw | `items.length === 0`, `errors.length === 3` |
| `TechCollector.collect` | channel이 항상 'tech' | mock: 정상 데이터 | 모든 item.channel === 'tech' |
| `TechCollector.collect` | 병렬 실행 확인 | mock: 각 소스 100ms 지연 | 전체 소요 시간 ~100ms (300ms 아님) |
| `TechCollector.name` | 이름 확인 | - | `'tech-collector'` |
| `TechCollector.channel` | 채널 확인 | - | `'tech'` |

---

## 통합 테스트

### Supabase content_items 저장

| API | 시나리오 | 입력 | 예상 결과 |
|-----|----------|------|-----------|
| DB 저장 | 수집 결과 content_items 저장 | CollectedItem 10개 | content_items 10행 추가, channel='tech' |
| DB 저장 | source_url UNIQUE 중복 방지 | 동일 source_url 2번 저장 시도 | 1행만 존재 (upsert ignoreDuplicates) |
| DB 저장 | summary_ai는 NULL | 수집 직후 | summary_ai IS NULL (F-05에서 채워짐) |
| DB 저장 | collected_at 자동 설정 | 수집 직후 | collected_at IS NOT NULL, 현재 시각 근처 |
| DB 저장 | tags 배열 저장 | `tags: ['TypeScript', 'React']` | PostgreSQL TEXT[] 정상 저장 |

---

## 경계 조건 / 에러 케이스

### Hacker News
- Top Stories가 50개 미만일 때 (예: API가 30개만 반환) -> 30개에서 10개 선별
- Top Stories가 0개일 때 -> 빈 배열 반환 (에러 아님)
- 개별 아이템 score가 0인 경우 -> 정상 처리 (정렬 후 포함 가능)
- 동시에 50개 fetch 시 네트워크 부하 -> `Promise.allSettled`로 개별 실패 허용

### GitHub Trending
- HTML 구조 변경 (cheerio 셀렉터 미매칭) -> 빈 배열 + 에러 로깅
- 429 Too Many Requests -> throw + safeCollect에서 처리
- 리포지토리 경로에 특수문자 포함 -> URL 인코딩 불필요 (GitHub URL은 안전)

### RSS
- RSS URL이 유효하지 않을 때 -> 해당 피드만 실패, 다른 피드 계속
- RSS 응답이 비정상 XML일 때 -> rss-parser가 throw, safeCollect에서 처리
- 사용자 정의 RSS가 0개일 때 -> RSS 수집 스킵 (에러 아님)
- 피드 아이템 내용이 HTML 엔티티를 포함할 때 -> rss-parser가 자동 디코딩

### 공통
- 모든 소스가 동시에 실패할 때 -> `CollectorResult.items` 빈 배열, `errors`에 3개 기록. Cron 응답의 `errors`에 포함
- Vercel 함수 타임아웃 (60초) 접근 시 -> 개별 fetch에 10초 타임아웃 설정으로 예방

---

## 모킹 전략

### 외부 API 모킹 대상

| 소스 | 모킹 대상 | 방법 |
|------|-----------|------|
| Hacker News | `global.fetch` | msw 또는 jest.fn()으로 fetch 모킹 |
| GitHub Trending | `global.fetch` | HTML 응답 문자열을 fixture로 준비 |
| RSS | `rss-parser` | `Parser.prototype.parseURL` 모킹 |
| Supabase | `@supabase/supabase-js` | Supabase client 메서드 모킹 |

### fixture 파일 목록

```
__tests__/fixtures/
  hackernews/
    topstories.json       # [1, 2, 3, ..., 50] ID 배열
    item-high-score.json  # score: 500, url 있음
    item-no-url.json      # score: 300, url 없음
    item-no-title.json    # title: null (필터링 대상)
  github/
    trending.html         # 25개 article.Box-row 포함
    trending-empty.html   # 빈 페이지 (구조 변경 시뮬레이션)
  rss/
    valid-feed.xml        # 정상 RSS 2.0 피드
    invalid-feed.xml      # 비정상 XML
```
