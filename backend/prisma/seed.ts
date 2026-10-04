import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

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
  ];

  for (const t of templates) {
    await prisma.topupTemplate.upsert({ where: { id: t.id }, update: t, create: t });
  }
  console.log('✅ Topup templates seeded');

  // ─── Admin User ───────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@2025!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@nexatopup.vn' },
    update: {},
    create: {
      email: 'admin@nexatopup.vn',
      name: 'NEXA Admin',
      passwordHash: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Admin user seeded (admin@nexatopup.vn / Admin@2025!)');

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

  // ─── Default Settings ─────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { id: 'middlemanInfo' },
    update: {},
    create: {
      id: 'middlemanInfo',
      value: {
        title: 'Middleman Service',
        description: 'We act as a trusted middleman for all transactions. Your payment is held securely until the order is confirmed complete.',
        steps: [
          { step: 1, text: 'Place your order and complete payment.' },
          { step: 2, text: 'Our team processes your top-up request.' },
          { step: 3, text: 'Receive your in-game items and confirm.' },
          { step: 4, text: 'Transaction marked complete.' },
        ],
        guaranteeHours: 24,
        supportEmail: 'support@nexatopup.vn',
      },
    },
  });

  await prisma.setting.upsert({
    where: { id: 'contactInfo' },
    update: {},
    create: {
      id: 'contactInfo',
      value: {
        email: 'support@nexatopup.vn',
        facebook: 'https://facebook.com/nexatopup',
        zalo: '0900000000',
        discord: 'https://discord.gg/nexatopup',
        telegram: 'https://t.me/nexatopup',
        workingHours: '8:00 - 22:00 (GMT+7)',
        responseTime: 'Within 30 minutes',
      },
    },
  });

  await prisma.setting.upsert({
    where: { id: 'siteConfig' },
    update: {},
    create: {
      id: 'siteConfig',
      value: {
        siteName: 'NEXA TOPUP',
        tagline: 'Fast, Safe & Affordable Game Top-Ups',
        currency: 'VND',
        currencySymbol: '₫',
        maintenanceMode: false,
        allowGuestOrders: true,
      },
    },
  });

  console.log('✅ Settings seeded');
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
