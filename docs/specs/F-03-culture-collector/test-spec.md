# F-03: CULTURE 채널 수집 -- 테스트 명세

## 참조
- 설계서: `docs/specs/F-03-culture-collector/design.md`
- 인수조건: `docs/project/features.md` #F-03
- 공통 인터페이스: `docs/specs/F-01-tech-collector/design.md` 섹션 2

---

## 단위 테스트

### 네이버 실시간 급상승 검색어 (`lib/collectors/naver.ts` - `collectNaverRealtime`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectNaverRealtime` | 정상 파싱 시 상위 5개 반환 | mock: 급상승 검색어 20개 HTML | `CollectedItem[]` 길이 5 |
| `collectNaverRealtime` | 모든 아이템의 channel이 'culture' | mock: 정상 HTML | 모든 item.channel === 'culture' |
| `collectNaverRealtime` | source가 'naver_realtime' | mock: 정상 HTML | 모든 item.source === 'naver_realtime' |
| `collectNaverRealtime` | source_url에 날짜 포함 | mock: 정상 HTML | source_url에 오늘 날짜 포함 (일별 고유성) |
| `collectNaverRealtime` | title이 검색 키워드 | mock: 키워드 '아이유' | item.title === '아이유' (또는 순위 포함) |
| `collectNaverRealtime` | tags에 'realtime_search' 포함 | mock: 정상 HTML | item.tags?.includes('realtime_search') |
| `collectNaverRealtime` | HTML 구조 변경 시 빈 배열 | mock: 매칭되지 않는 HTML | `CollectedItem[]` 길이 0 |
| `collectNaverRealtime` | 네트워크 오류 시 throw | mock: fetch 실패 | Error throw |

### 네이버 데이터랩 API (`lib/collectors/naver.ts` - `collectNaverDatalabTrend`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectNaverDatalabTrend` | 정상 API 응답 시 TOP 10 반환 | mock: 데이터랩 API 정상 응답 | `CollectedItem[]` 길이 <= 10 |
| `collectNaverDatalabTrend` | NAVER_CLIENT_ID 미설정 시 빈 배열 | 환경변수 미설정 | `CollectedItem[]` 길이 0 + 경고 로그 |
| `collectNaverDatalabTrend` | NAVER_CLIENT_SECRET 미설정 시 빈 배열 | 환경변수 미설정 | `CollectedItem[]` 길이 0 + 경고 로그 |
| `collectNaverDatalabTrend` | API 인증 실패 (401) | mock: 401 응답 | Error throw |
| `collectNaverDatalabTrend` | source가 'naver_datalab' | mock: 정상 응답 | 모든 item.source === 'naver_datalab' |
| `collectNaverDatalabTrend` | tags에 'datalab' 포함 | mock: 정상 응답 | item.tags?.includes('datalab') |

### 넷플릭스 TOP 10 (`lib/collectors/netflix.ts` - `collectNetflixTop1`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectNetflixTop1` | 정상 파싱 시 1위만 반환 | mock: TOP 10 HTML | `CollectedItem[]` 길이 1 |
| `collectNetflixTop1` | channel이 'culture' | mock: 정상 HTML | item.channel === 'culture' |
| `collectNetflixTop1` | source가 'netflix_kr' | mock: 정상 HTML | item.source === 'netflix_kr' |
| `collectNetflixTop1` | title 형식 | mock: 1위 '오징어게임' | `title === '[넷플릭스 1위] 오징어게임'` |
| `collectNetflixTop1` | tags에 'netflix', 'streaming' 포함 | mock: 정상 HTML | tags 확인 |
| `collectNetflixTop1` | HTML 파싱 실패 시 빈 배열 | mock: 구조 변경된 HTML | `CollectedItem[]` 길이 0 |
| `collectNetflixTop1` | 404 응답 시 throw | mock: fetch 404 | Error throw |

