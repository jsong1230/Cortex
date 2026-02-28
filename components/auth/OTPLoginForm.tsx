'use client';

import { useState, useRef, useEffect } from 'react';

type Stage = 'idle' | 'sending' | 'sent' | 'verifying';

export function OTPLoginForm() {
  const [stage, setStage] = useState<Stage>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 코드 입력 후 자동 포커스
  useEffect(() => {
    if (stage === 'sent') {
      inputRef.current?.focus();
    }
  }, [stage]);

  async function requestCode() {
    setStage('sending');
    setError('');

    try {
      const res = await fetch('/api/auth/otp-request', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '코드 발송 실패');
        setStage('idle');
        return;
      }

      setStage('sent');
      setCountdown(300); // 5분
    } catch {
      setError('네트워크 오류');
      setStage('idle');
    }
  }

  async function verifyCode() {
    if (code.length !== 6) {
      setError('6자리 코드를 입력해주세요.');
      return;
    }

    setStage('verifying');
    setError('');

    try {
      const res = await fetch('/api/auth/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '인증 실패');
        setStage('sent');
        return;
      }

      // 세션 교환을 위해 callback URL로 이동
      window.location.href = data.callbackUrl;
    } catch {
      setError('네트워크 오류');
      setStage('sent');
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="w-full flex flex-col items-center gap-5">
      {/* Stage 1: 코드 요청 */}
      {(stage === 'idle' || stage === 'sending') && (
        <button
          type="button"
          onClick={requestCode}
          disabled={stage === 'sending'}
          className="flex items-center gap-3 px-6 py-3 rounded-lg text-white font-medium text-base transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-50"
          style={{ backgroundColor: '#0088cc' }}
        >
          <TelegramIcon />
          {stage === 'sending' ? '발송 중...' : '텔레그램으로 로그인 코드 받기'}
        </button>
      )}

      {/* Stage 2: 코드 입력 */}
      {(stage === 'sent' || stage === 'verifying') && (
        <div className="w-full flex flex-col items-center gap-4">
          <p
            className="text-sm text-center"
            style={{ color: '#5C5C5C' }}
          >
            텔레그램으로 전송된 6자리 코드를 입력하세요
            {countdown > 0 && (
              <span className="ml-2" style={{ color: '#9E9E9E' }}>
                ({formatTime(countdown)})
              </span>
            )}
          </p>

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
            placeholder="000000"
            className="w-48 text-center text-2xl font-mono tracking-[0.3em] py-3 border-b-2 bg-transparent outline-none transition-colors focus:border-[#0088cc]"
            style={{ borderColor: '#E0E0E0', color: '#1A1A1A' }}
            disabled={stage === 'verifying'}
            autoComplete="one-time-code"
          />

          <button
            type="button"
            onClick={verifyCode}
            disabled={stage === 'verifying' || code.length !== 6}
            className="px-8 py-2.5 rounded-lg text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: '#1A1A1A' }}
          >
            {stage === 'verifying' ? '확인 중...' : '로그인'}
          </button>

          {countdown <= 0 && (
            <button
              type="button"
              onClick={() => {
                setCode('');
                setStage('idle');
                setError('');
              }}
              className="text-sm underline"
              style={{ color: '#9E9E9E' }}
            >
              코드 재발송
            </button>
          )}
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <p className="text-sm text-center" style={{ color: '#E53935' }}>
          {error}
        </p>
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
