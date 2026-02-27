# F-04: TORONTO 채널 수집 — 구현 계획

## 참조
- 설계서: docs/specs/F-04-toronto-collector/design.md
- 인수조건: docs/project/features.md #F-04

## 태스크

### [backend] 토론토 뉴스 필터 수정
- [x] lib/collectors/toronto-news.ts — filterTorontoNews 함수의 입력 타입을 공통 CollectedItem으로 변경, 기존 TorontoNewsItem 인터페이스 제거, 토론토 키워드 매칭 0건 시 최신순 fallback

### [backend] RSS 수집기 정비
- [x] lib/collectors/rss.ts — TORONTO 전용 RSS 설정(Toronto Star, CBC Canada)을 toronto-collector.ts로 이동

### [backend] 날씨 수집기 확인
- [x] lib/collectors/weather.ts — getTorontoWeather 함수 변경 없이 재사용 확인, OPENWEATHER_API_KEY 미설정 시 throw 동작 검증

### [backend] TORONTO 채널 오케스트레이터
- [x] lib/collectors/toronto-collector.ts — TorontoCollector 클래스 구현 (ContentCollector 인터페이스), TORONTO_RSS_FEEDS 설정 (Toronto Star 30개/CBC Canada 30개), 3개 소스 병렬 실행 (toronto_star/cbc_canada/weather_toronto), safeCollect 적용, collectTorontoStar/collectCBC (filterTorontoNews 적용, 상위 2개), collectWeather (날씨 데이터 CollectedItem 변환, source_url에 날짜 포함), inferTags 함수 (토론토 키워드 기반 태그 추론)

### [backend] 테스트
- [x] tests/unit/collectors/toronto-collector.test.ts — Toronto Star/CBC RSS 수집 및 필터링(AC1, AC2), 날씨 데이터 CollectedItem 변환(AC3), OPENWEATHER_API_KEY 미설정 시 뉴스 소스 계속 진행, source_url 날짜 고유성 단위 테스트

## 태스크 의존성
F-01의 types.ts, utils.ts ──▶ toronto-news.ts 수정 + rss.ts 정비 + weather.ts 확인 ──▶ TorontoCollector 오케스트레이터 ──▶ 테스트

## 병렬 실행 판단
- Agent Team 권장: No
- 근거: 프론트엔드 변경 없음, 백엔드 단일 에이전트로 처리. F-01의 공통 인터페이스(types.ts, utils.ts) 완성 후 구현 가능
