# F-01~F-04 채널 수집기 — 내부 API 스펙 확정본

## 개요

F-01(TECH), F-02(WORLD), F-03(CULTURE), F-04(TORONTO) 4개 채널의 콘텐츠 수집기 라이브러리 인터페이스 문서.

---

## 1. 공통 타입 (`lib/collectors/types.ts`)

```typescript
type Channel = 'tech' | 'world' | 'culture' | 'canada';

interface CollectedItem {
  channel: Channel;
  source: string;         // 'hackernews' | 'github_trending' | 'naver_politics' | ...
  source_url: string;     // content_items.source_url에 매핑 (UNIQUE 제약)
  title: string;
  full_text?: string;     // 본문 또는 요약 텍스트
  published_at?: Date;    // 원본 발행 시간
  tags?: string[];        // 소스 레벨 태그 (언어, 카테고리 등)
}

interface CollectorError {
  source: string;         // 실패한 소스명
  message: string;        // 에러 메시지
  timestamp: Date;        // 에러 발생 시각
}

interface CollectorResult {
  channel: Channel;
  items: CollectedItem[];
  errors: CollectorError[];
}

interface ContentCollector {
  name: string;           // 수집기 식별자 (로깅용)
  channel: Channel;
  collect(): Promise<CollectorResult>;
}
```

---

## 2. F-01: TECH 수집기

### 2.1 `collectHackerNews()` — `lib/collectors/hackernews.ts`

```typescript
export async function collectHackerNews(): Promise<CollectedItem[]>
```

- **소스**: HN Firebase API (`https://hacker-news.firebaseio.com/v0/`)
- **channel**: `'tech'`
- **source**: `'hackernews'`
- **제한**: 상위 30개 스토리, 점수 기준 정렬
- **에러**: API 조회 실패 시 throw

### 2.2 `collectGitHubTrending()` — `lib/collectors/github.ts`

```typescript
export async function collectGitHubTrending(): Promise<CollectedItem[]>
```

- **소스**: GitHub Trending 페이지 (`https://github.com/trending`)
- **channel**: `'tech'`
- **source**: `'github_trending'`
- **제한**: 상위 20개 리포지토리
- **title 형식**: `owner/repo: description`
- **tags**: 프로그래밍 언어 (있는 경우)
- **에러**: HTTP 오류 시 throw, HTML 구조 변경 시 빈 배열

### 2.3 RSS 함수 — `lib/collectors/rss.ts`

```typescript
export interface RssFeedConfig {
  url: string;
  source: string;
  channel: RssChannel;
  limit?: number;   // 기본값: 20
}

export interface RssCollectedItem {
  channel: RssChannel;
  source: string;
  sourceUrl: string;
  title: string;
  fullText?: string;
  publishedAt?: Date;
}

// 단일 RSS 피드 수집
export async function collectRssFeed(config: RssFeedConfig): Promise<RssCollectedItem[]>

// 여러 RSS 피드 병렬 수집 (개별 실패 허용 — Promise.allSettled)
export async function collectMultipleRssFeeds(configs: RssFeedConfig[]): Promise<RssCollectedItem[]>

// RssCollectedItem -> CollectedItem 변환
export function rssItemToCollectedItem(rssItem: RssCollectedItem): CollectedItem
```

- **에러 처리**: `collectMultipleRssFeeds`는 개별 피드 실패 시 `console.error`만 기록하고 나머지 결과 반환

### 2.4 `TechCollector` — `lib/collectors/tech-collector.ts`

```typescript
export class TechCollector implements ContentCollector {
  name = 'tech-collector';
  channel = 'tech' as const;
  collect(): Promise<CollectorResult>
}
```

- **소스 구성**: HackerNews + GitHub Trending + 사용자 RSS (현재 비어있음)
- **병렬 실행**: `Promise.all` (소스별 독립 실패 허용)
- **소스명**: `'hackernews'`, `'github_trending'`, `'rss_tech'`

---

## 3. F-02: WORLD 수집기

### 3.1 함수 — `lib/collectors/world-collector.ts`

```typescript
// 소스명 -> 카테고리 태그 추출
export function extractCategoryTag(source: string): string[]

// 교차 소스 이슈 중복 가중치 계산
export interface ScoredItem {
  item: CollectedItem;
  crossSourceScore: number;
}
export function scoreByCrossSourceAppearance(items: CollectedItem[]): ScoredItem[]
```

### 3.2 카테고리 태그 매핑

| source | tags |
|--------|------|
| `naver_politics` | `['politics']` |
| `naver_economy` | `['economy']` |
| `naver_society` | `['society']` |
| `naver_it` | `['it_science']` |
| `daum_news` | `['general']` |
| `yonhap` | `['general']` |
| `bbc_korea` | `['international']` |

