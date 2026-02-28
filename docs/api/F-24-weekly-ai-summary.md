# F-24 주간 AI 요약 — API 스펙 확정본

## 개요

F-24는 기존 F-16 Weekly Digest를 확장하는 순수 백엔드 모듈입니다. 별도 HTTP 엔드포인트가 없으며, 토요일 브리핑(`/api/cron/send-briefing`) 실행 시 자동으로 포함됩니다.

## 인터럴 함수 API (lib/weekly-summary.ts)

### generateTechTrendsSummary(supabase)

이번 주 tech 채널 콘텐츠를 기반으로 기술 트렌드 3줄 요약을 생성합니다 (AC1).

**입력**
- `supabase`: WeeklySummarySupabaseClient

**출력**
- `Promise<string>`: 3줄 요약 문자열 (줄바꿈 `\n` 구분)
- 오류 또는 데이터 없음: 빈 문자열 `""`

**동작**
1. `content_items` 테이블에서 이번 주 tech 채널 아이템 최대 20개 조회 (score_initial 내림차순)
2. 태그 빈도 집계 → 상위 5개 태그 추출
3. Claude API 호출: "3줄로 요약해줘" 형식 프롬프트
4. 오류 시 빈 문자열 반환 (graceful degradation)

---

### measureSerendipityEffect(supabase)

이번 주 브리핑의 세렌디피티 효과를 측정합니다 (AC2).

**입력**
- `supabase`: WeeklySummarySupabaseClient

**출력**
```typescript
interface SerendipityReport {
  totalSerendipityItems: number;  // 이번 주 세렌디피티 아이템 수
  positiveReactions: number;      // 긍정 반응 수 (좋아요/저장)
  discoveredTopics: string[];     // 발견된 새 토픽 목록
  effectScore: number;            // 0~100 효과 점수
}
```

**동작**
1. `briefings` 테이블에서 이번 주 브리핑 조회
2. `channel='serendipity'` 아이템 추출
3. `user_interactions`에서 세렌디피티 아이템에 대한 긍정 반응 집계
4. `effectScore = Math.round(positiveReactions / totalSerendipityItems * 100)`
5. 오류 시 기본 리포트 반환 (모든 값 0)

**긍정 반응으로 인정하는 action 값**
- `like`, `좋아요`, `save`, `저장`

---

### generateFocusComment(supabase)

이번 주 인터랙션 패턴 기반 AI 포커스 코멘트를 생성합니다 (AC3).

**입력**
- `supabase`: WeeklySummarySupabaseClient

**출력**
- `Promise<string>`: "이번 주 당신의 관심은 {토픽}에 집중됐어요" 형식 한 문장
- 오류 시: 기본 코멘트 `"이번 주도 다양한 주제로 지식을 넓혔네요."`

**동작**
1. `user_interactions`에서 이번 주 인터랙션 조회 (content_items 태그 포함)
2. 태그 빈도 집계 → 상위 3개 태그 추출
3. Claude API 호출: 포커스 코멘트 생성 (30~50자, 한 문장)
4. 인터랙션 없으면 기본 코멘트 반환 (Claude 미호출)

---

### generateWeeklySummary(supabase)

세 컴포넌트를 병렬 실행하는 메인 함수입니다.

**입력**
- `supabase`: WeeklySummarySupabaseClient

**출력**
```typescript
interface WeeklySummaryData {
  techTrendsSummary: string;       // AC1
  serendipityEffect: SerendipityReport;  // AC2
  focusComment: string;            // AC3
}
```

**특성**
- 세 컴포넌트를 `Promise.all()`로 병렬 처리
- 각 컴포넌트 실패는 독립 처리 (채널별 독립 원칙)
- 전체 함수는 절대 throw하지 않음

---

## formatWeeklyDigest 확장 (lib/weekly-digest.ts)

F-24 필드 추가로 `WeeklyDigestData`가 확장되었습니다.

**추가된 필드**
| 필드 | 타입 | 설명 |
|------|------|------|
| `techTrends` | `string?` | F-24 AC1 — 기술 트렌드 3줄 요약 |
| `serendipityEffect` | `SerendipityReport?` | F-24 AC2 — 세렌디피티 효과 리포트 |
| `focusComment` | `string?` | F-24 AC3 — AI 주간 포커스 코멘트 |

**포맷 출력 섹션 (토요일 브리핑 메시지)**
```
📊 이번 주 기술 트렌드
1. LLM 인프라 최적화 연구가 주목받고 있습니다.
2. Rust 채택이 급증하고 있습니다.
3. 클라우드 비용 절감이 주요 화두입니다.

🎲 세렌디피티 효과
발견 아이템: 5개 | 긍정 반응: 3개 | 효과: 60%
새로 발견한 관심사: cooking, music

🎯 주간 포커스
이번 주 당신의 관심은 LLM 인프라에 집중됐어요.
```

**하위 호환성**
- 모든 F-24 필드는 선택(optional) 필드
- F-16 기존 필드(`topLikedItems`, `unreadReminders`, `aiComment` 등)는 변경 없음
- F-24 필드가 없으면 해당 섹션만 생략

---

## Claude API 사용 계획

| 함수 | 호출 횟수 | 모델 | max_tokens | 비고 |
|------|-----------|------|-----------|------|
| generateTechTrendsSummary | 1회/주 | claude-sonnet-4-20250514 | 512 | tech 아이템 ≥1개일 때만 |
| generateFocusComment | 1회/주 | claude-sonnet-4-20250514 | 512 | 인터랙션 ≥1개일 때만 |
| measureSerendipityEffect | 0회 | — | — | Claude 비사용, DB 계산만 |

**비용 추정**: 주 2회 Claude 호출, 각 ~500 input + 100 output 토큰 → 주당 약 $0.002 (매우 저렴)

---

## 실행 흐름 (토요일 브리핑)

```
POST /api/cron/send-briefing
  └─ isSaturdayBriefing = true
      └─ [F-16] generateWeeklyDigest 데이터 구성
          └─ [F-24] generateWeeklySummary(supabase) 호출
              ├─ generateTechTrendsSummary() — AC1
              ├─ measureSerendipityEffect() — AC2
              └─ generateFocusComment() — AC3
      └─ digestData에 F-24 필드 병합
      └─ formatWeeklyDigest(digestData) — F-24 섹션 포함
      └─ briefingText에 append
```
