# F-04: TORONTO 채널 수집 -- 테스트 명세

## 참조
- 설계서: `docs/specs/F-04-toronto-collector/design.md`
- 인수조건: `docs/project/features.md` #F-04
- 공통 인터페이스: `docs/specs/F-01-tech-collector/design.md` 섹션 2

---

## 단위 테스트

### Toronto Star RSS 수집 (`TorontoCollector.collectTorontoStar`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectTorontoStar` | 정상 RSS 파싱 후 상위 2개 반환 | mock: 30개 RSS 아이템 | `CollectedItem[]` 길이 2 |
| `collectTorontoStar` | 토론토 키워드 포함 기사 우선 | mock: 'Toronto transit' 제목 포함 | 키워드 매칭 기사가 상위 |
| `collectTorontoStar` | 토론토 키워드 없을 때 최신순 | mock: 토론토 키워드 없는 30개 | 최신 2개 반환 |
| `collectTorontoStar` | channel이 'canada' | mock: 정상 데이터 | 모든 item.channel === 'canada' |
| `collectTorontoStar` | source가 'toronto_star' | mock: 정상 데이터 | 모든 item.source === 'toronto_star' |
| `collectTorontoStar` | 토론토 관련 기사에 tags=['toronto'] | mock: 'toronto' 포함 제목 | item.tags?.includes('toronto') |
| `collectTorontoStar` | 캐나다 일반 기사에 tags=['canada'] | mock: 토론토 키워드 없는 제목 | item.tags?.includes('canada') |
| `collectTorontoStar` | RSS 피드 0개 아이템 | mock: 빈 피드 | `CollectedItem[]` 길이 0 |
| `collectTorontoStar` | RSS 피드 오류 시 throw | mock: rss-parser throw | Error throw |

### CBC Canada RSS 수집 (`TorontoCollector.collectCBC`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectCBC` | 정상 RSS 파싱 후 상위 2개 반환 | mock: 30개 RSS 아이템 | `CollectedItem[]` 길이 2 |
| `collectCBC` | 토론토 키워드 포함 기사 우선 | mock: 'Ontario lockdown' 제목 | 키워드 매칭 기사 우선 |
| `collectCBC` | channel이 'canada' | mock: 정상 데이터 | 모든 item.channel === 'canada' |
| `collectCBC` | source가 'cbc_canada' | mock: 정상 데이터 | 모든 item.source === 'cbc_canada' |
| `collectCBC` | RSS 피드 오류 시 throw | mock: rss-parser throw | Error throw |

### 토론토 날씨 수집 (`TorontoCollector.collectWeather`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectWeather` | 정상 API 응답 시 1개 반환 | mock: 날씨 데이터 정상 | `CollectedItem[]` 길이 1 |
| `collectWeather` | channel이 'canada' | mock: 정상 데이터 | item.channel === 'canada' |
| `collectWeather` | source가 'weather_toronto' | mock: 정상 데이터 | item.source === 'weather_toronto' |
| `collectWeather` | source_url에 오늘 날짜 포함 | mock: 정상 데이터 | source_url에 '2026-02-28' 포함 |
| `collectWeather` | title 형식 | mock: `{ conditionKr: '맑음', temperature: -5, feelsLike: -10 }` | `title === '[토론토 날씨] 맑음 -5C (체감 -10C)'` |
| `collectWeather` | full_text에 습도/풍속 포함 | mock: `{ humidity: 60, windSpeed: 5.2 }` | full_text에 '습도 60%', '풍속 5.2m/s' 포함 |
| `collectWeather` | tags에 'weather', 'toronto' 포함 | mock: 정상 데이터 | `tags === ['weather', 'toronto']` |
| `collectWeather` | OPENWEATHER_API_KEY 미설정 시 throw | 환경변수 미설정 | Error throw |
| `collectWeather` | API 오류 (401) 시 throw | mock: 401 응답 | Error throw |
| `collectWeather` | API 오류 (500) 시 throw | mock: 500 응답 | Error throw |

### 토론토 키워드 필터링 (`lib/collectors/toronto-news.ts` - `filterTorontoNews`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `filterTorontoNews` | 토론토 키워드 포함 우선 | 'Toronto TTC delay' + 'Canada GDP' | 토론토 기사가 1순위 |
| `filterTorontoNews` | 대소문자 무시 | 'TORONTO weather' | 토론토 관련으로 판정 |
| `filterTorontoNews` | 'ontario' 키워드 매칭 | 'Ontario government announces...' | 토론토 관련으로 판정 |
| `filterTorontoNews` | 'ttc' 키워드 매칭 | 'TTC service disruption' | 토론토 관련으로 판정 |
| `filterTorontoNews` | 'gta' 키워드 매칭 | 'GTA housing market' | 토론토 관련으로 판정 |
| `filterTorontoNews` | 'york region' 키워드 매칭 | 'York Region school closure' | 토론토 관련으로 판정 |
| `filterTorontoNews` | 키워드 미매칭 | 'Vancouver earthquake' | 토론토 비관련 (후순위) |
| `filterTorontoNews` | limit 적용 | 10개 아이템, limit=2 | 2개만 반환 |
| `filterTorontoNews` | 빈 배열 입력 | `[]` | `[]` 반환 |
| `filterTorontoNews` | 모든 아이템이 토론토 관련 | 5개 모두 키워드 포함, limit=2 | 상위 2개 반환 |
| `filterTorontoNews` | 토론토 관련 0개, limit=2 | 5개 모두 비관련 | 원본 순서 상위 2개 |

