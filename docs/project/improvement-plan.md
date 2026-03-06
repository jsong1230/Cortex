# Cortex 개선 계획

> 작성일: 2026-03-05
> 배포 현황: Vercel 프로덕션 운영 중 (cortex-briefing)
> 기준: 24개 기능 구현 완료 후 안정화 단계

---

## 현황 진단 요약

> 최종 업데이트: 2026-03-06 — I-01~I-21 전체 완료/검토, 멀티유저 지원 반영, features.md AC 122개 체크 완료

| 영역 | 평가 | 조치 내용 |
|------|------|-----------|
| 보안 | ✅ | I-01: webhook debug_error 제거 완료 |
| 안정성 | ✅ | I-02: UPSERT + DB UNIQUE constraint로 race condition 해결 |
| 코드 품질 | ✅ | I-04~I-08: URL 통합, recencyScore, SDK 버전, Tailwind, 가중치 정규화 |
| 테스트 | ✅ | I-09~I-10, I-19: race condition / 타임존 / telegram-users 테스트. 1007/1007 통과 |
| DB 성능 | ✅ | I-11: 복합 인덱스 4개 + I-15: api_usage_log 인덱스 2개 + I-16: 멀티유저 스키마 |
| 관측성 | ✅ | I-13~I-15: 표준 로거, cron 타임아웃, API 비용 추적 |
| 멀티유저 | ✅ | I-16~I-18: 가족 4명 개인화 브리핑 지원 (014_multi_user.sql) |
| 문서 | ✅ | features.md AC 122개 체크 완료 (I-21), improvement-plan 최신화 |
| 운영 모니터링 | ⚠️ | I-20: alerts/check 1시간 주기 원하나 Hobby 플랜 제약 (일 1회 유지) |

---

## Phase 1 — 보안 & 안정성 ✅ 완료 (2026-03-05)

### I-01: webhook 디버그 정보 노출 제거
- **파일**: `app/api/telegram/webhook/route.ts` 라인 74
- **문제**: 프로덕션에서 `debug_error` 필드로 내부 에러 메시지가 응답에 포함됨
- **해결**: `debug_error` 필드 제거 또는 `NODE_ENV !== 'production'` 조건 추가

### I-02: insertInteraction race condition 완전 해결
- **파일**: `lib/telegram-commands.ts`
- **문제**: SELECT-then-INSERT 패턴은 원자성 보장 안 됨 — 동시 요청 시 중복 삽입 가능
- **해결**: DB 레벨 UNIQUE constraint + `ON CONFLICT DO NOTHING` UPSERT로 전환
- **관련 마이그레이션**: `004_interaction_unique_constraint.sql` 확인 필요

### I-03: 환경변수 누락 시 명시적 에러
- **파일**: `lib/summarizer.ts`, `lib/telegram.ts`
- **문제**: 필수 환경변수 누락 시 런타임에서야 에러 발생
- **해결**: 앱 시작 시 필수 환경변수 일괄 검증 유틸리티 추가

---

## Phase 2 — 코드 품질 ✅ 완료 (2026-03-05)

### I-04: 하드코딩된 URL 통합
- **영향 파일**:
  - `app/api/cron/send-briefing/route.ts` 라인 40
  - `lib/telegram-commands.ts` 라인 239
  - `lib/monthly-report.ts` 라인 61
- **문제**: `'https://cortex-briefing.vercel.app'` 여러 곳에 산재
- **해결**: 모두 `process.env.NEXT_PUBLIC_SITE_URL`로 통일

### I-05: recencyScore 실제 계산 구현
- **파일**: `app/api/cron/send-briefing/route.ts`, `lib/scoring.ts`
- **문제**: `recencyScore = item.score_initial` 사용 — 실제 recency와 무관
- **해결**: `published_at` 기반 시간 감쇠 함수 적용
  ```
  recencyScore = exp(-λ * hoursElapsed)  // λ ≈ 0.05
  ```

