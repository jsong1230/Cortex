# F-03: CULTURE 채널 수집 — 구현 계획

## 참조
- 설계서: docs/specs/F-03-culture-collector/design.md
- 인수조건: docs/project/features.md #F-03

## 태스크

### [backend] 네이버 실시간 검색어 + 데이터랩 수집기 구현
- [x] lib/collectors/naver.ts — collectNaverRealtime 함수 구현 (HTML 파싱 1차, 실패 시 데이터랩 폴백, TOP 20 중 상위 5개, source_url에 날짜 포함), collectNaverDatalabTrend 함수 구현 (NAVER_CLIENT_ID/SECRET 환경변수 체크, 쇼핑 트렌드 API 활용, TOP 10, 미설정 시 스킵)

### [backend] 넷플릭스 수집기 구현
- [x] lib/collectors/netflix.ts — collectNetflixTop1 함수 구현 (cheerio 기반 HTML 파싱, 한국 TOP 10에서 1위만 추출, 파싱 실패 시 빈 배열 반환)

### [backend] 멜론 차트 수집기 구현
- [x] lib/collectors/melon.ts — collectMelonChart 함수 구현 (cheerio 기반 HTML 파싱, Mozilla User-Agent 위장, TOP 5 추출, source_url에 날짜 포함, 403 차단 시 빈 배열 반환)

### [backend] 유튜브 트렌딩 수집기 수정
- [x] lib/collectors/youtube.ts — 기존 collectYouTubeTrending 리팩토링: 공통 CollectedItem 반환, collectYouTubeTrendingTop2 함수 추가 (조회수 기준 상위 2개 선별), YOUTUBE_DATA_API_KEY 미설정 시 에러 로그 + 빈 배열

### [backend] CULTURE 채널 오케스트레이터
- [x] lib/collectors/culture-collector.ts — CultureCollector 클래스 구현 (ContentCollector 인터페이스), 5개 소스 병렬 실행 (naver_realtime/naver_datalab/netflix_kr/melon/youtube_trending), safeCollect 적용

### [backend] 테스트
- [x] tests/unit/collectors/naver.test.ts — 실시간 검색어 파싱(AC1), 데이터랩 TOP 10(AC2), 환경변수 미설정 시 스킵 단위 테스트
- [x] tests/unit/collectors/culture-collector.test.ts — 5개 소스 병렬 수집, 개별 소스 실패 시 다른 소스 계속 진행 단위 테스트

## 태스크 의존성
F-01의 types.ts, utils.ts ──▶ 개별 소스 수집기 구현 ──▶ CultureCollector 오케스트레이터 ──▶ 테스트

## 병렬 실행 판단
- Agent Team 권장: No
- 근거: 프론트엔드 변경 없음, 백엔드 단일 에이전트로 처리. F-01의 공통 인터페이스(types.ts, utils.ts) 완성 후 구현 가능
