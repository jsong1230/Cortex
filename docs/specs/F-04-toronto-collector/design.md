# F-04: TORONTO 채널 수집 -- 기술 설계서

## 1. 개요

- **기능 ID**: F-04
- **설명**: Toronto Star, CBC News, OpenWeatherMap에서 토론토/캐나다 관련 콘텐츠와 날씨 정보를 수집한다
- **마일스톤**: M1
- **우선순위**: P0
- **의존성**: 없음 (독립 기능)
- **병렬 그룹**: A (F-01 ~ F-04 동시 구현 가능)

### 참조
- 인수조건: `docs/project/features.md` #F-04
- 시스템 설계: `docs/system/system-design.md` 섹션 3, 6.1, 6.4
- ERD: `docs/system/erd.md` content_items 테이블
- API 컨벤션: `docs/system/api-conventions.md`
- **공통 인터페이스**: `docs/specs/F-01-tech-collector/design.md` 섹션 2 (ContentCollector, CollectedItem)

---

## 2. 수집 소스

### 2.1 Toronto Star RSS

- **API URL**: `https://www.thestar.com/feeds`
- **수집 방법**: `lib/collectors/rss.ts`의 `collectRssFeed` 재사용
- **수집량**: 30개 수집 -> 상위 2개 필터링 (AC1)
- **선별 기준**: `lib/collectors/toronto-news.ts`의 `filterTorontoNews` 함수 활용. 토론토 관련 키워드(`toronto`, `ontario`, `ttc`, `gta`, `york region`) 포함 기사 우선
- **데이터 매핑**:
  - `channel`: `'canada'`
  - `source`: `'toronto_star'`
  - `source_url`: RSS link 필드
  - `title`: RSS title 필드
  - `full_text`: RSS contentSnippet
  - `published_at`: RSS pubDate
  - `tags`: `['toronto']` (토론토 키워드 매칭 시) 또는 `['canada']`

### 2.2 CBC News Canada RSS

- **API URL**: `https://www.cbc.ca/cmlink/rss-canada`
- **수집 방법**: `lib/collectors/rss.ts`의 `collectRssFeed` 재사용
- **수집량**: 30개 수집 -> 상위 2개 필터링 (AC2)
- **선별 기준**: 토론토 키워드 우선, 없으면 캐나다 전국 뉴스 최신순
- **데이터 매핑**:
  - `channel`: `'canada'`
  - `source`: `'cbc_canada'`
  - `source_url`: RSS link 필드
  - `title`: RSS title 필드
  - `full_text`: RSS contentSnippet
  - `published_at`: RSS pubDate
  - `tags`: `['toronto']` 또는 `['canada']`

### 2.3 토론토 날씨 (OpenWeatherMap API)

- **API URL**: `https://api.openweathermap.org/data/2.5/weather?q=Toronto,CA&units=metric&lang=kr`
- **인증**: `OPENWEATHER_API_KEY` 환경변수 필수
- **기존 구현**: `lib/collectors/weather.ts`에 `getTorontoWeather` 함수 완성됨
- **데이터 매핑**: 날씨 데이터를 `CollectedItem` 형태로 변환
  - `channel`: `'canada'`
  - `source`: `'weather_toronto'`
  - `source_url`: `https://openweathermap.org/city/6167865` + 오늘 날짜 (일별 고유성)
  - `title`: `[토론토 날씨] {conditionKr} {temperature}C (체감 {feelsLike}C)`
  - `full_text`: `습도 {humidity}% | 풍속 {windSpeed}m/s | 최고/최저 {temp_max}/{temp_min}C`
  - `published_at`: 수집 시각
  - `tags`: `['weather', 'toronto']`
- **AC4**: "날씨 데이터는 매일 브리핑에 고정 포함된다" -- 이 제약은 F-06(브리핑 발송)에서 처리. F-04는 수집만 담당

---

## 3. 아키텍처 결정

### 결정 1: 날씨 데이터를 content_items에 저장할 것인가

- **선택지**: A) content_items에 일반 아이템처럼 저장 / B) 별도 weather_data 테이블 사용
- **결정**: A) content_items에 저장
- **근거**: 스키마 추가 없이 기존 구조 활용. source_url에 날짜를 포함하여 일별 고유성 보장. F-06에서 channel='canada' AND source='weather_toronto'로 쉽게 조회 가능

### 결정 2: 뉴스 선별 전략

- **선택지**: A) RSS 수집 -> filterTorontoNews -> 상위 반환 / B) 전체 수집 후 AI 선별(F-05)
- **결정**: A) 수집기 내부에서 키워드 기반 사전 선별
- **근거**: 토론토 관련성은 키워드 매칭으로 충분히 판별 가능. AI 비용 절약. 최종 브리핑 선정은 F-05에서 추가 수행

### 결정 3: 날씨 수집 빈도

- **선택지**: A) 하루 1회 (06:30 Cron) / B) 매시간 (alerts Cron과 동시)
- **결정**: A) 하루 1회
- **근거**: content_items 저장은 브리핑용이므로 1일 1회 충분. 긴급 알림용 날씨 체크(매시간)는 F-15에서 별도 처리. weather.ts의 `getTorontoWeather`를 공유

