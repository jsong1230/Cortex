'use client';

/**
 * 텔레그램 로그인 위젯 버튼 컴포넌트
 * 텔레그램 Login Widget 스크립트를 동적 로드하여 로그인 버튼 렌더링
 *
 * 작동 방식:
 * 1. 텔레그램 Login Widget 스크립트 로드
 * 2. 사용자 클릭 → 텔레그램 앱 승인
 * 3. onAuth 콜백으로 사용자 데이터 수신
 * 4. /api/auth/telegram?{data} 호출
 */
import { useEffect, useRef } from 'react';

interface TelegramLoginButtonProps {
  /** 로그인 성공 후 이동할 URL */
  redirectPath?: string;
}

export function TelegramLoginButton({
  redirectPath = '/',
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (!botUsername || !containerRef.current) {
      return;
    }

    // 텔레그램 Login Widget 스크립트 동적 삽입
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-request-access', 'write');

    // 콜백 방식: onauth 함수 전역 등록 후 data-onauth 설정
    const callbackName = `telegramLoginCallback_${Date.now()}`;
    const windowWithCallbacks = window as unknown as Record<string, unknown>;
    windowWithCallbacks[callbackName] = (
      user: Record<string, string | number>
    ) => {
      const params = new URLSearchParams();
      Object.entries(user).forEach(([k, v]) => params.set(k, String(v)));
      if (redirectPath && redirectPath !== '/') {
        params.set('redirect', redirectPath);
      }
      window.location.href = `/api/auth/telegram?${params.toString()}`;
    };

    script.setAttribute('data-onauth', `${callbackName}(user)`);
    script.async = true;

    containerRef.current.appendChild(script);

    return () => {
      // 정리: 전역 콜백 제거
      delete windowWithCallbacks[callbackName];
    };
  }, [redirectPath]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 텔레그램 위젯이 로드되는 컨테이너 */}
      <div ref={containerRef} className="flex justify-center" />

      {/* 폴백 버튼 (스크립트 로드 전 또는 환경변수 미설정 시) */}
      {!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && (
        <button
          type="button"
          className="flex items-center gap-3 px-6 py-3 rounded-lg text-white font-medium text-base transition-opacity hover:opacity-90 active:opacity-75"
          style={{ backgroundColor: '#0088cc' }}
          aria-label="텔레그램으로 로그인"
          disabled
        >
          <TelegramIcon />
          텔레그램으로 로그인
        </button>
      )}
    </div>
  );
}

function TelegramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
