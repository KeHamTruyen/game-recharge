import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL is required to run database restore.');
  process.exit(1);
}

const backupPath = process.argv[2];
if (!backupPath || !existsSync(backupPath)) {
  console.error('❌ File backup không tồn tại hoặc chưa được chỉ định.');
  console.error('👉 Sử dụng: npm run db:restore -- path/to/backup.dump');
  process.exit(1);
}

const url = new URL(databaseUrl);
url.searchParams.delete('schema');
const targetDbUrl = url.toString();

console.log(`📦 Đang tiến hành khôi phục CSDL từ file: ${backupPath}...`);

const restoreProcess = spawnSync('pg_restore', [
  '--exit-on-error',
  '--single-transaction',
  '--clean',
  '--if-exists',
  '--no-owner',
  `--dbname=${targetDbUrl}`,
  backupPath,
], { stdio: 'inherit' });

if (restoreProcess.error) {
  console.error('❌ Lỗi khi thực thi pg_restore:', restoreProcess.error.message);
  process.exit(1);
}

if (restoreProcess.status !== 0) {
  console.error(`❌ pg_restore thất bại với mã thoát: ${restoreProcess.status}`);
  process.exit(restoreProcess.status || 1);
}

console.log(`✅ Khôi phục CSDL thành công từ: ${backupPath}`);

