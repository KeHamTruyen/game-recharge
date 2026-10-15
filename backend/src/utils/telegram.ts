import { env } from '../config/env.js';
import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { maskTopupInfo } from './crypto.js';

// Allow slow IPv4 connections before Node falls back to unavailable IPv6.
setDefaultAutoSelectFamilyAttemptTimeout(Math.max(1500, getDefaultAutoSelectFamilyAttemptTimeout()));

interface TelegramOrderPayload {
  orderCode: string;
  amount: number | string;
  packageName: string;
  gameName: string;
  userEmail: string;
  topupInfo?: Record<string, unknown>;
  topupLabels?: Record<string, string>;
  topupFields?: unknown;
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
    const masked = maskTopupInfo(payload.topupInfo, false, payload.topupFields) as Record<string, unknown>;
    for (const [key, val] of Object.entries(masked)) {
      const label = payload.topupLabels?.[key] || key;
      const displayVal = String(val ?? '');
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
  return sendTelegramMessage(formatTelegramOrderMessage(payload));
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(6000),
    });
    const result = await res.json() as { ok?: boolean };
    if (!res.ok || result.ok !== true) {
      console.warn(`[TELEGRAM] Gửi thông báo thất bại (HTTP ${res.status})`);
      return false;
    }

    return true;
  } catch (error: unknown) {
    console.warn('[TELEGRAM] Lỗi kết nối khi gửi thông báo đơn hàng:', error instanceof Error ? error.message : error);
    return false;
  }
}

