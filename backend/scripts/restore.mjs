import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

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

const isGzipSql = backupPath.toLowerCase().endsWith('.sql.gz');
const isSql = isGzipSql || backupPath.toLowerCase().endsWith('.sql');
let tempDirectory;
let sqlPath = backupPath;

try {
  if (isGzipSql) {
    tempDirectory = await mkdtemp(join(tmpdir(), 'duke-restore-'));
    sqlPath = join(tempDirectory, 'backup.sql');
    // Verify the entire gzip before touching the database; a broken stream must never commit partial SQL.
    await pipeline(createReadStream(backupPath), createGunzip(), createWriteStream(sqlPath, { mode: 0o600 }));
    if (statSync(sqlPath).size === 0) throw new Error('Backup SQL is empty');
  }
  let restoreProcess;
  if (isSql) {
    restoreProcess = spawnSync('psql', [
      '--set=ON_ERROR_STOP=1',
      '--single-transaction',
      '--file=' + sqlPath,
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
    throw restoreProcess.error;
  }

  if (restoreProcess.status !== 0) {
    throw new Error(`Khôi phục thất bại với mã thoát: ${restoreProcess.status}`);
  }

  console.log(`✅ Khôi phục CSDL thành công từ: ${backupPath}`);
} catch (error) {
  console.error('❌ Khôi phục thất bại:', error.message);
  process.exitCode = 1;
} finally {
  if (tempDirectory) {
    await unlink(sqlPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await rmdir(tempDirectory);
  }
}


