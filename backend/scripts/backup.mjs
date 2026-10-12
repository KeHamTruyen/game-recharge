import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL is required to run database backup.');
  process.exit(1);
}

const backupDir = join(process.cwd(), 'backups');
if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

// Clean connection URL for pg_dump
const url = new URL(databaseUrl);
url.searchParams.delete('schema');
const targetDbUrl = url.toString();

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
const filename = `duke1305_${timestamp}.dump`;
const outputPath = join(backupDir, filename);

console.log(`📦 Đang tiến hành sao lưu database vào: ${filename}...`);

const dumpProcess = spawnSync('pg_dump', [
  '--format=custom',
  '--no-owner',
  `--file=${outputPath}`,
  targetDbUrl,
], { stdio: 'inherit' });

if (dumpProcess.error) {
  console.error('❌ Lỗi khi thực thi pg_dump:', dumpProcess.error.message);
  process.exit(1);
}

if (dumpProcess.status !== 0) {
  console.error(`❌ pg_dump thất bại với mã thoát: ${dumpProcess.status}`);
  process.exit(dumpProcess.status || 1);
}

console.log(`✅ Sao lưu thành công: ${outputPath}`);

// Retention management: delete backups older than BACKUP_KEEP_DAYS (default 7 days)
const keepDays = Number(process.env.BACKUP_KEEP_DAYS || 7);
const cutoffMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;

try {
  const files = readdirSync(backupDir);
  let purgedCount = 0;
  for (const file of files) {
    if (file.startsWith('duke1305_') && file.endsWith('.dump')) {
      const filePath = join(backupDir, file);
      const stat = statSync(filePath);
      if (stat.mtimeMs < cutoffMs) {
        unlinkSync(filePath);
        purgedCount += 1;
        console.log(`🧹 Đã xóa bản sao lưu cũ: ${file}`);
      }
    }
  }
  if (purgedCount > 0) {
    console.log(`✨ Đã dọn dẹp ${purgedCount} bản sao lưu cũ hơn ${keepDays} ngày.`);
  }
} catch (cleanupErr) {
  console.warn('⚠️ Lỗi khi dọn dẹp bản sao lưu cũ:', cleanupErr.message);
}

