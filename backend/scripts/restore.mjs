import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

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

const stats = statSync(backupPath);
if (stats.size === 0) {
  console.error(`❌ File backup bị rỗng (0 bytes): ${backupPath}`);
  process.exit(1);
}

// Clean connection URL: pg_restore/psql operates at database level, table schemas are preserved in the backup.
const url = new URL(databaseUrl);
url.searchParams.delete('schema');
const targetDbUrl = url.toString();
const maskedUrl = `${url.protocol}//${url.username ? '***@' : ''}${url.host}${url.pathname}`;

console.log(`📦 Đang tiến hành khôi phục CSDL từ file: ${backupPath} (${stats.size} bytes)...`);
console.log(`🎯 Đích khôi phục: ${maskedUrl} (Phạm vi Database; các schema và bảng sẽ được tái tạo)`);

const isCustomDump = backupPath.endsWith('.dump') || backupPath.endsWith('.dmp');
const isSql = backupPath.endsWith('.sql');

let restoreProcess;
if (isSql) {
  restoreProcess = spawnSync('psql', [
    '--set=ON_ERROR_STOP=1',
    '--single-transaction',
    '--file=' + backupPath,
    targetDbUrl,
  ], { stdio: 'inherit' });
} else {
  // Use pg_restore for custom format dump
  restoreProcess = spawnSync('pg_restore', [
    '--exit-on-error',
    '--single-transaction',
    '--clean',
    '--if-exists',
    '--no-owner',
    `--dbname=${targetDbUrl}`,
    backupPath,
  ], { stdio: 'inherit' });
}

if (restoreProcess.error) {
  console.error('❌ Lỗi khi thực thi khôi phục:', restoreProcess.error.message);
  process.exit(1);
}

if (restoreProcess.status !== 0) {
  console.error(`❌ Khôi phục thất bại với mã thoát: ${restoreProcess.status}`);
  process.exit(restoreProcess.status || 1);
}

console.log(`✅ Khôi phục CSDL thành công từ: ${backupPath}`);


