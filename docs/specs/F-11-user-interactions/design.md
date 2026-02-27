# F-11 사용자 반응 수집 -- 변경 설계서

**버전**: 1.0 | **날짜**: 2026-02-28 | **상태**: 확정
**참조**: `docs/system/erd.md`, `docs/system/api-conventions.md`

---

## 1. 참조

- 인수조건: `docs/project/features.md` #F-11
- 시스템 설계: `docs/system/system-design.md`
- ERD: `docs/system/erd.md`
- API 컨벤션: `docs/system/api-conventions.md`

---

## 2. 기능 개요

### 2.1 목적

텔레그램과 웹 양쪽에서 발생하는 사용자 반응(좋아요/싫어요/저장/메모/스킵 등)을 통합 관리한다. 기존에 F-07(텔레그램)과 F-08(웹)에서 개별 구현된 반응 저장 기능을 확장하여 반응 이력 조회, 반응 취소/변경, 반응 통계, 소스 추적, 중복 방지, 스킵 자동 기록 기능을 추가한다.

### 2.2 인수조건 (features.md #F-11)

| ID | 조건 | 현재 상태 |
|----|------|----------|
| AC1 | 텔레그램 인라인 버튼(좋아요/싫어요/저장) 클릭 시 user_interactions에 기록 | 구현됨 (F-07) |
| AC2 | 웹 피드백 버튼 클릭 시 /api/interactions API를 통해 기록 | 구현됨 (F-08) |
| AC3 | 반응 타입별로 interaction 컬럼에 유효값이 저장 | 구현됨 (검증 로직 존재) |
| AC4 | 반응 소스(telegram_bot/web)가 source 컬럼에 기록 | 부분 구현 (source 컬럼 존재, 텔레그램은 기록 중, 웹도 기록 중) |
| AC5 | 24시간 내 무반응 아이템은 '스킵'으로 자동 기록 | 미구현 |

### 2.3 Gap 분석

| 영역 | 현재 상태 | 추가 필요 |
|------|----------|----------|
| 반응 저장 (POST) | 웹/텔레그램 모두 동작 | 중복 반응 방지 (UPSERT 전략) |
| 반응 이력 조회 | 미구현 | GET /api/interactions (content_id 필터) |
| 반응 취소/변경 | 미구현 | DELETE /api/interactions/[id], PUT /api/interactions/[id] |
| 반응 통계 | 미구현 | GET /api/interactions/stats |
| 스킵 자동 기록 | 미구현 | Cron에서 24시간 체크 후 스킵 INSERT |
| 중복 방지 | 미구현 | UNIQUE 제약 + UPSERT |
| 메모 업데이트 | 미구현 | PUT /api/interactions/[id] (memo_text 수정) |

---

## 3. 변경 범위

- 변경 유형: 기존 기능 확장 + 신규 API 추가
- 영향 받는 모듈:
  - `app/api/interactions/route.ts` (POST 수정)
  - `lib/telegram-commands.ts` (중복 방지 적용)
  - `components/briefing/FeedbackButtons.tsx` (토글/취소 지원 개선)

---

## 4. 아키텍처 결정

### 결정 1: 중복 반응 방지 전략

- **선택지**: A) DB UNIQUE 제약 + UPSERT / B) 애플리케이션 레벨 체크
- **결정**: A) DB UNIQUE 제약 + UPSERT
- **근거**: 텔레그램과 웹 양쪽에서 동시 반응 가능. DB 레벨 제약이 race condition 방지에 확실하다. `(content_id, interaction, source)` 복합 UNIQUE 대신, 같은 content_id에 같은 타입 반응은 소스 무관하게 1건으로 관리한다. UNIQUE 제약은 `(content_id, interaction)`으로 설정하되, 메모는 복수 허용 (메모는 내용이 다를 수 있음).

### 결정 2: 반응 취소 구현 방식

