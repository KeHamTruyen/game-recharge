import 'dotenv/config';
import { env } from '../src/config/env.js';
import { formatTelegramOrderMessage, sendTelegramOrderNotification } from '../src/utils/telegram.js';

async function main() {
  console.log('\n==============================================');
  console.log('🤖 KIỂM TRA TÍCH HỢP THÔNG BÁO TELEGRAM BOT');
  console.log('==============================================');

  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();

  console.log(`- Bot Token: ${token ? 'Đã cấu hình' : '❌ Chưa cấu hình'}`);
  console.log(`- Chat ID  : ${chatId || '❌ Chưa cấu hình'}`);

  if (!token || !chatId) {
    console.error('\n❌ LỖI: Vui lòng cấu hình TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong file backend/.env');
    process.exit(1);
  }

  // 1. Kiểm tra Bot info qua getMe
  console.log('\n🔄 1. Đang kiểm tra danh tính Bot với Telegram API...');
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) });
    const data = (await res.json()) as { ok: boolean; result?: { id: number; first_name: string; username: string }; description?: string };

    if (!data.ok || !data.result) {
      console.error(`❌ Bot Token không hợp lệ hoặc Telegram từ chối: ${data.description || 'Unknown error'}`);
      process.exit(1);
    }

    console.log(`✅ Kết nối Bot thành công!`);
    console.log(`   - Tên Bot: ${data.result.first_name}`);
    console.log(`   - Username: @${data.result.username}`);
    console.log(`   - Bot ID: ${data.result.id}`);
  } catch (error) {
    console.error('❌ Lỗi kết nối đến api.telegram.org:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // 2. Chuẩn bị dữ liệu mẫu đơn hàng nạp game
  const sampleOrder = {
    orderCode: 'ORD-982461',
    amount: 109000,
    packageName: 'Không Nguyệt Chúc Phúc (30 Ngày)',
    gameName: 'Genshin Impact',
    userEmail: 'kienphotoclone01@gmail.com',
    paidAt: new Date(),
    topupInfo: {
      account: 'duke_gamer2026',
      password: 'PassWord123@',
      server: 'Asia',
      uid: '812948210',
      characterName: 'Traveler_Duke',
    },
    topupLabels: {
      account: 'Tài khoản',
      password: 'Mật khẩu',
      server: 'Máy chủ',
      uid: 'UID Nhân Vật',
      characterName: 'Tên Nhân Vật',
    },
  };

  const formattedTemplate = formatTelegramOrderMessage(sampleOrder);

  console.log('\n==============================================');
  console.log('📋 TEMPLATE THÔNG BÁO GỬI ĐẾN TELEGRAM:');
  console.log('==============================================');
  console.log(formattedTemplate);
  console.log('==============================================');

  // 3. Tiến hành gửi tin nhắn thực tế
  console.log(`\n🚀 2. Đang gửi thông báo thử nghiệm đến Chat ID: ${chatId}...`);
  const success = await sendTelegramOrderNotification(sampleOrder);

  if (success) {
    console.log('\n🎉 THÀNH CÔNG RỰC RỠ!');
    console.log(`👉 Bot đã gửi tin nhắn thông báo đơn hàng mẫu vào Telegram (Chat ID: ${chatId}).`);
    console.log('👉 Hãy mở ứng dụng Telegram trên điện thoại/máy tính để kiểm tra ngay!\n');
  } else {
    process.exitCode = 1;
    console.log('\n⚠️ GỬI TIN NHẮN THẤT BẠI!');
    console.log('💡 Gợi ý xử lý:');
    console.log('1. Đảm bảo bạn đã nhấn nút "START" (Bắt đầu trò chuyện) với Bot trên Telegram.');
    console.log('   Nếu chưa từng nhắn tin cho Bot, Bot sẽ bị Telegram chặn quyền gửi tin cho bạn.');
    console.log('2. Đảm bảo Chat ID là chính xác (lấy từ @userinfobot hoặc @RawDataBot).\n');
  }
}

main().catch(() => { console.error('Telegram test failed'); process.exitCode = 1; });
