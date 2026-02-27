# F-01~F-04 채널 수집기 — DB 스키마 확정본

## 개요

F-01~F-04 수집기가 생성하는 `CollectedItem` 데이터를 Supabase `content_items` 테이블에 저장한다.

---

## 1. `content_items` 테이블 (Cortex 전용)

```sql
CREATE TABLE content_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel      TEXT        NOT NULL CHECK (channel IN ('tech', 'world', 'culture', 'canada')),
  source       TEXT        NOT NULL,        -- 'hackernews' | 'github_trending' | ...
  source_url   TEXT        NOT NULL UNIQUE, -- 중복 방지 핵심 제약
  title        TEXT        NOT NULL,
  full_text    TEXT,                        -- 본문 또는 요약
  published_at TIMESTAMPTZ,                 -- 원본 발행 시간 (null 허용)
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags         TEXT[]      DEFAULT '{}',    -- 소스 레벨 태그 배열
  summary      TEXT,                        -- Claude API 생성 요약 (Phase 2)
  score        FLOAT       DEFAULT 0.0,     -- 관심도 점수 EMA (Phase 2)
  embedding    VECTOR(1536)                 -- pgvector 임베딩 (Phase 3)
);
```

### 인덱스

```sql
-- 채널별 최신순 조회 (매일 브리핑 생성 시 사용)
CREATE INDEX idx_content_items_channel_collected_at
  ON content_items (channel, collected_at DESC);

-- 소스별 조회 (수집기 모니터링)
CREATE INDEX idx_content_items_source
  ON content_items (source);

-- 발행일 기준 조회 (기사 중복 필터링)
CREATE INDEX idx_content_items_published_at
  ON content_items (published_at DESC NULLS LAST);

-- 태그 배열 검색 (GIN 인덱스)
CREATE INDEX idx_content_items_tags
  ON content_items USING GIN (tags);
```

---

## 2. `CollectedItem` -> `content_items` 매핑

| CollectedItem 필드 | content_items 컬럼 | 비고 |
|-------------------|-------------------|------|
| `channel` | `channel` | 'tech'/'world'/'culture'/'canada' |
| `source` | `source` | 소스 식별자 |
| `source_url` | `source_url` | UNIQUE 제약 — 중복 수집 방지 |
| `title` | `title` | |
| `full_text` | `full_text` | 선택적 |
| `published_at` | `published_at` | 선택적 (null 허용) |
| `tags` | `tags` | TEXT[] |
| (수집 시각) | `collected_at` | DEFAULT NOW() |

---

## 3. 채널별 소스 목록

### TECH 채널 (F-01)
| source | 설명 | 일 최대 수 |
|--------|------|-----------|
| `hackernews` | Hacker News 상위 스토리 | 30 |
| `github_trending` | GitHub Trending | 20 |
| `rss_tech` | 사용자 정의 RSS (초기 비어있음) | 가변 |

### WORLD 채널 (F-02)
| source | 설명 | RSS limit |
|--------|------|-----------|
| `naver_politics` | 네이버 뉴스 정치 | 20 |
| `naver_economy` | 네이버 뉴스 경제 | 20 |
| `naver_society` | 네이버 뉴스 사회 | 20 |
| `naver_it` | 네이버 뉴스 IT/과학 | 20 |
| `daum_news` | 다음 뉴스 | 50 |
| `yonhap` | 연합뉴스 | 100 |
| `bbc_korea` | BBC Korea | 30 |

수집 후 교차 소스 가중치 기반 **상위 15개** 선별하여 저장.

### CULTURE 채널 (F-03)
| source | 설명 | 최대 수 | 필요 환경변수 |
|--------|------|---------|--------------|
| `naver_realtime` | 네이버 실시간 검색어 | 5 | 없음 (HTML 파싱) |
| `naver_datalab` | 네이버 데이터랩 트렌드 | 10 | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| `netflix_kr` | 넷플릭스 한국 1위 | 1 | 없음 (HTML 파싱) |
| `melon` | 멜론 차트 TOP 5 | 5 | 없음 (HTML 파싱) |
| `youtube_trending` | 유튜브 트렌딩 KR 상위 2 | 2 | `YOUTUBE_DATA_API_KEY` |

### TORONTO 채널 (F-04)
| source | 설명 | 최대 수 | 필요 환경변수 |
|--------|------|---------|--------------|
| `toronto_star` | Toronto Star RSS → 토론토 키워드 필터 | 2 | 없음 |
| `cbc_canada` | CBC Canada RSS → 토론토 키워드 필터 | 2 | 없음 |
| `weather_toronto` | OpenWeatherMap 토론토 날씨 | 1 | `OPENWEATHER_API_KEY` |

---

## 4. 중복 방지 전략

`source_url`에 UNIQUE 제약을 걸어 동일 URL이 2회 이상 수집되지 않도록 한다.

수집 파이프라인에서 INSERT 시 `ON CONFLICT (source_url) DO NOTHING` 사용:

```sql
INSERT INTO content_items (channel, source, source_url, title, full_text, published_at, tags)
VALUES (...)
ON CONFLICT (source_url) DO NOTHING;
```

---

## 5. 데이터 보존 정책

- 수집 항목: **30일** 보존 (Supabase pg_cron 또는 Vercel Cron으로 주기적 삭제)
- 브리핑에 선택된 항목: 무기한 보존 (`briefing_items` 연결 시)

```sql
-- 30일 이상 된 미선택 항목 삭제 (Phase 2에서 구현)
DELETE FROM content_items
WHERE collected_at < NOW() - INTERVAL '30 days'
  AND id NOT IN (SELECT content_item_id FROM briefing_items);
```
