// POST /api/auth/otp-request — OTP 코드 생성 + 텔레그램 봇 발송
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateOtp, createChallenge } from '@/lib/auth/otp';

const COOKIE_NAME = 'cortex_otp_challenge';

export async function POST(): Promise<NextResponse> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const secret = process.env.CRON_SECRET;

  if (!botToken || !chatId || !secret) {
    return NextResponse.json(
      { error: '서버 환경변수가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  // 1. OTP 생성 + HMAC challenge
  const code = generateOtp();
  const challenge = createChallenge(code, secret);

  // 2. 텔레그램 봇으로 코드 발송
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const message = `🔐 Cortex 로그인 코드\n\n<b>${code}</b>\n\n5분 이내에 입력하세요.`;

  try {
    const res = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `텔레그램 발송 실패: ${body}` },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: '텔레그램 API 연결 실패' },
      { status: 502 },
    );
  }

  // 3. Challenge를 httpOnly 쿠키에 저장
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(challenge), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300, // 5분
  });

  return NextResponse.json({ success: true });
}
