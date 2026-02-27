# F-03: CULTURE 채널 수집 -- 기술 설계서

## 1. 개요

- **기능 ID**: F-03
- **설명**: 네이버 실시간 검색어, 네이버 데이터랩, 넷플릭스 TOP 10, 멜론 차트, 유튜브 트렌딩에서 문화 트렌드를 수집한다
- **마일스톤**: M1
- **우선순위**: P0
- **의존성**: 없음 (독립 기능)
- **병렬 그룹**: A (F-01 ~ F-04 동시 구현 가능)

### 참조
- 인수조건: `docs/project/features.md` #F-03
- 시스템 설계: `docs/system/system-design.md` 섹션 3, 6.1
- ERD: `docs/system/erd.md` content_items 테이블
- API 컨벤션: `docs/system/api-conventions.md`
- **공통 인터페이스**: `docs/specs/F-01-tech-collector/design.md` 섹션 2 (ContentCollector, CollectedItem)

---

## 2. 수집 소스

### 2.1 네이버 실시간 급상승 검색어

- **수집 방법**: 네이버 데이터랩 API 또는 네이버 검색어 트렌드 페이지 HTML 파싱
- **주의**: 네이버 실시간 검색어 서비스가 공식 API로 제공되지 않을 수 있음. 대안:
  - (A) 네이버 데이터랩 쇼핑인사이트 API (`https://openapi.naver.com/v1/datalab/shopping/categories`) 활용
  - (B) 시그널 서비스 RSS/API 활용
  - (C) 네이버 연관검색어 페이지 파싱
- **결정**: 네이버 데이터랩 검색어 트렌드 API를 주 소스로 사용하고, 실시간 급상승은 HTML 파싱으로 보완
- **수집량**: TOP 20에서 상위 5개 선별 (AC1)
- **데이터 매핑**:
  - `channel`: `'culture'`
  - `source`: `'naver_realtime'`
  - `source_url`: `https://search.naver.com/search.naver?query={encoded_keyword}`
  - `title`: 검색어 키워드
  - `full_text`: 연관 이슈 설명 (있는 경우)
  - `tags`: `['realtime_search']`

### 2.2 네이버 데이터랩 API

- **API URL**: `https://openapi.naver.com/v1/datalab/search`
- **인증**: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 환경변수 필요
- **요청 형식**:
  ```json
  {
    "startDate": "2026-02-21",
    "endDate": "2026-02-28",
    "timeUnit": "date",
    "keywordGroups": [
      { "groupName": "트렌드", "keywords": ["트렌드 키워드"] }
    ]
  }
  ```
- **제한사항**: 키워드를 미리 알아야 조회 가능. 실시간 트렌드 탐지보다는 사전 등록된 키워드 모니터링에 적합
- **대안 전략**: 쇼핑 트렌드 API (`/v1/datalab/shopping/categories`)로 카테고리별 인기 상품 트렌드 수집
- **수집량**: TOP 10 (AC2)
- **데이터 매핑**:
  - `channel`: `'culture'`
  - `source`: `'naver_datalab'`
  - `source_url`: 관련 네이버 검색 URL
  - `title`: 트렌드 키워드/카테고리명
  - `tags`: `['datalab', 'shopping_trend']`

### 2.3 넷플릭스 한국 TOP 10

- **URL**: `https://www.netflix.com/tudum/top10` (한국 필터)
- **수집 방법**: HTML 파싱 (cheerio)
- **안정성**: 낮음. Netflix 웹사이트 구조 변경 빈번
- **대안**: Netflix TOP 10 비공식 API나 제3자 집계 사이트 활용
- **수집량**: 1위 콘텐츠 1개 (AC3)
- **데이터 매핑**:
  - `channel`: `'culture'`
  - `source`: `'netflix_kr'`
  - `source_url`: Netflix 콘텐츠 URL
  - `title`: `[넷플릭스 1위] {콘텐츠 제목}`
  - `tags`: `['netflix', 'streaming']`

### 2.4 멜론 실시간 차트

- **URL**: `https://www.melon.com/chart/index.htm`
- **수집 방법**: HTML 파싱 (cheerio)
- **User-Agent**: `Mozilla/5.0 ...` (일반 브라우저 에이전트) 필수. 봇 UA 차단 가능
- **Cookie**: `PCID` 쿠키가 필요할 수 있음
- **수집량**: TOP 5 (AC4)
- **데이터 매핑**:
  - `channel`: `'culture'`
  - `source`: `'melon'`
  - `source_url`: `https://www.melon.com/song/detail.htm?songId={id}`
  - `title`: `{순위}. {아티스트} - {곡명}`
  - `full_text`: 앨범명 (있는 경우)
  - `tags`: `['music', 'melon']`

