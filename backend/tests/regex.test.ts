import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { checkRegexSafety, safeRegexTest } from '../src/utils/regex.js';

it('rejects overlapping alternatives and preserves ordinary validation', () => {
  assert.equal(checkRegexSafety('^(a|aa)+$').safe, false);
  assert.equal(safeRegexTest('^(a|aa)+$', 'a'.repeat(45) + '!'), false);
  assert.equal(safeRegexTest('^[0-9]{9}$', '800123456'), true);
  assert.equal(safeRegexTest('^[0-9]{9}$', 'invalid'), false);
});

it('bounds patterns missed by static checks without blocking the test process', () => {
  // Separate process also bounds a regression that removes the execution deadline.
  const probe = spawnSync(process.execPath, ['--import', 'tsx', '-e', `
    const {safeRegexTest} = require('./src/utils/regex.ts');
    if (safeRegexTest('^a*a*a*a*a*a*a*a*b$', 'a'.repeat(500) + '!', 20) !== false) process.exit(1);
    console.log('bounded');
  `], { timeout: 5000, encoding: 'utf8' });
  assert.ifError(probe.error);
  assert.equal(probe.status, 0, probe.stderr);
  assert.match(probe.stdout, /bounded/);
});