- **선택지**: A) 물리 DELETE / B) 논리 삭제 (deleted_at)
- **결정**: A) 물리 DELETE
- **근거**: user_interactions는 학습 엔진 입력 데이터이므로, 취소된 반응은 학습에서 제외해야 한다. 논리 삭제 시 매 쿼리마다 `WHERE deleted_at IS NULL` 조건이 필요하고, 1인 사용자이므로 데이터 복구 요구가 없다.

### 결정 3: 스킵 자동 기록 위치

- **선택지**: A) 별도 Cron 엔드포인트 / B) 다음날 send-briefing Cron 내부
- **결정**: B) send-briefing Cron 내부
- **근거**: 별도 Cron은 Vercel Hobby 플랜의 Cron 개수 제한에 걸린다. send-briefing이 실행될 때 전날 브리핑의 무반응 아이템을 체크하면 추가 Cron 없이 구현 가능하다.

### 결정 4: 반응 이력 조회 범위

- **선택지**: A) content_id 단건 필터만 / B) 날짜 범위 + 타입 필터 포함
- **결정**: B) 날짜 범위 + 타입 필터 포함
- **근거**: F-13 학습 엔진에서 기간별 반응 데이터가 필요하고, F-10 히스토리에서 저장 목록 필터링이 필요하다.

---

## 5. API 설계

### 5.1 기존 API 변경

#### POST /api/interactions (수정)

**변경 사항**: 중복 반응 방지 (UPSERT), briefing_id 선택 필드화

**Request Body**:
```typescript
{
  content_id: string;         // 필수
  briefing_id?: string;       // 선택 (텔레그램 콜백 시 null 가능)
  interaction: InteractionType; // 필수
  memo_text?: string;         // 메모일 때만
  source: 'web';              // 필수
}
```

**변경 로직**:
1. 좋아요/싫어요/저장: 기존 동일 (content_id, interaction) 존재 시 → 기존 레코드 반환 (409 대신 200으로 멱등 처리)
2. 메모: 항상 새 레코드 INSERT (복수 메모 허용)
3. briefing_id를 선택 필드로 변경 (null 허용)

**하위 호환성**: 기존 클라이언트 요청 형식 그대로 동작. briefing_id 필수 검증만 완화.

### 5.2 신규 API

#### GET /api/interactions

**목적**: 반응 이력 조회
**인증**: Supabase Auth

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `content_id` | `UUID` | X | 특정 콘텐츠의 반응만 필터 |
| `interaction` | `string` | X | 특정 반응 타입만 필터 (좋아요, 저장 등) |
| `source` | `string` | X | 소스 필터 (telegram_bot, web) |
| `from` | `YYYY-MM-DD` | X | 시작 날짜 (created_at 기준) |
| `to` | `YYYY-MM-DD` | X | 종료 날짜 |
| `limit` | `number` | X | 반환 개수 (기본 50, 최대 100) |
| `offset` | `number` | X | 페이지네이션 오프셋 (기본 0) |

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "content_id": "uuid",
        "briefing_id": "uuid",
        "interaction": "좋아요",
        "memo_text": null,
        "source": "web",
        "created_at": "2026-02-28T07:30:00+09:00",
        "content_title": "OpenAI GPT-5 출시 임박",
        "content_channel": "tech"
      }
    ],
    "total": 120,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**에러 케이스**:

| 코드 | 상황 | errorCode |
|------|------|-----------|
| 401 | 인증 없음 | AUTH_REQUIRED |
| 400 | 잘못된 쿼리 파라미터 | INTERACTION_INVALID_QUERY |

#### DELETE /api/interactions/[id]

