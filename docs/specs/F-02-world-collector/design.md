# F-02: WORLD 채널 수집 -- 기술 설계서

## 1. 개요

- **기능 ID**: F-02
- **설명**: 네이버 뉴스, 다음 뉴스, 연합뉴스, BBC Korea에서 핵심 이슈를 수집한다
- **마일스톤**: M1
- **우선순위**: P0
- **의존성**: 없음 (독립 기능)
- **병렬 그룹**: A (F-01 ~ F-04 동시 구현 가능)

### 참조
- 인수조건: `docs/project/features.md` #F-02
- 시스템 설계: `docs/system/system-design.md` 섹션 3, 6.1
- ERD: `docs/system/erd.md` content_items 테이블
- API 컨벤션: `docs/system/api-conventions.md`
- **공통 인터페이스**: `docs/specs/F-01-tech-collector/design.md` 섹션 2 (ContentCollector, CollectedItem)

---

## 2. 수집 소스

### 2.1 네이버 뉴스 RSS (4개 섹션)

- **API URL**:
  - 정치: `https://news.naver.com/main/rss/politics.nhn`
  - 경제: `https://news.naver.com/main/rss/economy.nhn`
  - 사회: `https://news.naver.com/main/rss/society.nhn`
  - IT/과학: `https://news.naver.com/main/rss/it.nhn`
- **수집 방법**: `lib/collectors/rss.ts`의 `collectMultipleRssFeeds` 재사용
- **파싱 전략**: 섹션당 20개씩 수집 -> 전체에서 최신성+섹션 다양성 기준 상위 선별
- **선별 로직**:
  1. 섹션당 20개 수집 (총 80개)
  2. AC4 이슈 중복 가중치를 위해 우선 수집만 수행 (선별은 `WorldCollector.collect` 내부에서)
  3. 섹션별 최소 1개 보장 (4개 섹션에서 최소 1개씩)
- **데이터 매핑**:
  - `channel`: `'world'`
  - `source`: `'naver_politics'`, `'naver_economy'`, `'naver_society'`, `'naver_it'`
  - 나머지: RSS 공통 매핑

### 2.2 다음 뉴스 RSS

- **API URL**: `https://news.daum.net/rss` (주요뉴스)
- **수집 방법**: `lib/collectors/rss.ts` 재사용
- **수집량**: 50개 수집 -> 상위 2개 필터링 (AC2)
- **데이터 매핑**:
  - `channel`: `'world'`
  - `source`: `'daum_news'`

### 2.3 연합뉴스 RSS

- **API URL**: `https://www.yonhapnewstv.co.kr/browse/feed/` (주요뉴스)
- **수집 방법**: `lib/collectors/rss.ts` 재사용
- **수집량**: 100개 수집 -> 상위 2개 필터링 (AC3)
- **데이터 매핑**:
  - `channel`: `'world'`
  - `source`: `'yonhap'`

### 2.4 BBC Korea RSS

- **API URL**: `https://feeds.bbci.co.uk/korean/rss.xml`
- **수집 방법**: `lib/collectors/rss.ts` 재사용
- **수집량**: 30개 수집
- **데이터 매핑**:
  - `channel`: `'world'`
  - `source`: `'bbc_korea'`
- **비고**: features.md에 명시되지 않았으나, system-design.md 6.1에 포함. 추가 소스로 활용

---

## 3. 아키텍처 결정

### 결정 1: 이슈 중복 가중치 로직 위치

- **선택지**: A) 수집기 내부에서 제목 유사도 분석 / B) AI 요약(F-05) 단계에서 처리
- **결정**: A) 수집기 내부에서 간단한 키워드 매칭 기반 가중치 부여
- **근거**: AC4 "동일 이슈가 여러 소스에서 반복 등장할수록 가중치 부여"는 수집 단계에서 처리해야 효과적. AI에 의존하면 비용 증가. 간단한 제목 토큰 교집합 비율로 중복 이슈 판별 가능

### 결정 2: 선별 전략 (전체 수집 후 선별 vs 소스별 사전 선별)

