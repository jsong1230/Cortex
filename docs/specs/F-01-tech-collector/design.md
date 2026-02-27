# F-01: TECH 채널 수집 -- 기술 설계서

## 1. 개요

- **기능 ID**: F-01
- **설명**: Hacker News, GitHub Trending, 사용자 정의 RSS에서 기술 콘텐츠를 수집한다
- **마일스톤**: M1
- **우선순위**: P0
- **의존성**: 없음 (독립 기능)
- **병렬 그룹**: A (F-01 ~ F-04 동시 구현 가능)

### 참조
- 인수조건: `docs/project/features.md` #F-01
- 시스템 설계: `docs/system/system-design.md` 섹션 3, 6.1
- ERD: `docs/system/erd.md` content_items 테이블
- API 컨벤션: `docs/system/api-conventions.md`

---

## 2. 공통 수집기 인터페이스 (4채널 공유)

F-01~F-04 모든 수집기가 준수해야 하는 공통 인터페이스를 정의한다. 이 인터페이스는 `lib/collectors/types.ts`에 위치한다.

### 2.1 타입 정의

```typescript
// lib/collectors/types.ts

/** 채널 타입 */
export type Channel = 'tech' | 'world' | 'culture' | 'canada';

/** 수집된 개별 아이템 */
export interface CollectedItem {
  channel: Channel;
  source: string;        // 'hackernews' | 'github_trending' | 'naver_news' 등
  source_url: string;    // content_items.source_url에 매핑 (UNIQUE 제약)
  title: string;
  full_text?: string;    // 본문 또는 요약 텍스트 (있는 경우)
  published_at?: Date;   // 원본 발행 시간
  tags?: string[];       // 소스 레벨에서 추출 가능한 태그 (언어, 카테고리 등)
}

/** 개별 소스의 수집 에러 */
export interface CollectorError {
  source: string;        // 실패한 소스명
  message: string;       // 에러 메시지
  timestamp: Date;       // 에러 발생 시각
}

/** 수집기 실행 결과 */
export interface CollectorResult {
  channel: Channel;
  items: CollectedItem[];
  errors: CollectorError[];
}

/** 수집기 공통 인터페이스 */
export interface ContentCollector {
  /** 수집기 식별자 (로깅/모니터링용) */
  name: string;
  /** 대상 채널 */
  channel: Channel;
  /** 수집 실행: 모든 소스를 병렬 호출하고 결과를 합산한다 */
  collect(): Promise<CollectorResult>;
}
```

### 2.2 공통 유틸리티 함수

```typescript
// lib/collectors/utils.ts

import { CollectorError, CollectedItem } from './types';

/** 소스별 독립 try/catch 래퍼 */
export async function safeCollect(
  sourceName: string,
  fn: () => Promise<CollectedItem[]>
): Promise<{ items: CollectedItem[]; error?: CollectorError }> {
  try {
    const items = await fn();
    return { items };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      items: [],
      error: {
        source: sourceName,
        message,
        timestamp: new Date(),
      },
    };
  }
}
```

### 2.3 수집 파이프라인 오케스트레이터

`app/api/cron/collect/route.ts`에서 4채널 수집기를 병렬 실행한다.

```typescript
// app/api/cron/collect/route.ts (수집 부분만)

import { TechCollector } from '@/lib/collectors/tech-collector';
import { WorldCollector } from '@/lib/collectors/world-collector';
import { CultureCollector } from '@/lib/collectors/culture-collector';
import { TorontoCollector } from '@/lib/collectors/toronto-collector';
import type { ContentCollector, CollectorResult } from '@/lib/collectors/types';

const collectors: ContentCollector[] = [
  new TechCollector(),
  new WorldCollector(),
  new CultureCollector(),
  new TorontoCollector(),
];

// 4채널 병렬 수집 (채널별 독립 실행)
const results: CollectorResult[] = await Promise.all(
  collectors.map((c) => c.collect())
);
```

---

## 3. 수집 소스

### 3.1 Hacker News (Firebase REST API)

- **API URL**: `https://hacker-news.firebaseio.com/v0/topstories.json`
- **개별 아이템**: `https://hacker-news.firebaseio.com/v0/item/{id}.json`
- **요청 형식**: GET, 인증 불필요
- **응답 파싱**:
  1. Top Stories ID 배열에서 상위 50개 추출
  2. 개별 아이템을 `Promise.allSettled`로 병렬 fetch
  3. `score` 기준 내림차순 정렬 후 상위 10개 선별
- **데이터 매핑**:
  - `source_url`: `item.url` 또는 `https://news.ycombinator.com/item?id={item.id}` (url이 없는 경우)
  - `title`: `item.title`
  - `published_at`: `new Date(item.time * 1000)`
  - `tags`: 소스 레벨에서는 없음 (AI 태깅 시 추출)
