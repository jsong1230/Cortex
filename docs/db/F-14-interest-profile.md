# F-14 웹 관심사 프로필 — DB 스키마 확정본

> 구현 날짜: 2026-02-28
> 기준 파일: `app/api/profile/interests/route.ts`, `app/api/profile/interests/archived/route.ts`

---

## 사용 테이블

### `interest_profile`

기존 F-13 테이블을 F-14에서 확장 활용. 신규 컬럼 추가 없음.

| 컬럼 | 타입 | Nullable | 기본값 | 설명 |
|------|------|----------|--------|------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `topic` | `text` | NOT NULL | — | 토픽 이름 (UNIQUE 제약) |
| `score` | `float8` | NOT NULL | `0.5` | 관심도 점수 0.0~1.0 |
| `interaction_count` | `int4` | NOT NULL | `0` | 누적 반응 횟수 |
| `last_updated` | `timestamptz` | NOT NULL | `now()` | 마지막 갱신 시각 |
| `embedding` | `vector(1536)` | NULL | — | 토픽 임베딩 (F-13) |
| `archived_at` | `timestamptz` | NULL | `null` | 보관 처리 시각 (NULL=활성) |

### 쿼리 패턴

| 엔드포인트 | 조건 | 정렬 |
|------------|------|------|
| GET /api/profile/interests | `archived_at IS NULL` | `score DESC` |
| POST /api/profile/interests | INSERT | — |
| PUT /api/profile/interests | `id = ?` UPDATE | — |
| DELETE /api/profile/interests | `id = ?` UPDATE archived_at | — |
| GET /api/profile/interests/archived | `archived_at IS NOT NULL` | `archived_at DESC` |
| POST /api/profile/interests/archived | `id = ?` UPDATE archived_at=null | — |

### 인덱스 (기존 F-13 + F-14 활용)

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| `interest_profile_pkey` | `id` | PK 조회 |
| `interest_profile_topic_key` | `topic` | UNIQUE 제약 (중복 방지) |
| `interest_profile_score_idx` | `score DESC` | 점수순 정렬 (GET 활성 목록) |
| `interest_profile_archived_at_idx` | `archived_at` | 보관 여부 필터링 (AC4) |

---

## 소프트 삭제 정책

- `archived_at IS NULL` = 활성 토픽 (GET /api/profile/interests 조회 대상)
- `archived_at IS NOT NULL` = 보관 토픽 (GET /api/profile/interests/archived 조회 대상)
- 보관 후 3개월 경과 시 별도 배치로 하드 삭제 예정 (AC4 요건)
- 복원: `archived_at = null`로 업데이트

---

## 수동 추가 토픽 특징

- POST로 추가된 토픽: `interaction_count = 0`, `score = 0.5` 초기값
- 이후 F-13 EMA 스코어링(`updateInterestScore`)에 의해 자동 업데이트됨
- 임베딩(`embedding`)은 F-13 백그라운드 처리에서 별도 갱신
