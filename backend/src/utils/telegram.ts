import { env } from '../config/env.js';

interface TelegramOrderPayload {
  orderCode: string;
  amount: number | string;
  packageName: string;
  gameName: string;
  userEmail: string;
  topupInfo?: Record<string, unknown>;
  topupLabels?: Record<string, string>;
  paidAt?: Date | string;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatVnd(amount: number | string): string {
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) return `${amount}đ`;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

export function formatTelegramOrderMessage(payload: TelegramOrderPayload): string {
  const timeStr = payload.paidAt
    ? new Date(payload.paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  // Format top-up fields
  const topupLines: string[] = [];
  if (payload.topupInfo && typeof payload.topupInfo === 'object') {
    for (const [key, val] of Object.entries(payload.topupInfo)) {
      const label = payload.topupLabels?.[key] || key;
      const lowerKey = key.toLowerCase();
      let displayVal = String(val ?? '');
      if (lowerKey.includes('pass') || lowerKey.includes('pwd')) {
        displayVal = '•••••••• (Mã hóa an toàn)';
      }
      topupLines.push(`• <b>${escapeHtml(label)}:</b> <code>${escapeHtml(displayVal)}</code>`);
    }
  }

  const infoSection = topupLines.length > 0
    ? `\n━━━━━━━━━━━━━━━━━━━━━━\n📝 <b>THÔNG TIN NẠP:</b>\n${topupLines.join('\n')}`
    : '';

  return [
    `⚡ <b>ĐƠN HÀNG MỚI ĐÃ THANH TOÁN</b> ⚡`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📦 <b>Mã đơn:</b> <code>#${escapeHtml(payload.orderCode)}</code>`,
    `🎮 <b>Game:</b> ${escapeHtml(payload.gameName)}`,
    `💎 <b>Gói:</b> ${escapeHtml(payload.packageName)}`,
    `💰 <b>Số tiền:</b> <b>${escapeHtml(formatVnd(payload.amount))}</b>`,
    `👤 <b>Khách hàng:</b> ${escapeHtml(payload.userEmail)}`,
    `⏰ <b>Thời gian:</b> ${escapeHtml(timeStr)}`,
    infoSection,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `👉 <i>Vui lòng vào trang quản trị để xử lý đơn cho khách!</i>`,
  ].join('\n');
}

export async function sendTelegramOrderNotification(payload: TelegramOrderPayload): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    if (env.NODE_ENV !== 'production') {
      console.info(`[TELEGRAM NOTIFICATION (SKIPPED - NO CONFIG)] Đơn mới #${payload.orderCode} - ${payload.gameName} (${formatVnd(payload.amount)})`);
    }
    return false;
  }

  try {
    const message = formatTelegramOrderMessage(payload);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[TELEGRAM] Gửi thông báo thất bại (HTTP ${res.status}): ${errText}`);
      return false;
    }

    return true;
  } catch (error: unknown) {
    console.warn('[TELEGRAM] Lỗi kết nối khi gửi thông báo đơn hàng:', error instanceof Error ? error.message : error);
    return false;
  }
}