### 3.3 `WorldCollector` — `lib/collectors/world-collector.ts`

```typescript
export class WorldCollector implements ContentCollector {
  name = 'world-collector';
  channel = 'world' as const;
  collect(): Promise<CollectorResult>
}
```

- **RSS 피드 7개**: 네이버 정치/경제/사회/IT, 다음, 연합뉴스, BBC Korea
- **선별 알고리즘**: 교차 소스 가중치(키워드 교집합 비율 > 0.5 시 동일 이슈 판정) → 상위 15개

---

## 4. F-03: CULTURE 수집기

### 4.1 개별 소스 함수

```typescript
// lib/collectors/naver.ts
export async function collectNaverRealtime(): Promise<CollectedItem[]>
// channel: 'culture', source: 'naver_realtime', limit: 5
// tags: ['realtime_search']

export async function collectNaverDatalabTrend(): Promise<CollectedItem[]>
// channel: 'culture', source: 'naver_datalab', limit: 10
// 환경변수 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정 시 빈 배열 반환

// lib/collectors/netflix.ts
export async function collectNetflixTop1(): Promise<CollectedItem[]>
// channel: 'culture', source: 'netflix_kr'
// title 형식: '[넷플릭스 1위] {콘텐츠 제목}'
// tags: ['netflix', 'streaming']
// HTML 파싱 실패 시 빈 배열

// lib/collectors/melon.ts
export async function collectMelonChart(): Promise<CollectedItem[]>
// channel: 'culture', source: 'melon', limit: 5
// title 형식: '{순위}. {아티스트} - {곡명}'
// tags: ['music', 'melon']
// Mozilla User-Agent 헤더 사용 (봇 차단 우회)

// lib/collectors/youtube.ts
export async function collectYouTubeTrendingTop2(): Promise<CollectedItem[]>
// channel: 'culture', source: 'youtube_trending', limit: 2
// 환경변수 YOUTUBE_DATA_API_KEY 미설정 시 빈 배열 반환
// full_text: 500자 제한
```

### 4.2 `CultureCollector` — `lib/collectors/culture-collector.ts`

```typescript
export class CultureCollector implements ContentCollector {
  name = 'culture-collector';
  channel = 'culture' as const;
  collect(): Promise<CollectorResult>
}
```

- **소스 5개**: naver_realtime, naver_datalab, netflix_kr, melon, youtube_trending
- **병렬 실행**: `Promise.all` + `safeCollect` 래퍼

---

## 5. F-04: TORONTO 수집기

### 5.1 함수 — `lib/collectors/toronto-news.ts`

```typescript
export function filterTorontoNews(items: CollectedItem[], limit: number): CollectedItem[]
```

- **키워드**: `['toronto', 'ontario', 'ttc', 'gta', 'york region']`
- **정렬**: 토론토 키워드 포함 기사 우선, 나머지는 원본 순서 유지
- **반환**: 상위 `limit`개

### 5.2 날씨 — `lib/collectors/weather.ts`

```typescript
export async function getTorontoWeather(): Promise<WeatherData>
export function evaluateWeatherAlert(weather: WeatherData): WeatherAlertCondition
```

- **환경변수**: `OPENWEATHER_API_KEY` 미설정 시 throw
- **API**: OpenWeatherMap `/data/2.5/weather?q=Toronto,CA&units=metric&lang=kr`

### 5.3 `TorontoCollector` — `lib/collectors/toronto-collector.ts`

```typescript
export class TorontoCollector implements ContentCollector {
  name = 'toronto-collector';
  channel = 'canada' as const;
  collect(): Promise<CollectorResult>
  collectTorontoStar(): Promise<CollectedItem[]>
  collectCBC(): Promise<CollectedItem[]>
  collectWeather(): Promise<CollectedItem[]>
  inferTags(title: string): string[]
}
```

- **소스 3개**: toronto_star, cbc_canada, weather_toronto
- **각 뉴스 소스**: RSS → 토론토 키워드 필터 → 상위 2개
- **날씨 아이템**: `[토론토 날씨] {conditionKr} {temp}C (체감 {feelsLike}C)` 형식
- **inferTags**: 제목에 토론토 키워드 포함 시 `['toronto']`, 아니면 `['canada']`

---

## 6. 공통 유틸리티 — `lib/collectors/utils.ts`

```typescript
export async function safeCollect(
  sourceName: string,
  fn: () => Promise<CollectedItem[]>
): Promise<{ items: CollectedItem[]; error?: CollectorError }>
```

- 개별 소스 수집 실패 시 다른 소스에 영향 없이 `error` 기록
- 성공 시 `{ items, error: undefined }`
- 실패 시 `{ items: [], error: { source, message, timestamp } }`