**목적**: 반응 취소 (물리 삭제)
**인증**: Supabase Auth

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "deleted-uuid",
    "interaction": "좋아요",
    "content_id": "uuid"
  }
}
```

**에러 케이스**:

| 코드 | 상황 | errorCode |
|------|------|-----------|
| 401 | 인증 없음 | AUTH_REQUIRED |
| 404 | 해당 ID의 반응이 없음 | INTERACTION_NOT_FOUND |

#### PUT /api/interactions/[id]

**목적**: 메모 텍스트 수정
**인증**: Supabase Auth

**Request Body**:
```typescript
{
  memo_text: string; // 필수 (수정할 메모 텍스트)
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "interaction": "메모",
    "memo_text": "수정된 메모 텍스트",
    "content_id": "uuid"
  }
}
```

**에러 케이스**:

| 코드 | 상황 | errorCode |
|------|------|-----------|
| 401 | 인증 없음 | AUTH_REQUIRED |
| 400 | memo_text 누락 | INTERACTION_MEMO_REQUIRED |
| 404 | 해당 ID의 반응이 없음 | INTERACTION_NOT_FOUND |
| 400 | 메모가 아닌 반응의 memo_text 수정 시도 | INTERACTION_NOT_MEMO |

#### GET /api/interactions/stats

**목적**: 전체 반응 통계 (대시보드/프로필용)
**인증**: Supabase Auth

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `from` | `YYYY-MM-DD` | X | 시작 날짜 (기본: 30일 전) |
| `to` | `YYYY-MM-DD` | X | 종료 날짜 (기본: 오늘) |

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2026-01-29",
      "to": "2026-02-28"
    },
    "total": 245,
    "by_type": {
      "좋아요": 85,
      "싫어요": 20,
      "저장": 45,
      "메모": 12,
      "웹열기": 30,
      "링크클릭": 18,
      "스킵": 35
    },
    "by_source": {
      "telegram_bot": 120,
      "web": 90,
      "system": 35
    },
    "by_channel": {
      "tech": 100,
      "world": 50,
      "culture": 40,
      "canada": 35,
      "serendipity": 20
    }
  }
}
```

---

## 6. DB 설계

### 6.1 기존 테이블 변경: user_interactions

**추가 인덱스** (중복 반응 방지):

```sql
-- 같은 content_id에 같은 interaction 타입 중복 방지 (메모 제외)
-- 메모는 복수 허용이므로 partial unique index 사용
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_content_type_unique
  ON user_interactions(content_id, interaction)
  WHERE interaction != '메모';
```

**스키마 변경 없음**: `source` 컬럼은 이미 존재한다. 스킵 자동 기록 시 `source = 'system'` 값을 사용한다.

### 6.2 마이그레이션

```sql
-- supabase/migrations/004_interaction_unique_constraint.sql

-- 1. 기존 중복 데이터 정리 (중복 중 최신 것만 유지)
DELETE FROM user_interactions a
USING user_interactions b
WHERE a.id < b.id
  AND a.content_id = b.content_id
  AND a.interaction = b.interaction
  AND a.interaction != '메모';

-- 2. 부분 유니크 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_content_type_unique
  ON user_interactions(content_id, interaction)
  WHERE interaction != '메모';

-- 3. RLS 정책 추가 (DELETE, UPDATE)
CREATE POLICY "authenticated_delete_interactions" ON user_interactions
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_interactions" ON user_interactions
  FOR UPDATE USING (auth.role() = 'authenticated');
```

---

## 7. 시퀀스 흐름

### 7.1 웹 반응 저장 (중복 방지 적용)

```
사용자 → FeedbackButtons.tsx
  → POST /api/interactions
    → getAuthUser() 인증 검증
    → 입력 검증 (interaction 타입, content_id 형식)
    → supabase.from('user_interactions').upsert(
        { content_id, interaction, source: 'web', ... },
        { onConflict: 'content_id,interaction', ignoreDuplicates: false }
      )
    → 성공: 201 Created (신규) 또는 200 OK (기존 업데이트)
```

### 7.2 텔레그램 반응 저장 (중복 방지 적용)

```
사용자 → 텔레그램 인라인 버튼 클릭
  → POST /api/telegram/webhook
    → handleCallbackQuery()
      → insertInteraction() (lib/telegram-commands.ts)
        → supabase.from('user_interactions').upsert(...)
```

### 7.3 스킵 자동 기록

