/**
 * 로그인 페이지 — /login
 * AC3: 인증되지 않은 사용자는 웹 페이지에 접근할 수 없다 → 이 페이지로 리다이렉트
 * AC2: 텔레그램 로그인 위젯으로 로그인
 *
 * 디자인:
 * - 배경: #F8F7F4 (canvas)
 * - 로고: Noto Serif KR, 24px, 700
 * - 서브타이틀: 16px, #5C5C5C
 * - 모바일 중앙 정렬, max-width 400px
 */
import type { Metadata } from 'next';
import { OTPLoginForm } from '@/components/auth/OTPLoginForm';

export const metadata: Metadata = {
  title: '로그인 — Cortex',
  description: 'Cortex 개인 AI 브리핑 서비스에 로그인합니다.',
  robots: 'noindex, nofollow',
};

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#F8F7F4' }}
    >
      <div
        className="w-full max-w-sm flex flex-col items-center gap-8 py-12"
        aria-label="로그인 영역"
      >
        {/* 로고 영역 */}
        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{
              fontFamily: "'Noto Serif KR', Georgia, serif",
              color: '#1A1A1A',
              letterSpacing: '-0.02em',
            }}
          >
            Cortex
          </h1>
          <p
            className="text-base text-center"
            style={{ color: '#5C5C5C', fontFamily: 'Pretendard, sans-serif' }}
          >
            나의 개인 AI 브리핑
          </p>
        </div>

        {/* OTP 로그인 영역 */}
        <div className="w-full flex flex-col items-center">
          <OTPLoginForm />
        </div>

        {/* 안내 문구 */}
        <p
          className="text-sm text-center"
          style={{ color: '#9E9E9E', fontFamily: 'Pretendard, sans-serif' }}
        >
          1인 전용 서비스 &mdash; jsong1230 전용
        </p>
      </div>
    </main>
  );
}