---

## 4. 데이터 모델

### content_items 테이블 매핑

| CollectedItem 필드 | content_items 컬럼 | 변환 로직 |
|--------------------|--------------------|----------|
| `channel` | `channel` | 항상 `'canada'` |
| `source` | `source` | `'toronto_star'`, `'cbc_canada'`, `'weather_toronto'` |
| `source_url` | `source_url` | 뉴스: RSS link. 날씨: OpenWeather URL + 날짜 |
| `title` | `title` | 뉴스: RSS title. 날씨: 포맷된 날씨 문자열 |
| `full_text` | `full_text` | 뉴스: RSS contentSnippet. 날씨: 상세 정보 |
| `published_at` | `published_at` | 뉴스: RSS pubDate. 날씨: 수집 시각 |
| `tags` | `tags` | `['toronto']`, `['canada']`, `['weather', 'toronto']` |

### 날씨 source_url 고유성

```typescript
// 날짜를 포함하여 일별 고유성 보장
const today = new Date().toISOString().slice(0, 10); // '2026-02-28'
const weatherSourceUrl = `https://openweathermap.org/city/6167865?date=${today}`;
```

---

## 5. 인터페이스 설계

### TorontoCollector 클래스

```typescript
// lib/collectors/toronto-collector.ts

import type { ContentCollector, CollectorResult, CollectedItem, CollectorError } from './types';
import { safeCollect } from './utils';
import { collectRssFeed, type RssFeedConfig } from './rss';
import { filterTorontoNews } from './toronto-news';
import { getTorontoWeather, type WeatherData } from './weather';

const TORONTO_RSS_FEEDS: RssFeedConfig[] = [
  { url: 'https://www.thestar.com/feeds', source: 'toronto_star', channel: 'canada', limit: 30 },
  { url: 'https://www.cbc.ca/cmlink/rss-canada', source: 'cbc_canada', channel: 'canada', limit: 30 },
];

export class TorontoCollector implements ContentCollector {
  name = 'toronto-collector';
  channel = 'canada' as const;

  async collect(): Promise<CollectorResult> {
    const errors: CollectorError[] = [];
    const allItems: CollectedItem[] = [];

    // 3개 소스 병렬 실행 (RSS 2개 + 날씨 1개)
    const [torontoStar, cbc, weather] = await Promise.all([
      safeCollect('toronto_star', () => this.collectTorontoStar()),
      safeCollect('cbc_canada', () => this.collectCBC()),
      safeCollect('weather_toronto', () => this.collectWeather()),
    ]);

    // 결과 합산
    for (const result of [torontoStar, cbc, weather]) {
      allItems.push(...result.items);
      if (result.error) errors.push(result.error);
    }

    return { channel: 'canada', items: allItems, errors };
  }

  /** Toronto Star RSS -> 토론토 키워드 필터 -> 상위 2개 */
  private async collectTorontoStar(): Promise<CollectedItem[]> {
    const rssItems = await collectRssFeed(TORONTO_RSS_FEEDS[0]);
    const mapped = rssItems.map((item) => this.rssToCollectedItem(item, 'toronto_star'));
    const filtered = filterTorontoNews(mapped as any, 2);
    return filtered.map((item) => ({
      ...item,
      tags: this.inferTags(item.title),
    }));
  }

  /** CBC Canada RSS -> 토론토 키워드 필터 -> 상위 2개 */
  private async collectCBC(): Promise<CollectedItem[]> {
    const rssItems = await collectRssFeed(TORONTO_RSS_FEEDS[1]);
    const mapped = rssItems.map((item) => this.rssToCollectedItem(item, 'cbc_canada'));
    const filtered = filterTorontoNews(mapped as any, 2);
    return filtered.map((item) => ({
      ...item,
      tags: this.inferTags(item.title),
    }));
  }

  /** 토론토 날씨 -> CollectedItem 변환 */
  private async collectWeather(): Promise<CollectedItem[]> {
    const weather = await getTorontoWeather();
    const today = new Date().toISOString().slice(0, 10);

    return [{
      channel: 'canada',
      source: 'weather_toronto',
      source_url: `https://openweathermap.org/city/6167865?date=${today}`,
      title: `[토론토 날씨] ${weather.conditionKr} ${weather.temperature}C (체감 ${weather.feelsLike}C)`,
      full_text: `습도 ${weather.humidity}% | 풍속 ${weather.windSpeed}m/s`,
      published_at: new Date(),
      tags: ['weather', 'toronto'],
    }];
  }

  /** RSS 아이템 -> CollectedItem 변환 */
  private rssToCollectedItem(rssItem: any, source: string): CollectedItem {
    return {
      channel: 'canada',
      source,
      source_url: rssItem.sourceUrl,
      title: rssItem.title,
      full_text: rssItem.fullText,
      published_at: rssItem.publishedAt,
    };
  }