### I-06: Anthropic SDK 버전 고정
- **파일**: `package.json`
- **문제**: `"^0.78.0"` 범위 — 0.79.x에서 breaking change 발생 가능
- **해결**: exact 버전 또는 `<0.79.0` 상한 지정

### I-07: 인라인 스타일 Tailwind로 교체 ✅ 완료 (2026-03-05)
- **파일**: `app/(web)/page.tsx`
- **해결**: `className="mb-4 font-serif text-2xl font-bold tracking-tight text-[#1A1A1A]"` 적용

### I-08: serendipity 역가중치 정규화 ✅ 완료 (2026-03-05)
- **파일**: `lib/serendipity.ts`
- **해결**: `max(0.05, 1.0 - averageInterestScore)` — 범위 0.05~1.0으로 정규화
- 테스트 `tests/unit/serendipity/inverse-weight.test.ts` 새 공식에 맞게 업데이트

---

## Phase 3 — 테스트 & DB 최적화 ✅ 완료 (2026-03-05)

### I-09: race condition 테스트 추가
- **대상**: `POST /api/interactions` 동시 요청
- **방법**: vitest에서 병렬 Promise.all로 동일 content_id에 다중 반응 전송 시나리오

### I-10: 타임존 경계값 테스트 추가
- **대상**: `getTodayKstStartIso()`, 요일별 브리핑 분기 로직
- **방법**: UTC 00:00~09:00 구간 (KST 전날)에서의 동작 검증

### I-11: user_interactions 복합 인덱스 추가
- **대상**: Supabase `user_interactions` 테이블
- **해결**: 마이그레이션 추가
  ```sql
  CREATE INDEX idx_interactions_briefing_content
  ON user_interactions(briefing_id, content_id);

  CREATE INDEX idx_interactions_created_at
  ON user_interactions(created_at DESC);
  ```

### I-12: calculateTechScore 부분 정보 처리
- **파일**: `lib/scoring.ts`
- **문제**: interestScore/contextScore/recencyScore 3개 모두 있어야만 Phase 2 공식 적용
- **해결**: 일부 파라미터만 있어도 가중 평균 계산 가능하도록 로직 개선

---

## Phase 4 — 관측성 & 운영 (지속)

### I-13: 로깅 표준화 ✅ 완료 (2026-03-05)
- **해결**: `lib/utils/logger.ts` 생성 — `log({ event, level, data, error })` 표준 함수
- `lib/summarizer.ts`의 `logUsage` 함수에 적용 (console.info → log())
- `app/api/cron/collect/route.ts`에서 `saveApiUsage` 에러 처리에 적용

### I-14: Vercel Cron 타임아웃 대응 ✅ 완료 (2026-03-05)
- **해결**: `withTimeout(promise, 60_000, label)` 헬퍼 추가
- 채널별 수집기 4개 모두 60초 타임아웃 래핑 (총 300초 제한 내 안전 마진 확보)

### I-15: Claude API 비용 추적 ✅ 완료 (2026-03-05)
- **해결**:
  - `supabase/migrations/013_api_usage_log.sql` — api_usage_log 테이블 + 인덱스
  - `app/api/cron/collect/route.ts` — 요약 완료 후 `saveApiUsage()` 비동기 저장
  - `app/api/usage/route.ts` — `GET /api/usage?days=7` 일별 집계 API

---

---

## Phase 5 — 멀티유저 지원 ✅ 완료 (2026-03-05)

### I-16: telegram_users 테이블 + 멀티유저 DB 스키마
- **파일**: `supabase/migrations/014_multi_user.sql`
- **내용**:
  - `telegram_users` 테이블 신규 생성 (telegram_id ↔ UUID 매핑)
  - `briefings`, `user_interactions`, `interest_profile`, `cortex_settings`, `alert_log`에 `user_id FK` 추가
  - `NULLS NOT DISTINCT` unique index로 NULL user_id 레거시 데이터 호환 유지

