# F-02: WORLD 채널 수집 -- 테스트 명세

## 참조
- 설계서: `docs/specs/F-02-world-collector/design.md`
- 인수조건: `docs/project/features.md` #F-02
- 공통 인터페이스: `docs/specs/F-01-tech-collector/design.md` 섹션 2

---

## 단위 테스트

### WorldCollector 오케스트레이터 (`lib/collectors/world-collector.ts`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `WorldCollector.collect` | 7개 RSS 피드 모두 성공 | mock: 각 피드에 아이템 반환 | `items.length > 0`, `errors.length === 0` |
| `WorldCollector.collect` | 일부 피드 실패 시 나머지 계속 | mock: naver_politics 실패, 나머지 성공 | `items.length > 0`, 성공한 피드 데이터 포함 |
| `WorldCollector.collect` | 모든 피드 실패 | mock: 7개 모두 실패 | `items.length === 0`, `errors.length >= 1` |
| `WorldCollector.collect` | 모든 아이템의 channel이 'world' | mock: 정상 데이터 | 모든 item.channel === 'world' |
| `WorldCollector.collect` | source가 올바르게 매핑됨 | mock: 각 피드별 데이터 | naver_politics, naver_economy, daum_news 등 |
| `WorldCollector.collect` | 카테고리 태그 추출 | mock: naver_politics 소스 아이템 | `tags.includes('politics')` |
| `WorldCollector.collect` | 상위 15개 이하로 선별 | mock: 총 200개 아이템 | `items.length <= 15` |
| `WorldCollector.name` | 이름 확인 | - | `'world-collector'` |
| `WorldCollector.channel` | 채널 확인 | - | `'world'` |

### 교차 소스 이슈 중복 가중치 (`scoreByCrossSourceAppearance`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `scoreByCrossSourceAppearance` | 동일 이슈 3개 소스 등장 | "윤 대통령 탄핵" 제목이 네이버/다음/연합에서 등장 | 해당 이슈 그룹의 crossSourceScore >= 3 |
| `scoreByCrossSourceAppearance` | 단일 소스 이슈 | 특정 제목이 1개 소스에서만 등장 | crossSourceScore === 1 |
| `scoreByCrossSourceAppearance` | 유사 제목 매칭 | "삼성전자 반도체 투자 확대" vs "삼성전자, 반도체 투자 20조" | 동일 이슈로 판정 (키워드 교집합 > 0.5) |
| `scoreByCrossSourceAppearance` | 완전 다른 제목 | "기후변화 대응" vs "프로야구 개막" | 다른 이슈로 판정 (키워드 교집합 < 0.5) |
| `scoreByCrossSourceAppearance` | 교차 소스 점수 내림차순 정렬 | 여러 이슈 그룹 | crossSourceScore 높은 순 정렬 |
| `scoreByCrossSourceAppearance` | 동일 점수 시 최신순 | 같은 crossSourceScore | published_at 최신 우선 |
| `scoreByCrossSourceAppearance` | 빈 배열 입력 | `[]` | `[]` 반환 |
| `scoreByCrossSourceAppearance` | 단일 아이템 | 아이템 1개 | crossSourceScore === 1, 해당 아이템 반환 |

### 카테고리 태그 추출 (`extractCategoryTag`)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `extractCategoryTag` | 네이버 정치 | `'naver_politics'` | `['politics']` |
| `extractCategoryTag` | 네이버 경제 | `'naver_economy'` | `['economy']` |
| `extractCategoryTag` | 네이버 사회 | `'naver_society'` | `['society']` |
| `extractCategoryTag` | 네이버 IT | `'naver_it'` | `['it_science']` |
| `extractCategoryTag` | 다음 뉴스 | `'daum_news'` | `['general']` |
| `extractCategoryTag` | 연합뉴스 | `'yonhap'` | `['general']` |
| `extractCategoryTag` | BBC Korea | `'bbc_korea'` | `['international']` |
| `extractCategoryTag` | 미등록 소스 | `'unknown_source'` | `[]` |

### RSS 수집 연동 (기존 rss.ts 테스트)

