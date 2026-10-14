import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';

export async function bootstrapSystem(): Promise<void> {
  console.log('🚀 Starting system bootstrap...');

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters) are required for system bootstrap'
    );
  }

  // 1. Default Product Statuses
  const statuses = [
    { id: 'available', name: 'Available', iconName: 'check-circle', color: 'green', purchasable: true },
    { id: 'paused', name: 'Paused', iconName: 'pause-circle', color: 'yellow', purchasable: false },
    { id: 'sold-out', name: 'Sold Out', iconName: 'x-circle', color: 'red', purchasable: false },
  ];
  for (const s of statuses) {
    await prisma.productStatus.upsert({ where: { id: s.id }, update: s, create: s });
  }
  console.log('✅ Base product statuses bootstrapped');

  // 2. Base Topup Templates
  const templates = [
    {
      id: 'genshin-uid',
      name: 'Genshin Impact UID',
      game: 'Genshin Impact',
      description: 'Enter your Genshin Impact UID and select your server.',
      warning: 'Make sure your UID and server are correct. Orders cannot be reversed.',
      fields: [
        { key: 'uid', label: 'UID', type: 'text', placeholder: 'e.g. 800000001', required: true, pattern: '^[0-9]{9}$', hint: '9-digit number' },
        {
          key: 'server',
          label: 'Server',
          type: 'select',
          required: true,
          options: [
            { value: 'asia', label: 'Asia' },
            { value: 'europe', label: 'Europe' },
            { value: 'america', label: 'America' },
            { value: 'sar', label: 'TW/HK/MO' },
          ],
        },
      ],
    },
    {
      id: 'hoyoverse-uid',
      name: 'HoYoverse UID',
      game: 'HoYoverse',
      description: 'Enter your UID and server for HoYoverse games.',
      warning: 'Double-check your UID before placing the order.',
      fields: [
        { key: 'uid', label: 'UID', type: 'text', placeholder: 'e.g. 800000001', required: true, pattern: '^[0-9]{9}$', hint: '9-digit number' },
        {
          key: 'server',
          label: 'Server',
          type: 'select',
          required: true,
          options: [
            { value: 'asia', label: 'Asia' },
            { value: 'europe', label: 'Europe' },
            { value: 'america', label: 'America' },
            { value: 'sar', label: 'TW/HK/MO' },
          ],
        },
      ],
    },
    {
      id: 'riot-id',
      name: 'Riot ID',
      game: 'Valorant',
      description: 'Enter your Riot ID (GameName#TagLine).',
      warning: 'Include both your game name and tagline (e.g. Player#VN1).',
      fields: [
        { key: 'riotId', label: 'Riot ID', type: 'text', placeholder: 'e.g. Player#VN1', required: true, pattern: '^.+#.+', hint: 'Format: Name#Tag' },
        {
          key: 'region',
          label: 'Region',
          type: 'select',
          required: true,
          options: [
            { value: 'vn', label: 'Việt Nam' },
            { value: 'sea', label: 'Southeast Asia' },
            { value: 'ap', label: 'Asia-Pacific' },
          ],
        },
      ],
    },
    {
      id: 'boosting-account',
      name: 'Thông tin tài khoản cày thuê',
      game: 'Tất cả game',
      description: 'Nhập thông tin tài khoản để đội ngũ tiến hành cày thuê an toàn.',
      warning: 'Tài khoản được bảo mật tuyệt đối. Cam kết không dùng phần mềm thứ ba và không tiêu hao tài nguyên ngoài thỏa thuận.',
      fields: [
        { key: 'account', label: 'Tài khoản / Email đăng nhập', type: 'text', placeholder: 'Nhập username hoặc email', required: true, hint: 'Tài khoản dùng để đăng nhập vào game' },
        { key: 'password', label: 'Mật khẩu', type: 'password', placeholder: 'Nhập mật khẩu game', required: true, hint: 'Thông tin được mã hóa an toàn' },
        {
          key: 'server',
          label: 'Server / Khu vực',
          type: 'select',
          required: true,
          options: [
            { value: 'asia', label: 'Asia' },
            { value: 'vietnam', label: 'Việt Nam' },
            { value: 'america', label: 'America' },
            { value: 'europe', label: 'Europe' },
            { value: 'tw_hk_mo', label: 'TW/HK/MO' },
            { value: 'other', label: 'Khác' },
          ],
        },
        { key: 'characterName', label: 'Tên nhân vật / In-game UID', type: 'text', placeholder: 'Ví dụ: Traveler#1234', required: true, hint: 'Để đối chiếu chính xác tài khoản' },
        { key: 'twoFactorContact', label: 'Số Zalo / Phương thức gửi OTP (nếu có 2FA)', type: 'text', placeholder: 'Ví dụ: 0912345678 (Zalo) hoặc Đã tắt 2FA', required: true, hint: 'Booster sẽ nhắn nhận mã khi bắt đầu cày' },
        { key: 'note', label: 'Ghi chú & Khung giờ cày', type: 'textarea', placeholder: 'Ví dụ: Chỉ cày từ 00h-07h sáng, không dùng Nguyên thạch...', required: false, hint: 'Yêu cầu riêng của bạn' },
      ],
    },
  ];
  for (const t of templates) {
    await prisma.topupTemplate.upsert({ where: { id: t.id }, update: t, create: t });
  }
  console.log('✅ Base topup templates bootstrapped');

  // 3. Admin Account (idempotent)
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: adminPasswordHash,
      tokenVersion: { increment: 1 },
    },
    create: {
      email: adminEmail,
      name: 'DUKE1305 Administrator',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Administrator account bootstrapped (${adminEmail})`);

  // 4. Default Settings (if not already existing)
  const defaultSettings = [
    {
      id: 'middlemanInfo',
      value: {
        intro: 'Liên hệ để được tư vấn dịch vụ trung gian.',
        supportHours: '', contactTitle: 'Liên hệ hỗ trợ', contactDescription: '',
        zaloName: '', zaloPhone: '', zaloUrl: '', fees: [], feeNote: '',
        accepted: '', rejected: '', warning: '', bank: '', accountNumber: '',
        accountHolder: '', commitment: '',
      },
    },
    {
      id: 'contactInfo',
      value: {
        intro: 'Thông tin liên hệ DUKE1305.', supportHours: '',
        commitmentTitle: 'Hỗ trợ khách hàng', commitment: '', channels: [],
      },
    },
    {
      id: 'siteConfig',
      value: {
        siteName: 'DUKE1305',
        tagline: 'Fast, Safe & Affordable Game Top-Ups',
        currency: 'VND',
        currencySymbol: '₫',
        maintenanceMode: false,
        allowGuestOrders: true,
      },
    },
    {
      id: 'footerConfig',
      value: {
        showDonationBox: true,
        donationTitle: 'Nếu cảm thấy nội dung hay và hữu ích thì bạn có thể ủng hộ DUKE1305 bằng cách:',
        youtubeBtnText: 'Đăng Ký Kênh',
        youtubeUrl: 'https://youtube.com/@duke1305',
        donateBtnText: 'Donate Cho DUKE1305',
        donateUrl: 'https://me.momo.vn/duke1305',
        communityTitle: 'Tổng Hợp Tất Cả Nhóm Zalo Cộng Đồng',
        communityGroups: [
          { id: '1', name: 'Zalo Nhóm Aniimo 1', url: 'https://zalo.me/g/aniimo1' },
          { id: '2', name: 'Zalo Nhóm Aniimo 2', url: 'https://zalo.me/g/aniimo2' },
          { id: '3', name: 'Zalo Nghịch Thủy Hàn', url: 'https://zalo.me/g/nghichthuyhan' },
          { id: '4', name: 'Zalo Tinh Thể Atlan', url: 'https://zalo.me/g/atlan' },
          { id: '5', name: 'Zalo Draconia Saga', url: 'https://zalo.me/g/draconia' },
        ],
        copyrightText: '©2026 Bản Quyền Thiết Kế Thuộc Về DUKE1305.',
      },
    },
  ];
  for (const s of defaultSettings) {
    await prisma.setting.upsert({ where: { id: s.id }, update: {}, create: s });
  }
  console.log('✅ System settings bootstrapped');

  // 5. Default Catalog Tags
  const initialTags = ['Nạp game', 'Thẻ tháng', 'Thẻ hành trình', 'Ưu đãi', 'hot', 'value', 'starter', 'monthly', 'popular', 'bonus', 'premium'];
  for (const name of initialTags) {
    await prisma.catalogTag.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('✅ Catalog tags bootstrapped');
  console.log('🎉 Production bootstrap completed successfully!');
}

if (require.main === module) {
  bootstrapSystem()
    .catch((err) => {
      console.error('❌ Bootstrap failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