### I-17: 멀티유저 브리핑 발송 파이프라인
- **파일**: `app/api/cron/send-briefing/route.ts`, `lib/telegram-users.ts`
- **내용**:
  - `getActiveUsers()` 기반 유저별 루프 + `Promise.allSettled` 병렬 발송
  - `fatigue-prevention`, `scoring`, `topic-extractor` 함수에 `userId` 파라미터 추가
  - `/start` 명령어: 가족 구성원 자동 등록 (`upsertTelegramUser`)

### I-18: 멀티유저 웹 API user_id 격리
- **파일**: 웹 API 라우트 전반
- **내용**: 인증된 사용자의 `user_id`로 데이터 격리 (briefings, interactions, profile 등)

### I-19: telegram-users.ts 단위 테스트 ✅ 완료 (2026-03-06)
- **파일**: `tests/unit/telegram-users.test.ts` (신규)
- **내용**: `getUserByTelegramId`, `getActiveUsers`, `upsertTelegramUser`, `handleStart` 16개 테스트

---

## Phase 6 — 신규 개선 항목 (2026-03-06 발굴)

### I-20: alerts/check cron 스케줄 — Hobby 플랜 제약으로 보류
- **파일**: `vercel.json`
- **문제**: `alerts/check`가 `0 2 * * *` (하루 1회)으로 설정됨
- **F-15 AC1 명세**: "1시간마다 Vercel Cron이 긴급 알림 트리거를 체크한다"
- **현황**: Vercel **Hobby 플랜** 제약 — 일 1회 초과 cron 불가
- **해결 방안**: Pro 플랜 업그레이드 후 `0 * * * *` (매시간)으로 변경
- **임시 조치**: `0 2 * * *` (KST 11:00) 유지 — 긴급 알림 1일 1회 체크

### I-21: features.md 인수조건 체크 완료
- **파일**: `docs/project/features.md`
- **내용**: F-01~F-24 전체 122개 AC를 `[x]` 체크 완료 (2026-03-06)

---

## 우선순위 요약

| ID | 제목 | 우선순위 | 예상 공수 |
|----|------|----------|-----------|
| I-01 | webhook 디버그 정보 제거 | ✅ 완료 | 30분 |
| I-02 | insertInteraction race condition | ✅ 완료 | 2시간 |
| I-03 | 환경변수 시작 시 검증 | ✅ 완료 | 1시간 |
| I-04 | 하드코딩 URL 통합 | ✅ 완료 | 1시간 |
| I-05 | recencyScore 실제 계산 | ✅ 완료 | 3시간 |
| I-06 | Anthropic SDK 버전 고정 | ✅ 완료 | 30분 |
| I-07 | 인라인 스타일 Tailwind 교체 | ✅ 완료 | 2시간 |
| I-08 | serendipity 가중치 정규화 | ✅ 완료 | 2시간 |
| I-09 | race condition 테스트 | ✅ 완료 | 3시간 |
| I-10 | 타임존 경계값 테스트 | ✅ 완료 | 3시간 |
| I-11 | DB 복합 인덱스 추가 | ✅ 완료 | 1시간 |
| I-12 | calculateTechScore 부분 정보 처리 | ✅ 완료 | 2시간 |
| I-13 | 로깅 표준화 | ✅ 완료 | 4시간 |
| I-14 | Cron 타임아웃 대응 | ✅ 완료 | 1일 |
| I-15 | Claude API 비용 추적 | ✅ 완료 | 4시간 |
| I-16 | telegram_users + 멀티유저 DB 스키마 | ✅ 완료 | 4시간 |
| I-17 | 멀티유저 브리핑 발송 파이프라인 | ✅ 완료 | 1일 |
| I-18 | 멀티유저 웹 API user_id 격리 | ✅ 완료 | 4시간 |
| I-19 | telegram-users.ts 단위 테스트 | ✅ 완료 | 1시간 |
| I-20 | alerts/check cron 스케줄 | ⚠️ Hobby 플랜 제약 (Pro 업그레이드 시 해결) | - |
| I-21 | features.md AC 체크 완료 | ✅ 완료 | 30분 |