### 멜론 차트 (`lib/collectors/melon.ts` - `collectMelonChart`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectMelonChart` | 정상 파싱 시 TOP 5 반환 | mock: 차트 HTML | `CollectedItem[]` 길이 5 |
| `collectMelonChart` | channel이 'culture' | mock: 정상 HTML | 모든 item.channel === 'culture' |
| `collectMelonChart` | source가 'melon' | mock: 정상 HTML | 모든 item.source === 'melon' |
| `collectMelonChart` | title 형식 (순위.아티스트-곡명) | mock: 1위 아이유 - Blueming | `title === '1. 아이유 - Blueming'` |
| `collectMelonChart` | source_url에 songId 포함 | mock: songId=12345 | `source_url.includes('songId=12345')` |
| `collectMelonChart` | User-Agent 헤더 전송 확인 | mock: fetch 호출 검증 | User-Agent가 브라우저 형태 |
| `collectMelonChart` | 403 봇 차단 시 throw | mock: fetch 403 응답 | Error throw |
| `collectMelonChart` | HTML 구조 변경 시 빈 배열 | mock: 매칭 안 되는 HTML | `CollectedItem[]` 길이 0 |
| `collectMelonChart` | tags에 'music', 'melon' 포함 | mock: 정상 HTML | tags 확인 |

### 유튜브 트렌딩 (`lib/collectors/youtube.ts` - `collectYouTubeTrendingTop2`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectYouTubeTrendingTop2` | 정상 API 응답 시 상위 2개 반환 | mock: 10개 영상 데이터 | `CollectedItem[]` 길이 2 |
| `collectYouTubeTrendingTop2` | channel이 'culture' | mock: 정상 데이터 | 모든 item.channel === 'culture' |
| `collectYouTubeTrendingTop2` | source가 'youtube_trending' | mock: 정상 데이터 | 모든 item.source === 'youtube_trending' |
| `collectYouTubeTrendingTop2` | source_url 형식 | mock: videoId='abc123' | `source_url === 'https://www.youtube.com/watch?v=abc123'` |
| `collectYouTubeTrendingTop2` | published_at 파싱 | mock: publishedAt ISO 문자열 | 유효한 Date 객체 |
| `collectYouTubeTrendingTop2` | YOUTUBE_DATA_API_KEY 미설정 시 빈 배열 | 환경변수 미설정 | `CollectedItem[]` 길이 0 + 에러 로그 |
| `collectYouTubeTrendingTop2` | API 오류 (403/429) 시 throw | mock: 403 응답 | Error throw |
| `collectYouTubeTrendingTop2` | API 응답에 items가 빈 배열 | mock: `{ items: [] }` | `CollectedItem[]` 길이 0 |
| `collectYouTubeTrendingTop2` | full_text가 500자로 잘림 | mock: 1000자 description | `full_text.length <= 500` |

### CultureCollector 오케스트레이터 (`lib/collectors/culture-collector.ts`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `CultureCollector.collect` | 5개 소스 모두 성공 | mock: 각 소스 정상 | `items.length > 0`, `errors.length === 0` |
| `CultureCollector.collect` | 2개 소스 실패(넷플릭스+멜론), 3개 성공 | mock: 해당 소스 throw | items에 성공 3개 소스 데이터, `errors.length === 2` |
| `CultureCollector.collect` | 5개 소스 모두 실패 | mock: 5개 모두 throw | `items.length === 0`, `errors.length === 5` |
| `CultureCollector.collect` | 환경변수 미설정 소스 제외 | mock: NAVER/YOUTUBE 키 없음 | 해당 소스만 빈 결과, 나머지 정상 |
| `CultureCollector.collect` | 병렬 실행 확인 | mock: 각 소스 100ms 지연 | 전체 소요 시간 ~100ms |
| `CultureCollector.collect` | 모든 아이템의 channel이 'culture' | mock: 정상 데이터 | 모든 item.channel === 'culture' |
| `CultureCollector.name` | 이름 확인 | - | `'culture-collector'` |
| `CultureCollector.channel` | 채널 확인 | - | `'culture'` |

