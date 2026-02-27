// 수집기 공통 인터페이스 — F-01~F-04 모든 채널 공유
// design.md 섹션 2.1 참조

/** 채널 타입 */
export type Channel = 'tech' | 'world' | 'culture' | 'canada';

/** 수집된 개별 아이템 */
export interface CollectedItem {
  channel: Channel;
  source: string;        // 'hackernews' | 'github_trending' | 'naver_news' 등
  source_url: string;    // content_items.source_url에 매핑 (UNIQUE 제약)
  title: string;
  full_text?: string;    // 본문 또는 요약 텍스트 (있는 경우)
  published_at?: Date;   // 원본 발행 시간
  tags?: string[];       // 소스 레벨에서 추출 가능한 태그 (언어, 카테고리 등)
}

/** 개별 소스의 수집 에러 */
export interface CollectorError {
  source: string;        // 실패한 소스명
  message: string;       // 에러 메시지
  timestamp: Date;       // 에러 발생 시각
}

/** 수집기 실행 결과 */
export interface CollectorResult {
  channel: Channel;
  items: CollectedItem[];
  errors: CollectorError[];
}

/** 수집기 공통 인터페이스 */
export interface ContentCollector {
  /** 수집기 식별자 (로깅/모니터링용) */
  name: string;
  /** 대상 채널 */
  channel: Channel;
  /** 수집 실행: 모든 소스를 병렬 호출하고 결과를 합산한다 */
  collect(): Promise<CollectorResult>;
}
