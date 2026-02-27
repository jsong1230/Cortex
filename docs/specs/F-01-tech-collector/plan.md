# F-01: TECH 채널 수집 — 구현 계획

## 참조
- 설계서: docs/specs/F-01-tech-collector/design.md
- 인수조건: docs/project/features.md #F-01

## 태스크

### [backend] 공통 인터페이스 (F-01만 해당)
- [x] lib/collectors/types.ts — Channel, CollectedItem, CollectorError, CollectorResult, ContentCollector 타입/인터페이스 정의
- [x] lib/collectors/utils.ts — safeCollect 래퍼 함수 구현

### [backend] Hacker News 수집기 구현
- [x] lib/collectors/hackernews.ts — 자체 CollectedItem 제거, 공통 타입 import, 필드명 snake_case 변환 (sourceUrl -> source_url, publishedAt -> published_at, fullText -> full_text)

### [backend] GitHub Trending 수집기 구현
- [x] lib/collectors/github.ts — cheerio 기반 파싱 구현 (article.Box-row 셀렉터), User-Agent 설정, 일별 트렌딩 상위 20개 반환

### [backend] RSS 수집기 수정
- [x] lib/collectors/rss.ts — RssCollectedItem -> CollectedItem 변환 함수 추가, TECH 전용 RSS 설정 분리 (피드당 최신 5개)

### [backend] TECH 채널 오케스트레이터
- [x] lib/collectors/tech-collector.ts — TechCollector 클래스 구현 (ContentCollector 인터페이스), HN/GitHub/RSS 3개 소스 병렬 실행, safeCollect 적용

### [backend] 테스트
- [x] tests/unit/collectors/hackernews.test.ts — HN API 응답 파싱, 상위 10개 필터링 단위 테스트
- [x] tests/unit/collectors/github.test.ts — GitHub Trending HTML 파싱, 20개 수집 단위 테스트
- [x] tests/unit/collectors/tech-collector.test.ts — 소스 실패 시 다른 소스 계속 진행(AC6) 통합 테스트

## 태스크 의존성
공통 인터페이스 (types.ts, utils.ts) ──▶ 개별 수집기 구현 ──▶ TechCollector 오케스트레이터 ──▶ 테스트

## 병렬 실행 판단
- Agent Team 권장: No
- 근거: 프론트엔드 변경 없음, 백엔드 단일 에이전트로 처리. 공통 인터페이스(types.ts, utils.ts)가 먼저 완성되어야 개별 수집기 구현 가능하므로 순차 진행