```
[Cron 07:00 매일] → POST /api/cron/send-briefing
  → 어제 브리핑 조회 (briefing_date = yesterday)
  → 어제 브리핑 items에서 content_id 목록 추출
  → user_interactions에서 해당 content_id 반응 조회
  → 반응 없는 content_id에 대해 '스킵' INSERT (source = 'system')
  → 오늘 브리핑 생성 + 발송 (기존 로직)
```

### 7.4 반응 이력 조회

```
사용자 → GET /api/interactions?content_id=xxx
  → getAuthUser() 인증 검증
  → supabase.from('user_interactions')
    .select('*, content_items!inner(title, channel)')
    .eq('content_id', contentId)
    .order('created_at', { ascending: false })
  → 200 OK + paginated response
```

---

## 8. 영향 범위

### 8.1 수정 필요 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/api/interactions/route.ts` | POST에 UPSERT 전략 적용 + GET 핸들러 추가 |
| `lib/telegram-commands.ts` | `insertInteraction()` 함수에 UPSERT 적용 |
| `app/api/cron/send-briefing/route.ts` | 스킵 자동 기록 로직 추가 (브리핑 발송 전) |
| `components/briefing/FeedbackButtons.tsx` | 토글 시 DELETE API 호출 지원 |

### 8.2 신규 생성 파일

| 파일 | 설명 |
|------|------|
| `app/api/interactions/[id]/route.ts` | DELETE, PUT 핸들러 |
| `app/api/interactions/stats/route.ts` | GET 통계 핸들러 |
| `supabase/migrations/004_interaction_unique_constraint.sql` | 유니크 인덱스 + RLS 정책 |

---

## 9. 영향 분석

### 9.1 기존 API 변경

| API | 현재 | 변경 후 | 하위 호환성 |
|-----|------|---------|------------|
| POST /api/interactions | INSERT only | UPSERT (메모 제외) | 호환됨 (기존 요청 그대로 동작) |
| POST /api/telegram/webhook | INSERT only | UPSERT | 호환됨 |

### 9.2 기존 컴포넌트 변경

| 컴포넌트 | 현재 | 변경 후 |
|----------|------|---------|
| FeedbackButtons | POST only (토글은 UI만) | 토글 시 실제 DELETE API 호출 |

### 9.3 사이드 이펙트

- **F-08 웹 브리핑 뷰어**: FeedbackButtons의 토글 동작이 실제 DB에서 삭제되므로, `GET /api/briefings/today`의 user_interaction 조회 결과가 정확해진다. 기존에는 같은 content_id에 복수 반응이 쌓였으나, 이제 타입별 1건만 존재.
- **F-07 텔레그램 봇 명령어**: `/good` 명령어가 브리핑 전체 아이템에 좋아요를 기록하는데, 이미 개별 좋아요가 있으면 UPSERT로 중복 무시된다.
- **F-13 학습 엔진 (향후)**: 스킵 자동 기록 데이터가 학습 입력으로 사용된다.

---

## 10. 성능 설계

### 10.1 인덱스 계획

| 인덱스 | 대상 | 용도 |
|--------|------|------|
| `idx_interactions_content_type_unique` | `(content_id, interaction) WHERE interaction != '메모'` | 중복 방지 + 조회 |
| `idx_interactions_content` | `content_id` | 콘텐츠별 반응 조회 (기존) |
| `idx_interactions_created` | `created_at DESC` | 최신순 정렬 (기존) |
| `idx_interactions_type` | `interaction` | 타입별 필터 (기존) |

### 10.2 쿼리 최적화

- 통계 API: `GROUP BY interaction` + `GROUP BY source`를 2개 쿼리로 분리하여 각각 인덱스 활용
- 이력 조회: content_items JOIN은 필요 필드만 SELECT, limit/offset으로 페이지네이션
- 스킵 자동 기록: 어제 브리핑 items 배열 기준 content_id IN 조회 (최대 10건)

---

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| 2026-02-28 | F-11 변경 설계서 작성 | F-07/F-08 기반 반응 수집 시스템 확장 |
