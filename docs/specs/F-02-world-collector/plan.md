# F-02: WORLD 채널 수집 — 구현 계획

## 참조
- 설계서: docs/specs/F-02-world-collector/design.md
- 인수조건: docs/project/features.md #F-02

## 태스크

### [backend] RSS 수집기 정비
- [x] lib/collectors/rss.ts — WORLD 전용 RSS 설정을 world-collector.ts로 이동, RssFeedConfig 타입 export 확인
- [x] lib/collectors/naver.ts — 뉴스 RSS는 rss.ts 재사용이므로 스텁 유지 (데이터랩은 F-03에서 사용)
- [x] lib/collectors/daum.ts — 다음 뉴스 전용 로직 불필요, 타입 re-export 유지
- [x] lib/collectors/yonhap.ts — 연합뉴스 전용 로직 불필요, 타입 re-export 유지

### [backend] 교차 소스 이슈 중복 가중치 로직
- [x] lib/collectors/world-collector.ts — scoreByCrossSourceAppearance 함수 구현 (제목 토큰 교집합 비율 기반, 교집합 > 0.5인 쌍을 동일 이슈로 판정, 등장 소스 수를 가중치로 부여)

### [backend] WORLD 채널 오케스트레이터
- [x] lib/collectors/world-collector.ts — WorldCollector 클래스 구현 (ContentCollector 인터페이스), WORLD_RSS_FEEDS 설정 (네이버 4섹션/다음/연합/BBC Korea), safeCollect 적용, extractCategoryTag 함수, 교차 소스 점수 기반 상위 15개 선별

### [backend] 테스트
- [x] tests/unit/collectors/world-collector.test.ts — 7개 RSS 소스 병렬 수집, 교차 소스 가중치 계산(AC4), 섹션별 카테고리 태그 부여 단위 테스트

## 태스크 의존성
F-01의 types.ts, utils.ts ──▶ RSS 수집기 정비 ──▶ scoreByCrossSourceAppearance 구현 ──▶ WorldCollector 오케스트레이터 ──▶ 테스트

## 병렬 실행 판단
- Agent Team 권장: No
- 근거: 프론트엔드 변경 없음, 백엔드 단일 에이전트로 처리. F-01의 공통 인터페이스(types.ts, utils.ts) 완성 후 구현 가능
