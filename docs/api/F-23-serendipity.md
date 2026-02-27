# F-23 세렌디피티 채널 — API 스펙 확정본

구현 날짜: 2026-02-28

## 개요

세렌디피티 채널은 사용자의 평소 관심사와 다른 인접 영역의 콘텐츠를 매일 브리핑에 1개 포함시킵니다.
기존 API 엔드포인트의 동작을 확장하며 별도의 신규 엔드포인트는 없습니다.

---

## 변경된 API

### 1. POST /api/cron/send-briefing

기존 브리핑 발송 라우트에 세렌디피티 아이템 선정 로직이 추가됩니다.

#### 변경 사항

- `interest_profile` 테이블에서 관심 프로필 로드 (세렌디피티 역가중치 계산용)
- `selectBriefingItems()` 호출 시 `interestProfile: Map<string, number>` 파라미터 추가
- `briefings.items` JSONB 각 아이템에 `is_serendipity: boolean` 필드 추가

#### 응답 구조 (변경 없음)

```json
{
  "success": true,
  "data": {
    "briefing_date": "2026-02-28",
    "items_count": 8,
    "telegram_sent": true,
    "channels": {
      "tech": 3,
      "world": 2,
      "culture": 1,
      "canada": 2,
      "serendipity": 1
    },
    "mode": "weekday"
  }
}
```

#### 세렌디피티 선정 로직

1. `content_items` 조회 후 `interest_profile` 로드
2. 전 채널 아이템에 대해 역가중치 계산: `1.0 - averageInterestScore + 0.2`
3. 이미 선정된 아이템(main briefing items) 제외
4. 룰렛 휠 알고리즘으로 1개 확률적 선정
5. 선정 아이템의 `channel`을 `'serendipity'`로 변환
6. `briefings.items`에 `is_serendipity: true` 태그 포함하여 저장

#### 폴백 동작

- `interest_profile` 로드 실패 시: 빈 Map으로 진행 (모든 아이템 동등 확률)
- 후보 아이템이 없으면 세렌디피티 아이템 미포함

---

### 2. POST /api/interactions

세렌디피티 아이템에 대한 반응을 별도 추적합니다 (AC4).

#### 변경 사항

- `briefing_id`가 있는 경우, `briefings.items`에서 해당 `content_id`의 `channel`이 `'serendipity'`인지 확인
- 세렌디피티 아이템 반응이 감지되면 구조화 로그를 출력

#### 세렌디피티 반응 로그 포맷

```json
{
  "event": "cortex_serendipity_reaction",
  "content_id": "uuid-...",
  "briefing_id": "uuid-...",
  "interaction": "좋아요",
  "serendipity_source": "serendipity_channel",
  "timestamp": "2026-02-28T07:00:00.000Z"
}
```

#### 응답 구조 (변경 없음)

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "interaction": "좋아요",
    "content_id": "uuid-..."
  }
}
```

---

## lib/serendipity.ts 공개 API

### `calculateInverseWeight(tags, interestProfile)`

역가중치 계산.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `tags` | `string[]` | 콘텐츠 토픽 태그 |
| `interestProfile` | `Map<string, number>` | 관심 프로필 (topic → score) |

반환: `number` — `1.0 - averageInterestScore + 0.2` (최소 0.2)

### `buildSerendipityPool(items, interestProfile?)`

전 채널 아이템에서 후보 풀 생성.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `items` | `BriefingItem[]` | 전체 브리핑 후보 아이템 |
| `interestProfile` | `Map<string, number>` (선택) | 관심 프로필 |

반환: `SerendipityCandidate[]`

### `selectSerendipityItem(candidates, interestProfile, excludeIds?)`

룰렛 휠 알고리즘으로 세렌디피티 아이템 1개 선정.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `candidates` | `(SerendipityCandidate \| BriefingItem)[]` | 후보 목록 |
| `interestProfile` | `Map<string, number>` | 관심 프로필 |
| `excludeIds` | `Set<string>` (선택) | 제외할 아이템 ID 집합 |

반환: `(SerendipityCandidate & { channel: 'serendipity' }) | null`

### `isSerendipityItem(contentId, briefingItems)`

브리핑 items에서 세렌디피티 아이템 여부 확인.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `contentId` | `string` | 확인할 콘텐츠 ID |
| `briefingItems` | `{ content_id: string; channel: string }[]` | briefings.items JSONB |

반환: `boolean`

### `buildSerendipityInteractionMeta(contentId, interaction)`

세렌디피티 반응 추적 메타데이터 생성.

반환: `SerendipityInteractionMeta`

```typescript
interface SerendipityInteractionMeta {
  content_id: string;
  interaction: string;
  is_serendipity: true;
  serendipity_source: 'serendipity_channel';
}
```

---

## 텔레그램 메시지 포맷

세렌디피티 아이템은 `🎲 세렌디피티` 섹션에 1개만 표시됩니다.

```
🎲 세렌디피티
💡 <a href="https://...">아이템 제목</a> — 1줄 요약
```

---

## selectBriefingItems 함수 시그니처 변경

```typescript
// 변경 전
function selectBriefingItems(items: BriefingItem[], mode?: BriefingMode): BriefingItem[]

// 변경 후 (F-23)
function selectBriefingItems(
  items: BriefingItem[],
  mode?: BriefingMode,
  interestProfile?: Map<string, number>  // 추가: 세렌디피티 역가중치용
): BriefingItem[]
```

하위 호환: `interestProfile` 기본값 `new Map()` (빈 프로필 → 동등한 랜덤 선택)
