// POST /api/auth/otp-verify — OTP 코드 검증 + Supabase 세션 생성
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyOtp, type OtpChallenge } from '@/lib/auth/otp';
import { createServerClient as createSupabaseAdmin } from '@/lib/supabase/server';

const COOKIE_NAME = 'cortex_otp_challenge';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!secret || !chatId) {
    return NextResponse.json(
      { error: '서버 환경변수가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  // 1. 요청 body에서 코드 읽기
  let code: string;
  try {
    const body = await request.json();
    code = String(body.code ?? '').trim();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: '6자리 숫자를 입력해주세요.' },
      { status: 400 },
    );
  }

  // 2. 쿠키에서 challenge 읽기
  const cookieStore = cookies();
  const challengeCookie = cookieStore.get(COOKIE_NAME);

  if (!challengeCookie?.value) {
    return NextResponse.json(
      { error: '로그인 코드를 먼저 요청해주세요.' },
      { status: 400 },
    );
  }

  let challenge: OtpChallenge;
  try {
    challenge = JSON.parse(challengeCookie.value);
  } catch {
    return NextResponse.json(
      { error: '잘못된 인증 데이터입니다.' },
      { status: 400 },
    );
  }

  // 3. OTP 검증
  if (!verifyOtp(code, challenge, secret)) {
    return NextResponse.json(
      { error: '코드가 일치하지 않거나 만료되었습니다.' },
      { status: 401 },
    );
  }

  // 4. challenge 쿠키 삭제 (일회용)
  cookieStore.delete(COOKIE_NAME);

  // 5. Supabase 사용자 upsert + 세션 생성 (기존 telegram 로그인과 동일)
  const adminClient = createSupabaseAdmin();
  const telegramEmail = `${chatId}@telegram.cortex.local`;

  // 기존 사용자 확인
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email === telegramEmail,
  );

  if (!existingUser) {
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: telegramEmail,
      email_confirm: true,
      user_metadata: {
        telegram_id: Number(chatId),
        login_method: 'bot_otp',
      },
    });

    if (createError) {
      return NextResponse.json(
        { error: '사용자 생성 실패' },
        { status: 500 },
      );
    }
  }

  // Magic link 토큰 생성
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: telegramEmail,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: '세션 토큰 생성 실패' },
      { status: 500 },
    );
  }

  // 6. callback URL 반환 (클라이언트에서 redirect)
  const callbackUrl = `/api/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=/`;

  return NextResponse.json({ success: true, callbackUrl });
}
