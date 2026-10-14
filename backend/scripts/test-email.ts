import 'dotenv/config';
import nodemailer from 'nodemailer';
import { env } from '../src/config/env.js';

async function main() {
  console.log('\n--- 🔍 KIỂM TRA KẾT NỐI BREVO SMTP ---');
  console.log(`- SMTP Host: ${env.SMTP_HOST}`);
  console.log(`- SMTP Port: ${env.SMTP_PORT}`);
  console.log(`- SMTP User: ${env.SMTP_USER}`);
  console.log(`- Mail From: ${env.MAIL_FROM}`);
  console.log(`- Password : ${env.SMTP_PASSWORD ? '****** (Đã cấu hình)' : '❌ Chưa có'}`);

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    console.error('\n❌ Lỗi: Thiếu thông tin cấu hình SMTP trong file .env');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  console.log('\n🔄 Đang thử kết nối & xác thực với máy chủ Brevo...');

  try {
    const verified = await transporter.verify();
    console.log('✅ KẾT NỐI THÀNH CÔNG! Tài khoản và mật khẩu SMTP hợp lệ.');

    const targetEmail = process.argv[2] || 'kienphotoclone01@gmail.com';
    console.log(`\n📧 Đang thử gửi 1 email thử nghiệm đến: ${targetEmail}...`);

    const info = await transporter.sendMail({
      from: env.MAIL_FROM,
      to: targetEmail,
      subject: 'DUKE1305 - Thử nghiệm gửi email Brevo thành công!',
      text: 'Chúc mừng bạn! Cấu hình gửi mail OTP qua Brevo SMTP đã hoạt động hoàn hảo 100%.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
          <h2 style="color: #38bdf8;">🎉 DUKE1305 - Kết Nối Email Thành Công!</h2>
          <p>Hệ thống gửi mã OTP xác minh qua <b>Brevo SMTP Relay</b> đã được kích hoạt thành công.</p>
          <p style="color: #94a3b8; font-size: 13px;">Thời gian gửi: ${new Date().toLocaleString('vi-VN')}</p>
        </div>
      `,
    });

    console.log(`✅ ĐÃ GỬI THÀNH CÔNG! Message ID: ${info.messageId}`);
    console.log(`👉 Bạn vui lòng kiểm tra hộp thư đến (inbox hoặc spam) của ${targetEmail}.\n`);
  } catch (error: any) {
    console.error('\n❌ KẾT NỐI THẤT BẠI!');
    console.error(`Chi tiết lỗi: ${error.message}`);

    if (error.message.includes('525') || error.message.includes('Unauthorized IP')) {
      console.log('\n💡 NGUYÊN NHÂN & CÁCH KHẮC PHỤC:');
      console.log('Tài khoản Brevo của bạn đang bật tính năng bảo vệ "Authorized IPs".');
      console.log('👉 Bạn hãy vào link: https://app.brevo.com/security/authorised_ips');
      console.log('👉 Thêm IP máy hiện tại của bạn vào danh sách (hoặc tắt giới hạn IP).');
      console.log('Sau đó chạy lại lệnh này để kiểm tra lại!\n');
    } else if (error.message.includes('535') || error.message.includes('Authentication failed')) {
      console.log('\n💡 NGUYÊN NHÂN: Sai tên đăng nhập (SMTP_USER) hoặc mật khẩu SMTP (SMTP_PASSWORD).\n');
    }
  }
}

main();