- **기존 구현**: `lib/collectors/hackernews.ts`에 기본 로직 완성됨. `CollectedItem` 인터페이스에 맞게 리팩토링 필요

### 3.2 GitHub Trending (HTML 파싱)

- **URL**: `https://github.com/trending?since=daily`
- **파싱 전략**: HTML에서 `article.Box-row` 요소 추출 (cheerio 사용)
- **User-Agent**: `Cortex-Bot/1.0 (Personal AI Briefing)` 필수
- **추출 데이터**:
  - 리포지토리명 (owner/repo)
  - 설명 (description)
  - 언어, 스타 수, 오늘 스타 증가분
- **데이터 매핑**:
  - `source_url`: `https://github.com/{owner}/{repo}`
  - `title`: `{owner}/{repo}: {description}` 형식
  - `full_text`: `{description} | {language} | +{todayStars} stars today`
  - `tags`: `[language]` (프로그래밍 언어)
  - `published_at`: 수집 시각 (`new Date()`)
- **에러 처리**: HTML 구조 변경 시 파싱 실패 가능. `cheerio` 셀렉터가 빈 결과를 반환하면 에러 로깅 후 빈 배열 반환
- **수집량**: 일별 트렌딩 상위 20개

### 3.3 사용자 정의 RSS

- **설정 소스**: 초기에는 `lib/collectors/rss.ts`의 `RSS_FEEDS` 배열에 하드코딩. F-20(설정 페이지) 구현 후 DB에서 읽도록 변경
- **기존 구현**: `lib/collectors/rss.ts`에 범용 RSS 파서(`rss-parser`) 및 `collectMultipleRssFeeds` 함수 완성됨
- **TECH 채널 RSS 설정**: 초기에는 없음. 사용자가 직접 추가하는 TECH 관련 블로그/뉴스레터 RSS
- **데이터 매핑**: `lib/collectors/rss.ts`의 `RssCollectedItem` -> `CollectedItem` 변환
- **수집량**: 피드당 최신 5개 (`limit: 5`)

---

## 4. 데이터 모델

### 4.1 content_items 테이블 매핑

| CollectedItem 필드 | content_items 컬럼 | 변환 로직 |
|--------------------|--------------------|----------|
| `channel` | `channel` | 그대로 (`'tech'`) |
| `source` | `source` | 그대로 (`'hackernews'`, `'github_trending'`, `'rss_{피드명}'`) |
| `source_url` | `source_url` | 그대로 (UNIQUE 제약으로 중복 방지) |
| `title` | `title` | 그대로 |
| `full_text` | `full_text` | 그대로 (없으면 NULL) |
| `published_at` | `published_at` | Date -> TIMESTAMPTZ 변환 |
| `tags` | `tags` | 문자열 배열 (없으면 NULL, AI 태깅 시 업데이트) |
| - | `summary_ai` | NULL (F-05 AI 요약에서 채워짐) |
| - | `embedding` | NULL (F-05에서 채워짐) |
| - | `collected_at` | DB DEFAULT `NOW()` |
| - | `score_initial` | DB DEFAULT `0.5` (F-05에서 재산정) |

### 4.2 중복 방지 전략

```typescript
// source_url UNIQUE 제약을 활용한 upsert
const { error } = await supabase
  .from('content_items')
  .upsert(
    items.map((item) => ({
      channel: item.channel,
      source: item.source,
      source_url: item.source_url,
      title: item.title,
      full_text: item.full_text ?? null,
      published_at: item.published_at?.toISOString() ?? null,
      tags: item.tags ?? null,
    })),
    { onConflict: 'source_url', ignoreDuplicates: true }
  );
```

- `ignoreDuplicates: true`: 이미 존재하는 source_url은 무시하고 새 항목만 삽입
- 중복된 건수는 응답의 `duplicates_skipped`에 반영

---

## 5. 인터페이스 설계

### 5.1 TechCollector 클래스

```typescript
// lib/collectors/tech-collector.ts

import type { ContentCollector, CollectorResult, CollectedItem } from './types';
import { safeCollect } from './utils';
import { collectHackerNews } from './hackernews';
import { collectGitHubTrending } from './github';
import { collectRssFeeds } from './rss';

export class TechCollector implements ContentCollector {
  name = 'tech-collector';
  channel = 'tech' as const;

  async collect(): Promise<CollectorResult> {
    const errors: CollectorError[] = [];
    const allItems: CollectedItem[] = [];

    // 3개 소스 병렬 실행 (각각 독립 try/catch)
    const [hn, github, rss] = await Promise.all([
      safeCollect('hackernews', () => collectHackerNews()),
      safeCollect('github_trending', () => collectGitHubTrending()),
      safeCollect('rss_tech', () => collectTechRssFeeds()),
    ]);

    // 결과 합산
    allItems.push(...hn.items, ...github.items, ...rss.items);
    if (hn.error) errors.push(hn.error);
    if (github.error) errors.push(github.error);
    if (rss.error) errors.push(rss.error);

    return { channel: 'tech', items: allItems, errors };
  }
}
```