- **선택지**: A) 모든 소스에서 전체 수집 후 통합 선별 / B) 소스별 사전 선별 후 합산
- **결정**: A) 전체 수집 후 통합 선별
- **근거**: AC4 교차 소스 이슈 중복 가중치를 계산하려면 모든 소스의 데이터가 필요. 소스별 사전 선별 시 중복 이슈 탐지가 불가능

---

## 4. 이슈 중복 가중치 로직 (AC4)

```typescript
// lib/collectors/world-collector.ts 내부 유틸

interface ScoredItem {
  item: CollectedItem;
  crossSourceScore: number;  // 교차 소스 등장 횟수 기반 점수
}

/**
 * 제목 기반 교차 소스 이슈 중복 가중치 계산
 * 동일 이슈가 여러 소스에서 반복 등장할수록 높은 점수
 */
function scoreByCrossSourceAppearance(items: CollectedItem[]): ScoredItem[] {
  // 1. 제목에서 핵심 키워드 추출 (조사/접속사 제거)
  // 2. 아이템 쌍별 키워드 교집합 비율 계산
  // 3. 교집합 비율 > 0.5인 쌍을 동일 이슈로 판정
  // 4. 동일 이슈 그룹에서 등장 소스 수를 가중치로 부여
  // 5. 가중치 높은 순 정렬 (동일 가중치 시 최신순)
}
```

### 선별 결과

- 네이버 뉴스: 상위 3개 (AC1)
- 다음 뉴스: 상위 2개 (AC2)
- 연합뉴스: 상위 2개 (AC3)
- BBC Korea: 추가 보너스 (교차 소스 점수 높으면 포함)
- **최종 저장**: 교차 소스 점수 기반 전체 상위 ~10개를 content_items에 저장
- **참고**: 최종 브리핑 선정(WORLD 1~2개)은 F-05(AI 스코어링)에서 처리

---

## 5. 데이터 모델

### content_items 테이블 매핑

| CollectedItem 필드 | content_items 컬럼 | 변환 로직 |
|--------------------|--------------------|----------|
| `channel` | `channel` | 항상 `'world'` |
| `source` | `source` | `'naver_politics'`, `'naver_economy'`, `'naver_society'`, `'naver_it'`, `'daum_news'`, `'yonhap'`, `'bbc_korea'` |
| `source_url` | `source_url` | 그대로 (UNIQUE 제약으로 중복 방지) |
| `title` | `title` | 그대로 |
| `full_text` | `full_text` | RSS contentSnippet 또는 content |
| `published_at` | `published_at` | RSS pubDate -> TIMESTAMPTZ |
| `tags` | `tags` | 섹션 카테고리 태그 (예: `['politics']`, `['economy']`) |

---

## 6. 인터페이스 설계

### WorldCollector 클래스

