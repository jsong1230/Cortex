# Cortex

## 프로젝트
매일 아침 7시, 텔레그램으로 개인화된 브리핑을 발송하는 AI 큐레이션 서비스

## 기술 스택
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Backend: Next.js API Routes, Vercel Cron Jobs, 텔레그램 Bot API
- DB: Supabase (PostgreSQL + pgvector)
- AI: Claude API (anthropic SDK)
- 배포: Vercel

## 디렉토리
- `app/` — Next.js App Router (페이지 + API 라우트)
- `app/api/` — API 엔드포인트 (cron, telegram, briefings 등)
- `app/(web)/` — 웹 대시보드 페이지
- `lib/` — 비즈니스 로직 (수집기, 요약, 스코어링, 임베딩)
- `lib/collectors/` — 콘텐츠 수집기 (HN, GitHub, RSS, 네이버 등)
- `supabase/` — DB 마이그레이션
- `docs/` — 프로젝트 문서 (PRD, 설계 문서)

## 실행
- 개발: `npm run dev`
- 테스트: `npm test`
- E2E 테스트: `npx playwright test`
- 빌드: `npm run build`

## 프로젝트 관리
- 방식: file