### 5.2 hackernews.ts 리팩토링 방향

기존 `lib/collectors/hackernews.ts`는 자체 `CollectedItem` 인터페이스를 정의하고 있다. 이를 공통 `CollectedItem`으로 변경한다.

**변경점**:
- `import type { CollectedItem } from './types'` 사용
- `sourceUrl` -> `source_url` (snake_case, DB 컬럼과 일치)
- `publishedAt` -> `published_at`
- `fullText` -> `full_text`
- 반환 타입을 공통 `CollectedItem[]`로 통일

### 5.3 github.ts 구현 방향

기존 스텁에서 `cheerio` 기반 파싱 로직 구현:

```typescript
// lib/collectors/github.ts (구현 골격)

import * as cheerio from 'cheerio';
import type { CollectedItem } from './types';

const GITHUB_TRENDING_URL = 'https://github.com/trending?since=daily';
const TRENDING_LIMIT = 20;

export async function collectGitHubTrending(): Promise<CollectedItem[]> {
  const response = await fetch(GITHUB_TRENDING_URL, {
    headers: {
      'User-Agent': 'Cortex-Bot/1.0 (Personal AI Briefing)',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Trending 페이지 조회 실패: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];

  $('article.Box-row').each((index, el) => {
    if (index >= TRENDING_LIMIT) return false;

    const repoPath = $(el).find('h2 a').attr('href')?.trim();
    const description = $(el).find('p').text().trim();
    const language = $(el).find('[itemprop="programmingLanguage"]').text().trim();

    if (!repoPath) return;

    items.push({
      channel: 'tech',
      source: 'github_trending',
      source_url: `https://github.com${repoPath}`,
      title: `${repoPath.slice(1)}: ${description || '(설명 없음)'}`,
      full_text: [description, language].filter(Boolean).join(' | '),
      published_at: new Date(),
      tags: language ? [language] : [],
    });
  });

  return items;
}
```

---

## 6. 구현 파일

### 6.1 신규 생성 파일

| 파일 경로 | 역할 |
|-----------|------|
| `lib/collectors/types.ts` | 공통 수집기 인터페이스/타입 정의 (4채널 공유) |
| `lib/collectors/utils.ts` | 공통 유틸리티 (`safeCollect` 래퍼 등) |
| `lib/collectors/tech-collector.ts` | TECH 채널 오케스트레이터 (ContentCollector 구현) |

### 6.2 수정 필요 파일

| 파일 경로 | 변경 내용 |
|-----------|----------|
| `lib/collectors/hackernews.ts` | 자체 `CollectedItem` 삭제, 공통 타입 import, 필드명 snake_case 변환 |
| `lib/collectors/github.ts` | 스텁 -> `cheerio` 기반 파싱 구현, 공통 타입 사용 |
| `lib/collectors/rss.ts` | `RssCollectedItem` -> `CollectedItem` 변환 함수 추가, TECH 전용 RSS 설정 분리 |

### 6.3 의존 패키지 추가

| 패키지 | 용도 |
|--------|------|
| `cheerio` | GitHub Trending HTML 파싱 |
| `rss-parser` | RSS 피드 파싱 (이미 `rss.ts`에서 사용 중) |

---

## 7. 에러 처리

### 7.1 소스별 독립 try/catch

- HN, GitHub, RSS 각각 `safeCollect` 래퍼로 감싸서 개별 실패 시 다른 소스 수집에 영향 없음
- AC6 충족: "개별 소스 수집 실패 시 다른 소스 수집은 계속 진행된다"

### 7.2 에러 유형별 처리

| 에러 유형 | 처리 방법 |
|-----------|----------|
| 네트워크 타임아웃 (10초) | 해당 소스 빈 배열 반환 + CollectorError 기록 |
| HTTP 4xx/5xx | 해당 소스 빈 배열 반환 + CollectorError 기록 |
| HTML 파싱 실패 (GitHub) | 빈 배열 반환 + CollectorError에 셀렉터 정보 포함 |
| 환경변수 미설정 | RSS는 환경변수 불필요. HN/GitHub도 불필요. 에러 아닌 정상 동작 |

### 7.3 로깅 전략

```typescript
// 수집 완료 후 구조화된 로그 출력 (Vercel Logs에서 확인)
console.log(JSON.stringify({
  collector: 'tech',
  collected: items.length,
  errors: errors.map((e) => ({ source: e.source, message: e.message })),
  duration_ms: Date.now() - startTime,
}));
```

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-28 | 초기 설계 작성 | F-01 TECH 채널 수집기 + 4채널 공통 인터페이스 정의 |