| 대상 | 시나리오 | 입력 | 예상 결과 |
|------|----------|------|-----------|
| `collectMultipleRssFeeds` | WORLD 피드 설정 7개 전달 | WORLD_RSS_FEEDS 배열 | 7개 피드 병렬 호출 |
| `collectMultipleRssFeeds` | 네이버 정치 RSS 20개 제한 | config: `{ limit: 20 }` | 최대 20개 아이템 반환 |
| `collectMultipleRssFeeds` | 다음 뉴스 RSS 50개 제한 | config: `{ limit: 50 }` | 최대 50개 아이템 반환 |
| `collectMultipleRssFeeds` | 연합뉴스 RSS 100개 제한 | config: `{ limit: 100 }` | 최대 100개 아이템 반환 |

---

## 통합 테스트

### Supabase content_items 저장

| API | 시나리오 | 입력 | 예상 결과 |
|-----|----------|------|-----------|
| DB 저장 | WORLD 수집 결과 저장 | CollectedItem 15개 | content_items 15행, channel='world' |
| DB 저장 | source_url UNIQUE 중복 방지 | 동일 URL 재수집 시도 | 기존 행 유지, 신규 행만 추가 |
| DB 저장 | 교차 소스 동일 이슈의 다른 URL | 같은 이슈지만 source_url 다름 | 별도 행으로 저장 (중복 이슈 != 중복 URL) |
| DB 저장 | tags 배열 정상 저장 | `tags: ['politics']` | PostgreSQL TEXT[] 정상 저장/조회 |

---

## 경계 조건 / 에러 케이스

### RSS 피드 관련
- 네이버 뉴스 RSS URL이 변경/폐지된 경우 -> 해당 섹션만 빈 결과, 나머지 섹션 계속
- RSS 아이템에 pubDate가 없는 경우 -> `published_at = undefined`, 최신순 정렬에서 후순위
- RSS 아이템 제목이 HTML 엔티티로 인코딩된 경우 -> rss-parser가 자동 디코딩
- RSS 피드가 0개 아이템을 반환하는 경우 -> 해당 피드 빈 결과, 에러 아님

### 교차 소스 가중치 관련
- 모든 아이템의 제목이 고유한 경우 (교차 없음) -> 모든 crossSourceScore === 1, 최신순 정렬
- 한 이슈가 7개 소스 모두에서 등장하는 경우 (속보) -> crossSourceScore === 7, 최우선 선정
- 한국어 제목의 조사/접속사 처리 -> "의", "를", "이", "가" 등 불용어 제거 후 키워드 비교
- 영어 제목(BBC Korea에서) 처리 -> 영어 불용어(the, a, is 등) 제거 후 비교

### 선별 관련
- 수집된 아이템이 15개 미만인 경우 -> 전체 반환 (추가 필터링 없음)
- 네이버 4개 섹션이 모두 같은 이슈만 보도하는 경우 -> 교차 점수 높은 1~2개로 압축

---

## 모킹 전략

### 외부 API 모킹 대상

| 소스 | 모킹 대상 | 방법 |
|------|-----------|------|
| 네이버 뉴스 RSS (4개) | `rss-parser` | `Parser.prototype.parseURL` 모킹, 섹션별 fixture |
| 다음 뉴스 RSS | `rss-parser` | 동일 |
| 연합뉴스 RSS | `rss-parser` | 동일 |
| BBC Korea RSS | `rss-parser` | 동일 |
| Supabase | `@supabase/supabase-js` | client 메서드 모킹 |

### fixture 파일 목록

```
__tests__/fixtures/
  world/
    naver-politics.xml     # 정치 RSS 20개 아이템
    naver-economy.xml      # 경제 RSS 20개 아이템
    naver-society.xml      # 사회 RSS 20개 아이템
    naver-it.xml           # IT RSS 20개 아이템
    daum-news.xml          # 다음 주요뉴스 50개
    yonhap.xml             # 연합뉴스 100개
    bbc-korea.xml          # BBC Korea 30개
    cross-source-issue.json # 교차 소스 이슈 테스트용 (동일 이슈 여러 소스)
```
