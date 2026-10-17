import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, isAbsolute, sep } from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL is required to run database restore.');
  process.exit(1);
}

const rawArg = process.argv[2];
if (!rawArg || typeof rawArg !== 'string') {
  console.error('❌ File backup không tồn tại hoặc chưa được chỉ định.');
  console.error('👉 Sử dụng: npm run db:restore -- path/to/backup.dump');
  process.exit(1);
}

// Reject directory traversal sequences, null bytes, and non-path characters
if (!/^[a-zA-Z0-9_\-./\\:]+$/.test(rawArg) || rawArg.includes('..') || rawArg.includes('\0')) {
  console.error('❌ Đường dẫn file backup chứa ký tự không hợp lệ hoặc điều hướng thư mục không an toàn.');
  process.exit(1);
}

// Canonicalize path and enforce boundary against base or temp directories
const baseDir = resolve(process.cwd());
const tempDir = resolve(tmpdir());
const resolvedPath = isAbsolute(rawArg) ? resolve(rawArg) : resolve(baseDir, rawArg);

if (!resolvedPath.startsWith(baseDir + sep) && !resolvedPath.startsWith(tempDir + sep) && resolvedPath !== baseDir) {
  console.error('❌ Đường dẫn file backup không an toàn hoặc nằm ngoài phạm vi cho phép.');
  process.exit(1);
}

// Enforce valid backup file extensions
const validExtensions = ['.dump', '.sql', '.sql.gz'];
if (!validExtensions.some((ext) => resolvedPath.toLowerCase().endsWith(ext))) {
  console.error('❌ Định dạng file không hợp lệ. Chỉ chấp nhận các file có đuôi: .dump, .sql, .sql.gz');
  process.exit(1);
}

if (!existsSync(resolvedPath)) {
  console.error('❌ File backup không tồn tại:', resolvedPath);
  process.exit(1);
}

const stats = statSync(resolvedPath);
if (!stats.isFile()) {
  console.error('❌ Đường dẫn chỉ định không phải là một file hợp lệ.');
  process.exit(1);
}

if (stats.size === 0) {
  console.error(`❌ File backup bị rỗng (0 bytes): ${resolvedPath}`);
  process.exit(1);
}

const backupPath = resolvedPath;

// Clean connection URL: pg_restore/psql operates at database level, table schemas are preserved in the backup.
const url = new URL(databaseUrl);
url.searchParams.delete('schema');
const targetDbUrl = url.toString();

console.log(`📦 Đang tiến hành khôi phục CSDL từ file: ${backupPath} (${stats.size} bytes)...`);
console.log('🎯 Đích khôi phục: Database đích (Phạm vi Database; các schema và bảng sẽ được tái tạo)');

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


