import 'dotenv/config';
import { migrateLegacyPasswords } from '../src/scripts/migrate_passwords.js';

migrateLegacyPasswords().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
