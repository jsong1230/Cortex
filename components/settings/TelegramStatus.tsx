'use client';
// 텔레그램 chat_id 연동 상태 표시 컴포넌트
// F-20 AC6: 텔레그램 chat_id 연동 상태 확인

interface TelegramStatusData {
  linked: boolean;
  chat_id_masked: string | null;
  bot_username: string;
}

interface TelegramStatusProps {
  status: TelegramStatusData;
}

export function TelegramStatus({ status }: TelegramStatusProps) {
  return (
    <div
      data-testid="telegram-status"
      style={{
        padding: '16px',
        backgroundColor: status.linked ? '#F0FFF4' : '#FFF5F5',
        border: `1px solid ${status.linked ? '#A3D9A5' : '#FFC0C0'}`,
        borderRadius: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>✈️</span>
        <p
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: status.linked ? '#1A6B2A' : '#B91C1C',
          }}
        >
          {status.linked ? '연동됨' : '연동 안됨'}
        </p>
      </div>

      {status.linked && status.chat_id_masked ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ fontSize: '14px', color: '#5C5C5C' }}>
            <span style={{ fontWeight: 500 }}>Chat ID: </span>
            <span data-testid="telegram-chat-id-masked">{status.chat_id_masked}</span>
          </p>
          <p style={{ fontSize: '14px', color: '#5C5C5C' }}>
            <span style={{ fontWeight: 500 }}>봇: </span>
            <span>@{status.bot_username}</span>
          </p>
        </div>
      ) : (
        <p style={{ fontSize: '14px', color: '#8C8C8C' }}>
          텔레그램 봇이 설정되지 않았습니다. 서버 환경변수 TELEGRAM_CHAT_ID와 TELEGRAM_BOT_TOKEN을 설정하세요.
        </p>
      )}
    </div>
  );
}
