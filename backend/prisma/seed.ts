import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) are required to seed the admin account'
    );
  }

  // ─── Product Statuses ─────────────────────────────────────────────────────
  const statuses = [
    { id: 'available', name: 'Available', iconName: 'check-circle', color: 'green', purchasable: true },
    { id: 'paused', name: 'Paused', iconName: 'pause-circle', color: 'yellow', purchasable: false },
    { id: 'sold-out', name: 'Sold Out', iconName: 'x-circle', color: 'red', purchasable: false },
  ];

  for (const s of statuses) {
    await prisma.productStatus.upsert({ where: { id: s.id }, update: s, create: s });
  }
  console.log('✅ Product statuses seeded');

  // ─── Topup Templates ──────────────────────────────────────────────────────
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
      description: 'Enter your Riot ID (username#tag) and region.',
      warning: 'Your Riot ID must be exact including the tag.',
      fields: [
        { key: 'riotId', label: 'Riot ID', type: 'text', placeholder: 'e.g. PlayerName#VN1', required: true, hint: 'Format: Name#Tag' },
        {
          key: 'region',
          label: 'Region',
          type: 'select',
          required: true,
          options: [
            { value: 'ap', label: 'Asia Pacific' },
            { value: 'eu', label: 'Europe' },
            { value: 'na', label: 'North America' },
            { value: 'latam', label: 'Latin America' },
            { value: 'br', label: 'Brazil' },
            { value: 'kr', label: 'Korea' },
          ],
        },
      ],
    },
    {
      id: 'wuwa-uid',
      name: 'Wuthering Waves UID',
      game: 'Wuthering Waves',
      description: 'Enter your Wuthering Waves UID and server.',
      warning: 'Verify your UID on the in-game profile screen.',
      fields: [
        { key: 'uid', label: 'UID', type: 'text', placeholder: 'e.g. 200000001', required: true, hint: '9-digit number' },
        {
          key: 'server',
          label: 'Server',
          type: 'select',
          required: true,
          options: [
            { value: 'asia', label: 'Asia' },
            { value: 'europe', label: 'Europe' },
            { value: 'america', label: 'America' },
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
  console.log('✅ Topup templates seeded');

  // ─── Admin User ───────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      email: adminEmail,
      name: 'DUKE1305 Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Admin user seeded (${adminEmail})`);

  // ─── Test Customer User ───────────────────────────────────────────────────
  const customerPasswordHash = await bcrypt.hash('123456', 12);
  await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: { passwordHash: customerPasswordHash, status: 'ACTIVE' },
    create: {
      email: 'customer@test.com',
      name: 'Test Customer',
      passwordHash: customerPasswordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Customer user seeded (customer@test.com)');

  // ─── Services & Packages ──────────────────────────────────────────────────

  // Genshin Impact
  const genshin = await prisma.service.upsert({
    where: { id: 'svc-genshin' },
    update: {},
    create: {
      id: 'svc-genshin',
      name: 'Genshin Impact',
      game: 'Genshin Impact',
      description: 'Top up Genesis Crystals for Genshin Impact. Fast delivery, safe & secure.',
      iconText: 'GI',
      tone: 'blue',
      sortOrder: 1,
      isActive: true,
    },
  });

  const genshinPackages = [
    { name: '60 Genesis Crystals', description: 'Equivalent to 60 Primogems', price: 15000, oldPrice: null, tags: ['popular'], statusId: 'available', templateId: 'genshin-uid', note: '' },
    { name: '300 Genesis Crystals', description: 'Equivalent to 300 Primogems', price: 75000, oldPrice: 80000, tags: ['value'], statusId: 'available', templateId: 'genshin-uid', note: 'Best value' },
    { name: '980 Genesis Crystals', description: 'Equivalent to 980 Primogems + 110 bonus', price: 230000, oldPrice: 250000, tags: ['hot', 'bonus'], statusId: 'available', templateId: 'genshin-uid', note: '+110 bonus' },
    { name: '1980 Genesis Crystals', description: 'Equivalent to 1980 Primogems + 260 bonus', price: 450000, oldPrice: 480000, tags: ['hot', 'bonus'], statusId: 'available', templateId: 'genshin-uid', note: '+260 bonus' },
    { name: '3280 Genesis Crystals', description: 'Equivalent to 3280 Primogems + 600 bonus', price: 720000, oldPrice: null, tags: ['bonus'], statusId: 'available', templateId: 'genshin-uid', note: '+600 bonus' },
    { name: '6480 Genesis Crystals', description: 'Equivalent to 6480 Primogems + 1600 bonus', price: 1380000, oldPrice: null, tags: ['premium', 'bonus'], statusId: 'available', templateId: 'genshin-uid', note: '+1600 bonus' },
  ];

  for (let i = 0; i < genshinPackages.length; i++) {
    const pkg = genshinPackages[i];
    if (pkg) {
      await prisma.servicePackage.upsert({
        where: { id: `pkg-genshin-${i + 1}` },
        update: {},
        create: {
          id: `pkg-genshin-${i + 1}`,
          serviceId: genshin.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          oldPrice: pkg.oldPrice ?? undefined,
          note: pkg.note,
          tags: pkg.tags,
          statusId: pkg.statusId,
          templateId: pkg.templateId,
          sortOrder: i + 1,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Genshin Impact seeded');

  // Honkai: Star Rail
  const hsr = await prisma.service.upsert({
    where: { id: 'svc-hsr' },
    update: {},
    create: {
      id: 'svc-hsr',
      name: 'Honkai: Star Rail',
      game: 'Honkai: Star Rail',
      description: 'Top up Oneiric Shards for Honkai: Star Rail. Instant delivery guaranteed.',
      iconText: 'HSR',
      tone: 'purple',
      sortOrder: 2,
      isActive: true,
    },
  });

  const hsrPackages = [
    { name: '60 Oneiric Shards', description: '60 Oneiric Shards', price: 15000, oldPrice: null, tags: [], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '300 Oneiric Shards', description: '300 Oneiric Shards', price: 75000, oldPrice: 80000, tags: ['value'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '980 Oneiric Shards', description: '980 Oneiric Shards + 110 bonus', price: 230000, oldPrice: null, tags: ['hot', 'bonus'], statusId: 'available', templateId: 'hoyoverse-uid', note: '+110 bonus' },
    { name: '1980 Oneiric Shards', description: '1980 Oneiric Shards + 260 bonus', price: 450000, oldPrice: 480000, tags: ['hot', 'bonus'], statusId: 'available', templateId: 'hoyoverse-uid', note: '+260 bonus' },
    { name: '3280 Oneiric Shards', description: '3280 Oneiric Shards + 600 bonus', price: 720000, oldPrice: null, tags: ['bonus'], statusId: 'available', templateId: 'hoyoverse-uid', note: '+600 bonus' },
    { name: '6480 Oneiric Shards', description: '6480 Oneiric Shards + 1600 bonus', price: 1380000, oldPrice: null, tags: ['premium', 'bonus'], statusId: 'available', templateId: 'hoyoverse-uid', note: '+1600 bonus' },
  ];

  for (let i = 0; i < hsrPackages.length; i++) {
    const pkg = hsrPackages[i];
    if (pkg) {
      await prisma.servicePackage.upsert({
        where: { id: `pkg-hsr-${i + 1}` },
        update: {},
        create: {
          id: `pkg-hsr-${i + 1}`,
          serviceId: hsr.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          oldPrice: pkg.oldPrice ?? undefined,
          note: pkg.note,
          tags: pkg.tags,
          statusId: pkg.statusId,
          templateId: pkg.templateId,
          sortOrder: i + 1,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Honkai: Star Rail seeded');

  // Zenless Zone Zero
  const zzz = await prisma.service.upsert({
    where: { id: 'svc-zzz' },
    update: {},
    create: {
      id: 'svc-zzz',
      name: 'Zenless Zone Zero',
      game: 'Zenless Zone Zero',
      description: 'Top up Monochrome for Zenless Zone Zero. Competitive prices.',
      iconText: 'ZZZ',
      tone: 'yellow',
      sortOrder: 3,
      isActive: true,
    },
  });

  const zzzPackages = [
    { name: '60 Monochrome', description: '60 Monochrome', price: 15000, tags: [], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '300 Monochrome', description: '300 Monochrome', price: 75000, tags: ['value'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '980 Monochrome', description: '980 Monochrome + bonus', price: 230000, tags: ['hot'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '1980 Monochrome', description: '1980 Monochrome + bonus', price: 450000, tags: ['hot'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '3280 Monochrome', description: '3280 Monochrome + bonus', price: 720000, tags: [], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '6480 Monochrome', description: '6480 Monochrome + bonus', price: 1380000, tags: ['premium'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
  ];

  for (let i = 0; i < zzzPackages.length; i++) {
    const pkg = zzzPackages[i];
    if (pkg) {
      await prisma.servicePackage.upsert({
        where: { id: `pkg-zzz-${i + 1}` },
        update: {},
        create: {
          id: `pkg-zzz-${i + 1}`,
          serviceId: zzz.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          note: pkg.note,
          tags: pkg.tags,
          statusId: pkg.statusId,
          templateId: pkg.templateId,
          sortOrder: i + 1,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Zenless Zone Zero seeded');

  // Wuthering Waves
  const wuwa = await prisma.service.upsert({
    where: { id: 'svc-wuwa' },
    update: {},
    create: {
      id: 'svc-wuwa',
      name: 'Wuthering Waves',
      game: 'Wuthering Waves',
      description: 'Top up Lunite for Wuthering Waves at the best rates.',
      iconText: 'WW',
      tone: 'teal',
      sortOrder: 4,
      isActive: true,
    },
  });

  const wuwaPackages = [
    { name: '60 Lunite', description: '60 Lunite', price: 15000, tags: [], statusId: 'available', templateId: 'wuwa-uid', note: '' },
    { name: '300 Lunite', description: '300 Lunite', price: 72000, tags: ['value'], statusId: 'available', templateId: 'wuwa-uid', note: '' },
    { name: '980 Lunite', description: '980 Lunite + bonus', price: 220000, tags: ['hot'], statusId: 'available', templateId: 'wuwa-uid', note: '' },
    { name: '1980 Lunite', description: '1980 Lunite + bonus', price: 440000, tags: ['hot'], statusId: 'available', templateId: 'wuwa-uid', note: '' },
    { name: '3280 Lunite', description: '3280 Lunite + bonus', price: 700000, tags: [], statusId: 'available', templateId: 'wuwa-uid', note: '' },
    { name: '6480 Lunite', description: '6480 Lunite + bonus', price: 1350000, tags: ['premium'], statusId: 'available', templateId: 'wuwa-uid', note: '' },
  ];

  for (let i = 0; i < wuwaPackages.length; i++) {
    const pkg = wuwaPackages[i];
    if (pkg) {
      await prisma.servicePackage.upsert({
        where: { id: `pkg-wuwa-${i + 1}` },
        update: {},
        create: {
          id: `pkg-wuwa-${i + 1}`,
          serviceId: wuwa.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          note: pkg.note,
          tags: pkg.tags,
          statusId: pkg.statusId,
          templateId: pkg.templateId,
          sortOrder: i + 1,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Wuthering Waves seeded');

  // Valorant
  const valorant = await prisma.service.upsert({
    where: { id: 'svc-valorant' },
    update: {},
    create: {
      id: 'svc-valorant',
      name: 'Valorant',
      game: 'Valorant',
      description: 'Top up Valorant Points (VP) for Valorant. Skins, Battlepass and more.',
      iconText: 'VAL',
      tone: 'red',
      sortOrder: 5,
      isActive: true,
    },
  });

  const valorantPackages = [
    { name: '475 VP', description: '475 Valorant Points', price: 85000, tags: [], statusId: 'available', templateId: 'riot-id', note: '' },
    { name: '1000 VP', description: '1000 Valorant Points', price: 170000, tags: ['value'], statusId: 'available', templateId: 'riot-id', note: '' },
    { name: '2050 VP', description: '2050 Valorant Points', price: 330000, tags: ['popular'], statusId: 'available', templateId: 'riot-id', note: '' },
    { name: '3650 VP', description: '3650 Valorant Points', price: 580000, tags: ['hot'], statusId: 'available', templateId: 'riot-id', note: '' },
    { name: '5350 VP', description: '5350 Valorant Points', price: 830000, tags: ['hot'], statusId: 'available', templateId: 'riot-id', note: '' },
    { name: '11000 VP', description: '11000 Valorant Points', price: 1650000, tags: ['premium'], statusId: 'available', templateId: 'riot-id', note: 'Best rate per VP' },
  ];

  for (let i = 0; i < valorantPackages.length; i++) {
    const pkg = valorantPackages[i];
    if (pkg) {
      await prisma.servicePackage.upsert({
        where: { id: `pkg-valorant-${i + 1}` },
        update: {},
        create: {
          id: `pkg-valorant-${i + 1}`,
          serviceId: valorant.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          note: pkg.note,
          tags: pkg.tags,
          statusId: pkg.statusId,
          templateId: pkg.templateId,
          sortOrder: i + 1,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Valorant seeded');

  // Honkai Impact 3
  const hi3 = await prisma.service.upsert({
    where: { id: 'svc-hi3' },
    update: {},
    create: {
      id: 'svc-hi3',
      name: 'Honkai Impact 3',
      game: 'Honkai Impact 3',
      description: 'Top up Crystals for Honkai Impact 3. Unlock the best Valkyries.',
      iconText: 'HI3',
      tone: 'pink',
      sortOrder: 6,
      isActive: true,
    },
  });

  const hi3Packages = [
    { name: '60 Crystals', description: '60 Crystals', price: 15000, tags: [], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '300 Crystals', description: '300 Crystals', price: 75000, tags: ['value'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '980 Crystals', description: '980 Crystals + bonus', price: 230000, tags: ['hot'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '1980 Crystals', description: '1980 Crystals + bonus', price: 450000, tags: ['hot'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '3280 Crystals', description: '3280 Crystals + bonus', price: 720000, tags: [], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
    { name: '6480 Crystals', description: '6480 Crystals + bonus', price: 1380000, tags: ['premium'], statusId: 'available', templateId: 'hoyoverse-uid', note: '' },
  ];

  for (let i = 0; i < hi3Packages.length; i++) {
    const pkg = hi3Packages[i];
    if (pkg) {
      await prisma.servicePackage.upsert({
        where: { id: `pkg-hi3-${i + 1}` },
        update: {},
        create: {
          id: `pkg-hi3-${i + 1}`,
          serviceId: hi3.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          note: pkg.note,
          tags: pkg.tags,
          statusId: pkg.statusId,
          templateId: pkg.templateId,
          sortOrder: i + 1,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Honkai Impact 3 seeded');

  // Aniimo
  const aniimo = await prisma.service.upsert({
    where: { id: 'svc-aniimo' },
    update: {
      image: '/uploads/animo.jpg',
      imagePosition: 'center',
    },
    create: {
      id: 'svc-aniimo',
      name: 'Aniimo',
      game: 'Aniimo',
      description: 'Nạp tài nguyên và gói ưu đãi cho game Aniimo nhanh chóng, bảo mật.',
      iconText: 'ANI',
      tone: 'emerald',
      image: '/uploads/animo.jpg',
      imagePosition: 'center',
      sortOrder: 7,
      isActive: true,
    },
  });

  const aniimoPackages = [
    { name: 'Gói Tân Thủ Aniimo', description: 'Gói ưu đãi khởi đầu Aniimo', price: 49000, tags: ['starter'], statusId: 'available', templateId: 'genshin-uid', note: 'Ưu đãi', image: '/uploads/animo.jpg' },
    { name: 'Thẻ Tháng Aniimo Pass', description: 'Nhận quà mỗi ngày 30 ngày', price: 119000, tags: ['monthly'], statusId: 'available', templateId: 'genshin-uid', note: 'Bán chạy', image: '/uploads/animo.jpg' },
    { name: 'Gói 980 Đá Aniimo', description: '980 Đá nạp trực tiếp qua UID', price: 349000, tags: ['hot'], statusId: 'available', templateId: 'genshin-uid', note: 'Phổ biến', image: '/uploads/animo.jpg' },
    { name: 'Gói 1980 Đá Aniimo', description: '1980 Đá nạp trực tiếp qua UID', price: 699000, tags: ['premium'], statusId: 'available', templateId: 'genshin-uid', note: 'Giá tốt', image: '/uploads/animo.jpg' },
  ];

  for (let i = 0; i < aniimoPackages.length; i++) {
    const pkg = aniimoPackages[i];
    if (pkg) {
      await prisma.servicePackage.upsert({
        where: { id: `pkg-aniimo-${i + 1}` },
        update: { image: pkg.image },
        create: {
          id: `pkg-aniimo-${i + 1}`,
          serviceId: aniimo.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          note: pkg.note,
          tags: pkg.tags,
          statusId: pkg.statusId,
          templateId: pkg.templateId,
          image: pkg.image,
          sortOrder: i + 1,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Aniimo seeded');

  // ─── Boosting Services & Packages ──────────────────────────────────────────
  const boostingServicesData = [
    {
      id: 'svc-boost-genshin',
      name: 'Genshin Impact',
      game: 'Genshin Impact',
      category: 'boosting',
      description: 'Cày thuê Genshin Impact: La Hoàn Thâm Cảnh 36*, Map 100%, Thần Đồng, Farm Boss & Đột phá nhân vật.',
      iconText: 'GI',
      tone: 'blue',
      sortOrder: 101,
      packages: [
        { name: 'Clear La Hoàn Thâm Cảnh Tầng 12 (36 Sao)', description: 'Clear full 36 sao La Hoàn mùa hiện tại.', price: 80000, oldPrice: 100000, tags: ['Leo Rank', 'Hot'], note: '36 Sao full' },
        { name: 'Thám Hiểm & Mở Rương 100% Vùng Mới', description: 'Dọn sạch 100% bản đồ khu vực chỉ định, full Thần Đồng.', price: 250000, oldPrice: 300000, tags: ['Khám phá Map'], note: 'Kèm Thần Đồng' },
        { name: 'Gói Daily + Xả Nhựa Trọn Gói 30 Ngày', description: 'Ủy thác hàng ngày, xả nhựa cô đặc liên tục 30 ngày.', price: 150000, oldPrice: 180000, tags: ['Trọn gói', 'Tiết kiệm'], note: 'Trọn gói' },
        { name: 'Chuỗi Nhiệm Vụ Ma Thần Trọn Gói', description: 'Hoàn thành toàn bộ nhiệm vụ cốt truyện chính tuyến mới.', price: 120000, oldPrice: 150000, tags: ['Nhiệm vụ'], note: 'Cốt truyện' },
        { name: 'Farm Đột Phá Nhân Vật Lv 90 + Thiên Phú 9/9/9', description: 'Farm toàn bộ boss thế giới và sách thiên phú đủ nâng 1 nhân vật.', price: 180000, oldPrice: 220000, tags: ['Farm Đồ'], note: 'Full đồ' },
      ],
    },
    {
      id: 'svc-boost-hsr',
      name: 'Honkai: Star Rail',
      game: 'Honkai: Star Rail',
      category: 'boosting',
      description: 'Cày thuê Honkai Star Rail: MOC 12*, Hư Cấu Kể Chuyện, Tận Diệt Vũ Trụ Mô Phỏng, Farm Di Vật.',
      iconText: 'HSR',
      tone: 'violet',
      sortOrder: 102,
      packages: [
        { name: 'Clear Sảnh Đường Lãng Quên (MOC 12 Sao)', description: 'Vượt qua toàn bộ tầng 10 - 12 Sảnh Đường Lãng Quên.', price: 70000, oldPrice: 90000, tags: ['Khiêu chiến', 'Hot'], note: 'Full 12 Sao' },
        { name: 'Hư Cấu Kể Chuyện & Ảo Ảnh Tận Cùng Full Sao', description: 'Hoàn thành tối đa điểm số Hư Cấu Kể Chuyện mùa mới.', price: 80000, oldPrice: 100000, tags: ['Khiêu chiến'], note: 'Cực nhanh' },
        { name: 'Dọn Rương & Khám Phá Toàn Bộ Map 100%', description: 'Thu thập toàn bộ rương báu và câu đố trên toàn bản đồ.', price: 200000, oldPrice: 250000, tags: ['Khám phá Map'], note: 'Full rương' },
        { name: 'Gói Daily + Năng Lượng Khai Phá 30 Ngày', description: 'Điểm danh, nhiệm vụ thường nhật và xả năng lượng 30 ngày.', price: 140000, oldPrice: 160000, tags: ['Trọn gói'], note: 'Tiết kiệm' },
      ],
    },
    {
      id: 'svc-boost-zzz',
      name: 'Zenless Zone Zero',
      game: 'Zenless Zone Zero',
      category: 'boosting',
      description: 'Cày thuê ZZZ: Phòng thủ Shiyu Defense S-Rank, Lỗ Hổng Không Gian Hollow Zero, Ủy thác đặc biệt.',
      iconText: 'ZZZ',
      tone: 'amber',
      sortOrder: 103,
      packages: [
        { name: 'Clear Shiyu Defense S-Rank Toàn Bộ Vòng', description: 'Đạt hạng S toàn bộ các tầng Phòng Thủ Shiyu trong chu kỳ.', price: 80000, oldPrice: 100000, tags: ['Khiêu chiến', 'Hot'], note: 'S-Rank' },
        { name: 'Cày Lỗ Hổng Không Gian Hollow Zero Max Cấp', description: 'Cày tối đa điểm tuần Hollow Zero và nhận trọn phần thưởng.', price: 100000, oldPrice: 120000, tags: ['Khám phá'], note: 'Max điểm' },
      ],
    },
    {
      id: 'svc-boost-wuwa',
      name: 'Wuthering Waves',
      game: 'Wuthering Waves',
      category: 'boosting',
      description: 'Cày thuê Wuthering Waves: Tháp Nghịch Cảnh, Rương Map 100%, Sonance Casket, Farm Echo Cost 3 & 4.',
      iconText: 'WW',
      tone: 'cyan',
      sortOrder: 104,
      packages: [
        { name: 'Clear Tháp Nghịch Cảnh (Tower of Adversity) 30 Sao', description: 'Đạt tối đa 30 huy hiệu Tháp Nghịch Cảnh Hazard Zone.', price: 90000, oldPrice: 120000, tags: ['Khiêu chiến', 'Hot'], note: 'Full 30 Sao' },
        { name: 'Khám Phá Bản Đồ 100% & Thu Thập Sonance Casket', description: '100% thám hiểm toàn bộ khu vực Hoàng Long, full Sonance Casket.', price: 220000, oldPrice: 260000, tags: ['Khám phá Map'], note: '100% Map' },
        { name: 'Farm 5 Echo Cost 3 & 4 Chuẩn Dòng Chính', description: 'Săn boss và quái đạt 5 Echo đúng bộ nguyên tố và dòng chính.', price: 150000, oldPrice: 180000, tags: ['Farm Đồ'], note: 'Chuẩn dòng' },
      ],
    },
    {
      id: 'svc-boost-valorant',
      name: 'Valorant',
      game: 'Valorant',
      category: 'boosting',
      description: 'Kéo Rank Valorant Duo / Solo, Cày Battle Pass, hoàn thành nhiệm vụ đặc vụ thần tốc.',
      iconText: 'VAL',
      tone: 'red',
      sortOrder: 105,
      packages: [
        { name: 'Kéo Rank Đồng -> Vàng (Duo / Solo)', description: 'Leo bậc xếp hạng thi đấu từ Hạng Đồng lên Hạng Vàng.', price: 120000, oldPrice: 150000, tags: ['Leo Rank'], note: 'Winrate cao' },
        { name: 'Kéo Rank Vàng -> Bạch Kim', description: 'Kéo rank từ Vàng lên Bạch Kim, booster bắn tay 100%.', price: 180000, oldPrice: 220000, tags: ['Leo Rank', 'Hot'], note: 'Bảo đảm KDA' },
        { name: 'Kéo Rank Bạch Kim -> Kim Cương', description: 'Bứt phá lên Kim Cương chuyên nghiệp hoàn thành dưới 24h.', price: 280000, oldPrice: 350000, tags: ['Leo Rank'], note: 'Pro Player' },
      ],
    },
    {
      id: 'svc-boost-aniimo',
      name: 'Aniimo',
      game: 'Aniimo',
      category: 'boosting',
      description: 'Cày cấp Aniimo, farm mảnh tiến hóa, săn boss thế giới và mở khóa kỹ năng tối thượng.',
      iconText: 'ANI',
      tone: 'emerald',
      image: '/uploads/animo.jpg',
      sortOrder: 106,
      packages: [
        { name: 'Cày Cấp Aniimo Lv 1 -> 50 & Mở Khóa Skill', description: 'Luyện cấp tối đa cho 1 Aniimo, mở khóa toàn bộ kỹ năng.', price: 90000, oldPrice: 110000, tags: ['Cày cấp', 'Hot'], note: 'Max cấp' },
        { name: 'Farm Nguyên Liệu Tiến Hóa Aniimo Trọn Gói', description: 'Săn boss dã ngoại thu thập đầy đủ đá tiến hóa bậc 3.', price: 120000, oldPrice: 150000, tags: ['Farm Đồ'], note: 'Đủ đá EV' },
      ],
    },
    {
      id: 'svc-boost-lqmb',
      name: 'Liên Quân Mobile',
      game: 'Liên Quân Mobile',
      category: 'boosting',
      description: 'Kéo rank Liên Quân Mobile Solo / Duo từ Kim Cương đến Cao Thủ, Chiến Tướng uy tín số 1.',
      iconText: 'LQ',
      tone: 'amber',
      sortOrder: 107,
      packages: [
        { name: 'Kéo Rank Kim Cương -> Tinh Anh (1 Bậc)', description: 'Leo rank tốc độ cao, booster Top Tướng cày tay 100%.', price: 70000, oldPrice: 90000, tags: ['Leo Rank'], note: 'Thần tốc' },
        { name: 'Kéo Rank Tinh Anh -> Cao Thủ', description: 'Cày lên Cao Thủ đạt khung danh hiệu, cam kết win 90%+.', price: 140000, oldPrice: 180000, tags: ['Leo Rank', 'Hot'], note: 'Win 90%+' },
        { name: 'Kéo Cao Thủ -> Chiến Tướng (+10 Sao)', description: 'Kéo liên tiếp 10 sao Cao Thủ tiến tới Chiến Tướng.', price: 180000, oldPrice: 220000, tags: ['Leo Rank'], note: 'Top BXH' },
      ],
    },
  ];

  for (const bSvc of boostingServicesData) {
    const createdSvc = await prisma.service.upsert({
      where: { id: bSvc.id },
      update: {
        name: bSvc.name,
        game: bSvc.game,
        category: bSvc.category,
        description: bSvc.description,
        iconText: bSvc.iconText,
        tone: bSvc.tone,
        image: bSvc.image,
        sortOrder: bSvc.sortOrder,
      },
      create: {
        id: bSvc.id,
        name: bSvc.name,
        game: bSvc.game,
        category: bSvc.category,
        description: bSvc.description,
        iconText: bSvc.iconText,
        tone: bSvc.tone,
        image: bSvc.image,
        sortOrder: bSvc.sortOrder,
        isActive: true,
      },
    });

    for (let i = 0; i < bSvc.packages.length; i++) {
      const pkg = bSvc.packages[i]!;
      await prisma.servicePackage.upsert({
        where: { id: `pkg-${bSvc.id}-${i + 1}` },
        update: {
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          oldPrice: pkg.oldPrice,
          note: pkg.note,
          tags: pkg.tags,
        },
        create: {
          id: `pkg-${bSvc.id}-${i + 1}`,
          serviceId: createdSvc.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          oldPrice: pkg.oldPrice,
          note: pkg.note,
          tags: pkg.tags,
          statusId: 'available',
          templateId: 'boosting-account',
          sortOrder: i + 1,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Boosting services seeded');

  // ─── Default Settings ─────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { id: 'middlemanInfo' },
    update: {},
    create: {
      id: 'middlemanInfo',
      value: {
        intro: 'Liên hệ để được tư vấn dịch vụ trung gian.',
        supportHours: '', contactTitle: 'Liên hệ hỗ trợ', contactDescription: '',
        zaloName: '', zaloPhone: '', zaloUrl: '', fees: [], feeNote: '',
        accepted: '', rejected: '', warning: '', bank: '', accountNumber: '',
        accountHolder: '', commitment: '',
      },
    },
  });

  await prisma.setting.upsert({
    where: { id: 'contactInfo' },
    update: {},
    create: {
      id: 'contactInfo',
      value: {
        intro: 'Thông tin liên hệ DUKE1305.', supportHours: '',
        commitmentTitle: 'Hỗ trợ khách hàng', commitment: '', channels: [],
      },
    },
  });

  await prisma.setting.upsert({
    where: { id: 'siteConfig' },
    update: {},
    create: {
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
  });

  console.log('✅ Settings seeded');

  // ─── Catalog Tags ────────────────────────────────────────────────────────
  const initialTags = ['Nạp game', 'Thẻ tháng', 'Thẻ hành trình', 'Ưu đãi', 'hot', 'value', 'starter', 'monthly', 'popular', 'bonus', 'premium'];
  for (const name of initialTags) {
    await prisma.catalogTag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('✅ Catalog tags seeded');
  console.log('\n🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
