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
    const assert = require('node:assert/strict');
    const { Script } = require('node:vm');
    const {safeRegexTest, checkRegexSafety} = require('./src/utils/regex.ts');
    const pattern = '^a*a*a*a*a*a*a*a*b$';
    const input = 'a'.repeat(499) + '!';
    assert.equal(input.length, 500);
    assert.equal(checkRegexSafety(pattern).safe, true);
    const original = Script.prototype.runInNewContext;
    let timedOut = false;
    Script.prototype.runInNewContext = function (...args) {
      try { return original.apply(this, args); }
      catch (error) {
        timedOut = error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
        throw error;
      }
    };
    try {
      assert.equal(safeRegexTest(pattern, input, 20), false);
      assert.equal(timedOut, true, 'Must reach the real VM timeout, not an earlier rejection');
    } finally {
      Script.prototype.runInNewContext = original;
    }
    console.log('bounded');
  `], { timeout: 5000, encoding: 'utf8' });
  assert.ifError(probe.error);
  assert.equal(probe.status, 0, probe.stderr);
  assert.match(probe.stdout, /bounded/);
});
