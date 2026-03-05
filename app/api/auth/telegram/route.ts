/**
 * GET /api/auth/telegram
 * 텔레그램 로그인 위젯 콜백 처리
 *
 * AC1: Supabase Auth를 통해 웹 로그인이 동작한다
 * AC2: 텔레그램 로그인 위젯으로 텔레그램 계정과 웹 계정이 연동된다
 * 멀티유저: telegram_users에 upsert 후 telegram_users.id를 user_metadata에 저장
 */
import { NextResponse } from 'next/server';
import {
  verifyTelegramLogin,
  isTelegramAuthExpired,
  type TelegramLoginData,
} from '@/lib/auth/telegram-verify';
import { createServerClient as createSupabaseAdmin } from '@/lib/supabase/server';
import { upsertTelegramUser } from '@/lib/telegram-users';

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

  // telegram_users에 upsert (멀티유저 등록/갱신)
  let telegramUserRecord: { id: string } | null = null;
  try {
    telegramUserRecord = await upsertTelegramUser({
      telegramId: telegramData.id,
      chatId: telegramData.id,  // DM용 chat_id (= telegram_id for private chats)
      firstName: telegramData.first_name,
      username: telegramData.username,
    });
  } catch {
    // telegram_users upsert 실패해도 로그인은 계속 진행
  }

  // Supabase Admin API로 auth 사용자 upsert
  const adminClient = createSupabaseAdmin();
  const telegramEmail = `${telegramData.id}@telegram.cortex.local`;

  // 기존 사용자 조회
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email === telegramEmail
  );

  const userMetadata = {
    telegram_id: telegramData.id,
    username: telegramData.username ?? null,
    first_name: telegramData.first_name,
    last_name: telegramData.last_name ?? null,
    telegram_user_id: telegramUserRecord?.id ?? null,
  };

  if (!existingUser) {
    // 신규 사용자 생성
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: telegramEmail,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (createError) {
      return NextResponse.json(
        { error: 'Supabase 사용자 생성 실패' },
        { status: 500 }
      );
    }
  } else if (telegramUserRecord?.id && existingUser.user_metadata?.telegram_user_id !== telegramUserRecord.id) {
    // 기존 사용자에 telegram_user_id 갱신
    await adminClient.auth.admin.updateUserById(existingUser.id, {
      user_metadata: { ...existingUser.user_metadata, telegram_user_id: telegramUserRecord.id },
    });
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
  const redirectPath = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const callbackUrl = new URL('/api/auth/callback', request.url);
  callbackUrl.searchParams.set('token_hash', linkData.properties.hashed_token);
  callbackUrl.searchParams.set('type', 'magiclink');
  callbackUrl.searchParams.set('next', redirectPath);

  return NextResponse.redirect(callbackUrl, { status: 302 });
}
