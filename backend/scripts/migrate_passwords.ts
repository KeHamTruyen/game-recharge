import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { migrateLegacyPasswords } from '../src/scripts/migrate_passwords.js';

migrateLegacyPasswords().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