### 2.5 유튜브 트렌딩 KR (YouTube Data API v3)

- **API URL**: `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=10`
- **인증**: `YOUTUBE_DATA_API_KEY` 환경변수 필요
- **기존 구현**: `lib/collectors/youtube.ts`에 기본 로직 완성됨
- **수집량**: TOP 10에서 상위 2개 선별 (AC5)
- **선별 기준**: 조회수(viewCount) 기준 상위 2개
- **데이터 매핑**:
  - `channel`: `'culture'`
  - `source`: `'youtube_trending'`
  - `source_url`: `https://www.youtube.com/watch?v={videoId}`
  - `title`: 영상 제목
  - `full_text`: 영상 설명 (처음 500자)
  - `tags`: `['youtube']` + 영상 카테고리
  - `published_at`: `snippet.publishedAt`

---

## 3. 아키텍처 결정

### 결정 1: 네이버 실시간 검색어 수집 방법

- **선택지**: A) 네이버 데이터랩 API / B) HTML 파싱 / C) 제3자 서비스
- **결정**: B) HTML 파싱을 1차 시도, 실패 시 A) 데이터랩 API로 폴백
- **근거**: 데이터랩 API는 사전 키워드가 필요하여 실시간 트렌드 탐지에 부적합. HTML 파싱은 불안정하지만 실시간성이 높음. 파싱 실패 시 데이터랩 API로 쇼핑 트렌드 대체

### 결정 2: 넷플릭스 파싱 불안정성 대응

- **선택지**: A) 파싱 구현 + 실패 허용 / B) 제3자 API 사용 / C) 수동 입력
- **결정**: A) 파싱 구현 + 실패 시 빈 결과 (safeCollect)
- **근거**: 1인 사용 프로젝트이므로 가끔 빈 결과도 허용 가능. 파싱 깨지면 수동으로 셀렉터 업데이트

### 결정 3: 멜론 차트 접근 전략

- **선택지**: A) 직접 HTML 파싱 / B) 멜론 API (비공식) / C) 제3자 차트 서비스
- **결정**: A) 직접 HTML 파싱 + User-Agent 위장
- **근거**: 비공식 API는 차단 리스크 동일. HTML 파싱이 가장 직접적. 차단 시 빈 결과 허용

---

## 4. 데이터 모델

### content_items 테이블 매핑

| CollectedItem 필드 | content_items 컬럼 | 변환 로직 |
|--------------------|--------------------|----------|
| `channel` | `channel` | 항상 `'culture'` |
| `source` | `source` | `'naver_realtime'`, `'naver_datalab'`, `'netflix_kr'`, `'melon'`, `'youtube_trending'` |
| `source_url` | `source_url` | 소스별 고유 URL (UNIQUE 제약) |
| `title` | `title` | 소스별 포맷 (순위 포함 등) |
| `full_text` | `full_text` | 추가 설명 텍스트 |
| `published_at` | `published_at` | 수집 시각 (대부분 실시간 데이터) |
| `tags` | `tags` | 소스 카테고리 태그 |

### source_url 고유성 전략

CULTURE 채널은 실시간 데이터가 많아 날짜별로 URL이 동일할 수 있다. source_url에 날짜를 포함하여 일별 고유성을 보장한다.

```typescript
// 예: 멜론 차트 source_url
`https://www.melon.com/song/detail.htm?songId=${songId}&date=${today}`

// 예: 네이버 실검 source_url
`https://search.naver.com/search.naver?query=${keyword}&date=${today}`
```

---

## 5. 인터페이스 설계

### CultureCollector 클래스

```typescript
// lib/collectors/culture-collector.ts

import type { ContentCollector, CollectorResult, CollectedItem, CollectorError } from './types';
import { safeCollect } from './utils';

export class CultureCollector implements ContentCollector {
  name = 'culture-collector';
  channel = 'culture' as const;

