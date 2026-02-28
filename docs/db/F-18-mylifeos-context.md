# F-18 DB 스키마 확정본 — My Life OS 컨텍스트 연동

## 변경 사항
기존 `keyword_contexts` 테이블 활용 (migration 001에서 생성됨).
신규 테이블 없음. 읽기 전용으로 참조하는 My Life OS 테이블 목록만 문서화.

---

## keyword_contexts 테이블 (기존, 활용)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | 기본키 |
| source | text | NOT NULL | 소스 유형: 'diary', 'todo', 'note' |
| source_id | text | NOT NULL | 소스 레코드 ID |
| keywords | text[] | NOT NULL | 추출된 키워드 배열 |
| embedding | vector(1536) | nullable | 임베딩 벡터 (선택적) |
| expires_at | timestamptz | NOT NULL | 만료 시각 (저장 시 +7일) |

### 유니크 제약
```sql
UNIQUE (source, source_id)
```
upsert 시 `onConflict: 'source,source_id'`로 중복 방지

### TTL 정책 (AC3)
- `expires_at = NOW() + INTERVAL '7 days'`
- 동기화 실행 시마다 `DELETE WHERE expires_at < NOW()` 실행

### 인덱스
- PK 인덱스 (id)
- (source, source_id) UNIQUE 인덱스
- expires_at 인덱스 (만료 쿼리 최적화 — 기존 migration 적용 여부 확인 필요)

---

## My Life OS 테이블 (읽기 전용, 같은 Supabase 인스턴스)

### diary_entries
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| content | text | 일기 원문 (키워드 추출 후 저장하지 않음 — AC6) |
| created_at | timestamptz | 작성 시각 |
| user_id | uuid | 사용자 ID |

쿼리: `SELECT id, content, created_at WHERE created_at >= NOW() - 7일 ORDER BY created_at DESC`

### todos
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| title | text | 태스크 제목 |
| completed | boolean | 완료 여부 |
| created_at | timestamptz | 생성 시각 |
| user_id | uuid | 사용자 ID |

쿼리: `SELECT id, title WHERE completed = false ORDER BY created_at DESC LIMIT 20`

### notes
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| title | text | 노트 제목 |
| content | text | 노트 내용 (조회하지 않음) |
| created_at | timestamptz | 생성 시각 |
| user_id | uuid | 사용자 ID |

쿼리: `SELECT id, title, created_at WHERE created_at >= NOW() - 7일 ORDER BY created_at DESC LIMIT 20`

---

## user_settings 테이블 (기존, 활용)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| mylifeos_enabled | boolean | My Life OS 연동 ON/OFF (F-20에서 구현) |

동기화 전 `mylifeos_enabled` 확인 후 false이면 스킵 (AC5)

---

## 데이터 흐름 (F-18)

```
My Life OS DB (읽기 전용)
  diary_entries  →  Claude API 키워드 추출  →  keyword_contexts (upsert, TTL 7일)
  todos          →  제목 토큰화             →  keyword_contexts (upsert, TTL 7일)
  notes          →  제목 토큰화             →  keyword_contexts (upsert, TTL 7일)

keyword_contexts
  → getActiveKeywords()     → send-briefing cron (컨텍스트 점수 계산)
  → matchContentToKeywords() → BriefingItem.reason (AC4: 이유 표시)
```

---

## 프라이버시 설계 (AC6)

- diary_entries의 `content` 필드는 Claude API 호출 후 즉시 폐기
- keyword_contexts에는 키워드(`text[]`)만 저장, 원문 없음
- 키워드 자동 만료 (7일 TTL)로 장기 보관 방지