### TorontoCollector 오케스트레이터 (`lib/collectors/toronto-collector.ts`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `TorontoCollector.collect` | 3개 소스 모두 성공 | mock: Star 2개 + CBC 2개 + 날씨 1개 | `items.length === 5`, `errors.length === 0` |
| `TorontoCollector.collect` | Toronto Star 실패, 나머지 성공 | mock: Star throw, CBC 2개, 날씨 1개 | `items.length === 3`, `errors.length === 1` |
| `TorontoCollector.collect` | 날씨 실패, 뉴스 성공 | mock: 날씨 throw, Star 2개, CBC 2개 | `items.length === 4`, `errors.length === 1` |
| `TorontoCollector.collect` | 3개 소스 모두 실패 | mock: 3개 모두 throw | `items.length === 0`, `errors.length === 3` |
| `TorontoCollector.collect` | 병렬 실행 확인 | mock: 각 소스 100ms 지연 | 전체 소요 시간 ~100ms |
| `TorontoCollector.collect` | 모든 아이템의 channel이 'canada' | mock: 정상 데이터 | 모든 item.channel === 'canada' |
| `TorontoCollector.name` | 이름 확인 | - | `'toronto-collector'` |
| `TorontoCollector.channel` | 채널 확인 | - | `'canada'` |

### 태그 추론 (`TorontoCollector.inferTags`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `inferTags` | 토론토 키워드 포함 | 'Toronto transit delay' | `['toronto']` |
| `inferTags` | 온타리오 키워드 포함 | 'Ontario budget 2026' | `['toronto']` |
| `inferTags` | 캐나다 일반 (키워드 없음) | 'Canada GDP growth' | `['canada']` |
| `inferTags` | 대소문자 무시 | 'TORONTO WEATHER' | `['toronto']` |

---

## 통합 테스트

### Supabase content_items 저장

| API | 시나리오 | 입력 | 예상 결과 |
|-----|----------|------|-----------|
| DB 저장 | TORONTO 수집 결과 저장 | CollectedItem 5개 (뉴스 4 + 날씨 1) | content_items 5행, channel='canada' |
| DB 저장 | source_url UNIQUE 중복 방지 | 동일 URL 재수집 | 기존 행 유지 |
| DB 저장 | 날씨 source_url 일별 고유성 | 같은 날 재수집 | 중복 무시 (같은 날짜 URL) |
| DB 저장 | 다른 날 날씨 수집 | 다음 날 수집 | 새 행 추가 (다른 날짜 URL) |
| DB 저장 | tags 배열 정상 저장 | `tags: ['weather', 'toronto']` | TEXT[] 정상 저장/조회 |

### 날씨 + 뉴스 조합 조회

| API | 시나리오 | 입력 | 예상 결과 |
|-----|----------|------|-----------|
| DB 조회 | 오늘 날씨 조회 | `channel='canada' AND source='weather_toronto'` | 1행 반환 |
| DB 조회 | 오늘 캐나다 뉴스 조회 | `channel='canada' AND source != 'weather_toronto'` | 4행 반환 |

---

## 경계 조건 / 에러 케이스

### Toronto Star RSS
- RSS URL 변경 (thestar.com 리뉴얼) -> 빈 결과 + 에러 로그
- RSS 아이템 30개 미만 -> 있는 만큼 필터링
- RSS 아이템 0개 -> 빈 결과 (에러 아님)

### CBC Canada RSS
- CBC RSS가 일시적으로 캐나다 뉴스 대신 국제 뉴스만 포함 -> 토론토 키워드 매칭 0건, 최신순 반환
- RSS 피드 형식 변경 -> rss-parser 파싱 실패, safeCollect 처리

### 토론토 날씨
- OpenWeatherMap 무료 플랜 일일 호출 제한 (60회/분) -> 1일 1회이므로 현실적으로 불가
- 날씨 API가 Toronto 도시를 인식 못 하는 경우 -> 404 응답, safeCollect 처리
- 영하 온도 표시 (-30C 등) -> 음수 정상 처리
- 강설량/강우량 데이터 없는 경우 (맑은 날) -> `snow`, `rain` undefined, 정상 처리
- 날씨 상태 한국어 번역 누락 -> `conditionKr`이 영어로 반환될 수 있음, 그대로 표시

### 공통
- 3개 소스 모두 실패 시 -> `items` 빈 배열, `errors`에 3개 기록
- Vercel 함수 타임아웃 접근 시 -> RSS 10초 + 날씨 API 10초, 병렬이므로 ~10초 이내

---

## 모킹 전략

### 외부 API 모킹 대상

| 소스 | 모킹 대상 | 방법 |
|------|-----------|------|
| Toronto Star RSS | `rss-parser` | `Parser.prototype.parseURL` 모킹 |
| CBC Canada RSS | `rss-parser` | `Parser.prototype.parseURL` 모킹 |
| OpenWeatherMap | `global.fetch` | JSON fixture 응답 |
| Supabase | `@supabase/supabase-js` | client 메서드 모킹 |

### fixture 파일 목록

```
__tests__/fixtures/
  toronto/
    toronto-star.xml          # Toronto Star RSS 30개 아이템 (토론토 키워드 포함)
    toronto-star-no-local.xml # 토론토 키워드 없는 RSS
    cbc-canada.xml            # CBC Canada RSS 30개 아이템
    cbc-canada-empty.xml      # 빈 RSS 피드
    weather-sunny.json        # 맑은 날씨 API 응답
    weather-blizzard.json     # 폭설 날씨 API 응답 (snow >= 15)
    weather-coldsnap.json     # 한파 날씨 API 응답 (temp <= -20)
    weather-error.json        # API 에러 응답
```
