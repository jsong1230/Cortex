// /settings — 웹 설정 페이지
// F-20: RSS 소스 관리, 채널 ON/OFF, 알림 설정, My Life OS 연동, 텔레그램 상태
import type { Metadata } from 'next';
import { ChannelToggles } from '@/components/settings/ChannelToggles';
import { AlertSettings } from '@/components/settings/AlertSettings';
import { RssSources } from '@/components/settings/RssSources';
import { MyLifeOsToggle } from '@/components/settings/MyLifeOsToggle';
import { TelegramStatus } from '@/components/settings/TelegramStatus';
import { getChannelSettings } from '@/lib/fatigue-prevention';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Cortex — 설정',
};

/** 섹션 카드 래퍼 */
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E3DF',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#1A1A1A',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #E5E3DF',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 서버 컴포넌트 — 초기 데이터 로드 후 클라이언트 컴포넌트에 전달 */
export default async function SettingsPage() {
  // ─── 초기 데이터 로드 ─────────────────────────────────────────────────────

  // 1. 채널 설정
  const channelSettings = await getChannelSettings();

  // 2. 알림 설정
  const supabase = createServerClient();
  const { data: alertSettingsData } = await supabase
    .from('alert_settings')
    .select('id, trigger_type, is_enabled, quiet_hours_start, quiet_hours_end')
    .order('trigger_type');

  const alertSettings = alertSettingsData ?? [];

  // 3. RSS 소스
  const { data: userSettingsData } = await supabase
    .from('cortex_settings')
    .select('custom_rss_urls, mylifeos_enabled')
    .single();

  const customRssUrls = Array.isArray(userSettingsData?.custom_rss_urls)
    ? (userSettingsData.custom_rss_urls as Array<{
        url: string;
        name: string;
        channel: 'tech' | 'world' | 'culture' | 'canada';
      }>)
    : [];

  const mylifeosEnabled =
    typeof userSettingsData?.mylifeos_enabled === 'boolean'
      ? userSettingsData.mylifeos_enabled
      : false;

  // 4. 텔레그램 상태 (환경변수 확인)
  const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'CortexBot';
  const telegramLinked = chatId.length > 0 && botToken.length > 0;

  function maskChatId(id: string): string {
    if (id.length <= 3) return id + '***';
    return id.slice(0, 3) + '*'.repeat(id.length - 3);
  }

  const telegramStatus = {
    linked: telegramLinked,
    chat_id_masked: telegramLinked ? maskChatId(chatId) : null,
    bot_username: botUsername,
  };

  // ─── 렌더링 ───────────────────────────────────────────────────────────────

  return (
    <main>
      <h1
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#1A1A1A',
          marginBottom: '20px',
          fontFamily: "'Noto Serif KR', Georgia, serif",
        }}
      >
        설정
      </h1>

      {/* 채널 설정 (AC2) */}
      <SectionCard title="채널 설정">
        <ChannelToggles initialSettings={channelSettings} />
      </SectionCard>

      {/* 알림 설정 (AC3, AC4) */}
      {alertSettings.length > 0 && (
        <SectionCard title="긴급 알림 설정">
          <AlertSettings initialSettings={alertSettings} />
        </SectionCard>
      )}

      {/* RSS 소스 관리 (AC1) */}
      <SectionCard title="RSS 소스 관리">
        <RssSources initialSources={customRssUrls} />
      </SectionCard>

      {/* My Life OS 연동 (AC5) */}
      <SectionCard title="My Life OS 연동">
        <MyLifeOsToggle initialEnabled={mylifeosEnabled} />
      </SectionCard>

      {/* 텔레그램 연동 상태 (AC6) */}
      <SectionCard title="텔레그램 연동">
        <TelegramStatus status={telegramStatus} />
      </SectionCard>
    </main>
  );
}