  /** 제목 기반 태그 추론 */
  private inferTags(title: string): string[] {
    const lower = title.toLowerCase();
    const torontoKeywords = ['toronto', 'ontario', 'ttc', 'gta', 'york region'];
    const isTorontoSpecific = torontoKeywords.some((kw) => lower.includes(kw));
    return isTorontoSpecific ? ['toronto'] : ['canada'];
  }
}
```

---

## 6. 구현 파일

### 6.1 신규 생성 파일

| 파일 경로 | 역할 |
|-----------|------|
| `lib/collectors/toronto-collector.ts` | TORONTO 채널 오케스트레이터 (ContentCollector 구현) |

### 6.2 수정 필요 파일

| 파일 경로 | 변경 내용 |
|-----------|----------|
| `lib/collectors/toronto-news.ts` | `filterTorontoNews` 함수의 입력 타입을 공통 `CollectedItem`으로 변경. 기존 `TorontoNewsItem` 인터페이스 제거 |
| `lib/collectors/weather.ts` | `getTorontoWeather` 함수는 변경 없음. 기존 구현 그대로 사용 |
| `lib/collectors/rss.ts` | `collectRssFeed` 함수의 RSS_FEEDS에서 TORONTO 설정을 `toronto-collector.ts`로 이동 |

### 6.3 공유 의존성

| 모듈 | 용도 |
|------|------|
| `lib/collectors/types.ts` | F-01에서 정의한 공통 인터페이스 |
| `lib/collectors/utils.ts` | F-01에서 정의한 `safeCollect` |
| `lib/collectors/rss.ts` | 범용 RSS 파서 (기존 구현 재사용) |
| `lib/collectors/weather.ts` | 날씨 API 호출 (기존 구현 재사용) |
| `lib/collectors/toronto-news.ts` | 토론토 키워드 필터링 (기존 구현 수정 후 재사용) |

### 6.4 환경변수 의존성

| 환경변수 | 필수 여부 | 사용 소스 |
|----------|----------|----------|
| `OPENWEATHER_API_KEY` | 필수 | OpenWeatherMap API |

- `OPENWEATHER_API_KEY` 미설정 시 날씨 소스만 실패, 뉴스 소스는 계속 수집

---

## 7. 에러 처리

### 소스별 안정성 등급

| 소스 | 안정성 | 실패 시 영향 | 대응 |
|------|--------|------------|------|
| Toronto Star RSS | 높음 (RSS) | 토론토 로컬 뉴스 누락 | rss-parser 타임아웃, safeCollect |
| CBC Canada RSS | 높음 (RSS) | 캐나다 뉴스 누락 | rss-parser 타임아웃, safeCollect |
| OpenWeatherMap | 높음 (공식 API) | 날씨 정보 누락 | API 키 체크, safeCollect |

### 에러 유형별 처리

| 에러 유형 | 처리 방법 |
|-----------|----------|
| RSS 피드 타임아웃 | rss-parser 10초 타임아웃, 해당 소스만 빈 결과 |
| RSS URL 변경 | 빈 결과 + 에러 로그. 수동 URL 업데이트 필요 |
| OPENWEATHER_API_KEY 미설정 | weather.ts에서 throw -> safeCollect에서 빈 배열 + 에러 |
| 날씨 API 응답 형식 변경 | 파싱 실패 throw -> safeCollect에서 빈 배열 + 에러 |
| 토론토 키워드 매칭 0건 | 필터 없이 최신순 상위 반환 (graceful degradation) |

### 날씨 데이터 누락 시 브리핑 영향

- F-04는 수집만 담당. 날씨 수집 실패 시 content_items에 날씨 행 없음
- F-06(브리핑 발송)에서 `source='weather_toronto'` 조회 시 없으면 "날씨 정보 없음" 표시
- AC4 "날씨 데이터는 매일 브리핑에 고정 포함" 미충족 가능 -> F-06에서 재시도 로직 검토

---

## 8. 시퀀스 흐름

### TORONTO 채널 수집 흐름

```
Vercel Cron (06:30)
  -> POST /api/cron/collect
    -> TorontoCollector.collect()
      -> Promise.all([
           safeCollect('toronto_star', collectTorontoStar()),
           safeCollect('cbc_canada', collectCBC()),
           safeCollect('weather_toronto', collectWeather()),
         ])
      -> collectTorontoStar:
           RSS fetch (thestar.com/feeds)
           -> rss-parser 파싱 (30개)
           -> filterTorontoNews (키워드 필터 + 상위 2개)
           -> CollectedItem[] 반환
      -> collectCBC:
           RSS fetch (cbc.ca/cmlink/rss-canada)
           -> rss-parser 파싱 (30개)
           -> filterTorontoNews (키워드 필터 + 상위 2개)
           -> CollectedItem[] 반환
      -> collectWeather:
           GET openweathermap.org/data/2.5/weather?q=Toronto,CA
           -> WeatherData -> CollectedItem 변환
           -> CollectedItem[] (1개) 반환
    -> 결과 합산 (뉴스 4개 + 날씨 1개 = 5개)
    -> content_items UPSERT (source_url UNIQUE)
    -> CollectorResult 반환
```

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-28 | 초기 설계 작성 | F-04 TORONTO 채널 수집기 설계 |
