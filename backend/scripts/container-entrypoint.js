// Runtime entrypoint for DHI images, which intentionally omit a shell.
import { cp, mkdir, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const mode = process.argv[2] || 'api';

if (mode === 'api') {
  await mkdir('/app/uploads', { recursive: true });
  try {
    for (const name of await readdir('/app/seed_uploads')) {
      try {
        await cp(`/app/seed_uploads/${name}`, `/app/uploads/${name}`, { errorOnExist: false, force: false, recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const child = spawn(process.execPath, ['/app/dist/index.js'], { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
} else if (mode === 'migrate') {
  const migrate = spawn(process.execPath, ['/app/node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit' });
  migrate.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);
    const passwords = spawn(process.execPath, ['/app/dist/scripts/migrate_passwords.js'], { stdio: 'inherit' });
    passwords.on('exit', (passwordCode) => process.exit(passwordCode ?? 1));
  });
} else {
  console.error(`Unknown container mode: ${mode}`);
  process.exit(2);
}
