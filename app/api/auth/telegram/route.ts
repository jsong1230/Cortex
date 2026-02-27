/**
 * GET /api/auth/telegram
 * 텔레그램 로그인 위젯 콜백 처리
 *
 * AC2: 텔레그램 로그인 위젯으로 텔레그램 계정과 웹 계정이 연동된다
 * AC1: Supabase Auth를 통해 웹 로그인이 동작한다
 */
import { NextResponse } from 'next/server';
import {
  verifyTelegramLogin,
  isTelegramAuthExpired,
  type TelegramLoginData,
} from '@/lib/auth/telegram-verify';
import { createServerClient as createSupabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  // 필수 파라미터 검증
  const hash = searchParams.get('hash');
  const id = searchParams.get('id');
  const authDateStr = searchParams.get('auth_date');
  const firstName = searchParams.get('first_name');

  if (!hash || !id || !authDateStr || !firstName) {
    return NextResponse.json(
      { error: '필수 파라미터가 누락되었습니다.' },
      { status: 400 }
    );
  }

  // 텔레그램 로그인 데이터 구성
  const authDate = parseInt(authDateStr, 10);
  const telegramData: TelegramLoginData = {
    id: parseInt(id, 10),
    first_name: firstName,
    auth_date: authDate,
    hash,
  };

  // 선택 파라미터 추가
  const lastName = searchParams.get('last_name');
  const username = searchParams.get('username');
  const photoUrl = searchParams.get('photo_url');

  if (lastName) telegramData.last_name = lastName;
  if (username) telegramData.username = username;
  if (photoUrl) telegramData.photo_url = photoUrl;

  // 봇 토큰으로 hash 검증
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  if (!verifyTelegramLogin(telegramData, botToken)) {
    return NextResponse.json(
      { error: 'Hash 검증 실패: 유효하지 않은 텔레그램 데이터입니다.' },
      { status: 401 }
    );
  }

  // auth_date 만료 검증 (24시간)
  if (isTelegramAuthExpired(authDate)) {
    return NextResponse.json(
      { error: '인증 데이터가 만료되었습니다. 다시 로그인해주세요.' },
      { status: 401 }
    );
  }

  // 1인 전용 서비스: TELEGRAM_CHAT_ID 허용 목록 검증
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  if (allowedChatId && String(telegramData.id) !== allowedChatId) {
    return NextResponse.json(
      { error: '허용되지 않은 사용자입니다.' },
      { status: 403 }
    );
  }

  // Supabase Admin API로 사용자 upsert
  const adminClient = createSupabaseAdmin();
  const telegramEmail = `${telegramData.id}@telegram.cortex.local`;

  // 기존 사용자 조회 (1인 전용 서비스이므로 listUsers 허용)
  const { data: existingUsers } =
    await adminClient.auth.admin.listUsers();

  const existingUser = existingUsers?.users?.find(
    (u) => u.email === telegramEmail
  );

  if (!existingUser) {
    // 신규 사용자 생성
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: telegramEmail,
      email_confirm: true,
      user_metadata: {
        telegram_id: telegramData.id,
        username: telegramData.username ?? null,
        first_name: telegramData.first_name,
        last_name: telegramData.last_name ?? null,
      },
    });

    if (createError) {
      return NextResponse.json(
        { error: 'Supabase 사용자 생성 실패' },
        { status: 500 }
      );
    }
  }

  // Magic link (OTP) 생성으로 세션 토큰 획득
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: telegramEmail,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: '세션 토큰 생성 실패' },
      { status: 500 }
    );
  }

  // redirect 파라미터 처리 (기본값 /, Open Redirect 방지)
  const rawRedirect = searchParams.get('redirect') ?? '/';
  // 외부 URL 방지: 절대 경로(/로 시작)만 허용
  const redirectPath = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  // 클라이언트에서 세션 교환을 처리하기 위해 /api/auth/callback으로 이동
  // OTP 토큰을 query string으로 전달
  const callbackUrl = new URL('/api/auth/callback', request.url);
  callbackUrl.searchParams.set('token_hash', linkData.properties.hashed_token);
  callbackUrl.searchParams.set('type', 'magiclink');
  callbackUrl.searchParams.set('next', redirectPath);

  return NextResponse.redirect(callbackUrl, { status: 302 });
}