---

## 통합 테스트

### Supabase content_items 저장

| API | 시나리오 | 입력 | 예상 결과 |
|-----|----------|------|-----------|
| DB 저장 | CULTURE 수집 결과 저장 | CollectedItem 13개 (5+10+1+5+2) | content_items 행 추가, channel='culture' |
| DB 저장 | source_url UNIQUE 중복 방지 | 동일 source_url 재수집 | 기존 행 유지 |
| DB 저장 | 날짜 포함 source_url 일별 고유성 | 같은 콘텐츠 다른 날짜 | 별도 행으로 저장 |
| DB 저장 | tags 배열 저장 | `tags: ['music', 'melon']` | TEXT[] 정상 저장 |

---

## 경계 조건 / 에러 케이스

### 네이버 실시간 검색어
- 네이버가 실시간 검색어 서비스를 종료/변경한 경우 -> HTML 파싱 실패, 데이터랩 폴백
- 검색어가 특수문자를 포함하는 경우 -> URL 인코딩 처리
- 검색어가 20개 미만인 경우 -> 있는 만큼만 반환

### 네이버 데이터랩
- API 일일 호출 제한 초과 시 -> 429 에러, safeCollect에서 처리
- 쇼핑 트렌드 카테고리 목록이 변경된 경우 -> 응답 형식 변경에 대한 방어 파싱

### 넷플릭스
- 한국 TOP 10 데이터가 없는 경우 (서비스 일시 중단) -> 빈 배열
- HTML 구조가 JavaScript 렌더링 필요한 경우 -> 서버사이드 파싱 불가, 빈 배열 + 에러 로그

### 멜론
- 실시간 차트가 일시적으로 비어있는 경우 (새벽 시간 등) -> 빈 배열
- 차트 페이지가 로그인을 요구하는 경우 -> 403/302 응답, safeCollect 처리
- 곡 ID가 변경되는 경우 -> source_url 고유성에 영향 없음 (날짜 포함)

### 유튜브
- API 쿼터 10,000 units 초과 -> 1일 1회 호출이므로 현실적으로 불가능
- 트렌딩 영상이 2개 미만인 경우 -> 있는 만큼만 반환

### 공통
- 모든 소스가 동시에 실패 -> `items` 빈 배열, `errors`에 5개 기록
- HTML 파싱 소스(네이버실검/넷플릭스/멜론) 3개 동시 실패 -> API 소스(데이터랩/유튜브)만 결과 반환

---

## 모킹 전략

### 외부 API 모킹 대상

| 소스 | 모킹 대상 | 방법 |
|------|-----------|------|
| 네이버 실검 | `global.fetch` | HTML fixture 응답 |
| 네이버 데이터랩 | `global.fetch` | JSON fixture 응답 |
| 넷플릭스 | `global.fetch` | HTML fixture 응답 |
| 멜론 | `global.fetch` | HTML fixture 응답 + User-Agent 검증 |
| 유튜브 | `global.fetch` | JSON fixture 응답 |
| Supabase | `@supabase/supabase-js` | client 메서드 모킹 |

### fixture 파일 목록

```
__tests__/fixtures/
  culture/
    naver-realtime.html       # 급상승 검색어 20개 HTML
    naver-realtime-empty.html # 빈 페이지
    naver-datalab.json        # 데이터랩 API 정상 응답
    naver-datalab-error.json  # 데이터랩 API 에러 응답
    netflix-top10.html        # 넷플릭스 TOP 10 HTML
    netflix-changed.html      # 구조 변경된 HTML (파싱 실패 케이스)
    melon-chart.html          # 멜론 차트 HTML
    melon-blocked.html        # 봇 차단 응답
    youtube-trending.json     # YouTube API 정상 응답 (10개 영상)
    youtube-empty.json        # YouTube API 빈 응답
```