```typescript
// lib/collectors/world-collector.ts

import type { ContentCollector, CollectorResult, CollectedItem, CollectorError } from './types';
import { safeCollect } from './utils';
import { collectMultipleRssFeeds, type RssFeedConfig } from './rss';

const WORLD_RSS_FEEDS: RssFeedConfig[] = [
  { url: 'https://news.naver.com/main/rss/politics.nhn', source: 'naver_politics', channel: 'world', limit: 20 },
  { url: 'https://news.naver.com/main/rss/economy.nhn', source: 'naver_economy', channel: 'world', limit: 20 },
  { url: 'https://news.naver.com/main/rss/society.nhn', source: 'naver_society', channel: 'world', limit: 20 },
  { url: 'https://news.naver.com/main/rss/it.nhn', source: 'naver_it', channel: 'world', limit: 20 },
  { url: 'https://news.daum.net/rss', source: 'daum_news', channel: 'world', limit: 50 },
  { url: 'https://www.yonhapnewstv.co.kr/browse/feed/', source: 'yonhap', channel: 'world', limit: 100 },
  { url: 'https://feeds.bbci.co.uk/korean/rss.xml', source: 'bbc_korea', channel: 'world', limit: 30 },
];

export class WorldCollector implements ContentCollector {
  name = 'world-collector';
  channel = 'world' as const;

  async collect(): Promise<CollectorResult> {
    const errors: CollectorError[] = [];

    // 모든 RSS 피드 병렬 수집 (개별 실패 허용은 rss.ts 내부에서 처리)
    const { items: rawItems, error } = await safeCollect(
      'world_rss_all',
      () => collectMultipleRssFeeds(WORLD_RSS_FEEDS)
    );

    if (error) errors.push(error);

    // CollectedItem으로 변환
    const items: CollectedItem[] = rawItems.map((rssItem) => ({
      channel: 'world' as const,
      source: rssItem.source,
      source_url: rssItem.sourceUrl,
      title: rssItem.title,
      full_text: rssItem.fullText,
      published_at: rssItem.publishedAt,
      tags: this.extractCategoryTag(rssItem.source),
    }));

    // 교차 소스 이슈 중복 가중치 적용 후 상위 선별
    const scored = scoreByCrossSourceAppearance(items);
    const selected = scored.slice(0, 15);  // 상위 15개 저장 (브리핑 선정은 F-05)

    return {
      channel: 'world',
      items: selected.map((s) => s.item),
      errors,
    };
  }

  private extractCategoryTag(source: string): string[] {
    const categoryMap: Record<string, string> = {
      naver_politics: 'politics',
      naver_economy: 'economy',
      naver_society: 'society',
      naver_it: 'it_science',
      daum_news: 'general',
      yonhap: 'general',
      bbc_korea: 'international',
    };
    const tag = categoryMap[source];
    return tag ? [tag] : [];
  }
}
```

---

## 7. 구현 파일

### 7.1 신규 생성 파일

| 파일 경로 | 역할 |
|-----------|------|
| `lib/collectors/world-collector.ts` | WORLD 채널 오케스트레이터 (ContentCollector 구현) |

### 7.2 수정 필요 파일

| 파일 경로 | 변경 내용 |
|-----------|----------|
| `lib/collectors/rss.ts` | RSS_FEEDS 배열에서 WORLD 전용 설정을 world-collector.ts로 이동. `RssCollectedItem` -> `CollectedItem` 변환 유틸 추가 |
| `lib/collectors/naver.ts` | 네이버 데이터랩은 F-03(CULTURE)에서 사용. 뉴스 RSS는 rss.ts 재사용이므로 현재 스텁 유지 |
| `lib/collectors/daum.ts` | 다음 뉴스 전용 로직 불필요 (RSS 공통 처리). 타입 re-export 유지 |
| `lib/collectors/yonhap.ts` | 연합뉴스 전용 로직 불필요 (RSS 공통 처리). 타입 re-export 유지 |

### 7.3 공유 의존성

| 모듈 | 용도 |
|------|------|
| `lib/collectors/types.ts` | F-01에서 정의한 공통 인터페이스 |
| `lib/collectors/utils.ts` | F-01에서 정의한 `safeCollect` |
| `lib/collectors/rss.ts` | 범용 RSS 파서 (기존 구현 재사용) |

---

## 8. 에러 처리

### 소스별 독립 실패

- `collectMultipleRssFeeds`는 이미 내부적으로 `Promise.allSettled`를 사용하여 개별 피드 실패를 허용
- 네이버 4개 섹션 중 일부 실패해도 나머지 섹션 + 다음/연합/BBC 수집 계속

### 에러 유형별 처리

| 에러 유형 | 처리 방법 |
|-----------|----------|
| RSS 피드 타임아웃 | rss-parser의 10초 타임아웃 후 해당 피드만 실패 |
| RSS 피드 404/500 | 해당 피드만 스킵, 에러 로그 기록 |
| RSS URL 변경 (네이버/다음) | 빈 결과 + 에러 로그. 수동 URL 업데이트 필요 |
| 교차 소스 점수 계산 실패 | 점수 계산 없이 원본 순서대로 반환 (graceful degradation) |

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-28 | 초기 설계 작성 | F-02 WORLD 채널 수집기 설계 |