  async collect(): Promise<CollectorResult> {
    const errors: CollectorError[] = [];
    const allItems: CollectedItem[] = [];

    // 5개 소스 병렬 실행 (각각 독립 try/catch)
    const [realtime, datalab, netflix, melon, youtube] = await Promise.all([
      safeCollect('naver_realtime', () => collectNaverRealtime()),
      safeCollect('naver_datalab', () => collectNaverDatalabTrend()),
      safeCollect('netflix_kr', () => collectNetflixTop1()),
      safeCollect('melon', () => collectMelonChart()),
      safeCollect('youtube_trending', () => collectYouTubeTrendingTop2()),
    ]);

    // 결과 합산
    for (const result of [realtime, datalab, netflix, melon, youtube]) {
      allItems.push(...result.items);
      if (result.error) errors.push(result.error);
    }

    return { channel: 'culture', items: allItems, errors };
  }
}
```

### 소스별 함수 시그니처

```typescript
// lib/collectors/naver.ts
export async function collectNaverRealtime(): Promise<CollectedItem[]>;
export async function collectNaverDatalabTrend(): Promise<CollectedItem[]>;

// lib/collectors/netflix.ts
export async function collectNetflixTop1(): Promise<CollectedItem[]>;

// lib/collectors/melon.ts
export async function collectMelonChart(): Promise<CollectedItem[]>;

// lib/collectors/youtube.ts (기존 함수 래핑)
export async function collectYouTubeTrendingTop2(): Promise<CollectedItem[]>;
```

---

## 6. 구현 파일

### 6.1 신규 생성 파일

| 파일 경로 | 역할 |
|-----------|------|
| `lib/collectors/culture-collector.ts` | CULTURE 채널 오케스트레이터 (ContentCollector 구현) |

### 6.2 수정 필요 파일

| 파일 경로 | 변경 내용 |
|-----------|----------|
| `lib/collectors/naver.ts` | 스텁 -> 네이버 실시간 검색어 파싱 + 데이터랩 API 호출 구현. 공통 `CollectedItem` 반환 |
| `lib/collectors/melon.ts` | 스텁 -> 멜론 차트 HTML 파싱 구현. cheerio 사용, User-Agent 위장. TOP 5 반환 |
| `lib/collectors/netflix.ts` | 스텁 -> 넷플릭스 TOP 10 파싱 구현. 1위만 추출. 파싱 실패 시 빈 배열 |
| `lib/collectors/youtube.ts` | 기존 `collectYouTubeTrending` 리팩토링: 공통 `CollectedItem` 반환, 상위 2개 선별 함수 추가 |

### 6.3 의존 패키지

| 패키지 | 용도 |
|--------|------|
| `cheerio` | 멜론/넷플릭스/네이버 실검 HTML 파싱 (F-01에서도 사용) |

### 6.4 환경변수 의존성

| 환경변수 | 필수 여부 | 사용 소스 |
|----------|----------|----------|
| `NAVER_CLIENT_ID` | 선택 (데이터랩 사용 시) | 네이버 데이터랩 API |
| `NAVER_CLIENT_SECRET` | 선택 (데이터랩 사용 시) | 네이버 데이터랩 API |
| `YOUTUBE_DATA_API_KEY` | 필수 | YouTube Data API v3 |

- `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` 미설정 시 데이터랩 소스만 스킵 (다른 4개 소스 수집 계속)
- `YOUTUBE_DATA_API_KEY` 미설정 시 유튜브 소스 스킵 + 에러 로그

---

## 7. 에러 처리

### 소스별 안정성 등급

| 소스 | 안정성 | 실패 시 영향 | 대응 |
|------|--------|------------|------|
| 네이버 실검 | 낮음 (HTML 파싱) | 실검 데이터 누락 | 데이터랩 폴백 |
| 네이버 데이터랩 | 높음 (공식 API) | 트렌드 데이터 누락 | 환경변수 체크 후 스킵 |
| 넷플릭스 | 낮음 (HTML 파싱) | 넷플릭스 1위 누락 | safeCollect로 빈 결과 허용 |
| 멜론 | 중간 (HTML 파싱 + UA 필요) | 음악 차트 누락 | User-Agent 위장, 실패 시 빈 결과 |
| 유튜브 | 높음 (공식 API) | 유튜브 트렌딩 누락 | API 키 체크, 쿼터 모니터링 |

### 에러 유형별 처리

| 에러 유형 | 처리 방법 |
|-----------|----------|
| 환경변수 미설정 (NAVER_*, YOUTUBE_*) | 해당 소스 스킵 + 경고 로그 (에러 아님) |
| HTML 파싱 실패 (구조 변경) | safeCollect에서 빈 배열 + CollectorError |
| 403 Forbidden (멜론 봇 차단) | safeCollect에서 빈 배열 + CollectorError |
| YouTube API 쿼터 초과 (429) | safeCollect에서 빈 배열 + CollectorError |
| 네트워크 타임아웃 | 개별 소스 10초 타임아웃 후 실패 처리 |

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-28 | 초기 설계 작성 | F-03 CULTURE 채널 수집기 설계 |
