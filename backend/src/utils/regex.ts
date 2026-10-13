import vm from 'node:vm';

export interface RegexSafetyResult {
  safe: boolean;
  error?: string;
}

/**
 * Static and dynamic checks to detect ReDoS (Regular Expression Denial of Service)
 * vulnerability or dangerous backtracking constructs.
 */
export function checkRegexSafety(pattern: string): RegexSafetyResult {
  if (!pattern || typeof pattern !== 'string') {
    return { safe: true };
  }

  // 1. Length constraint: patterns over 150 chars are excessive and dangerous
  if (pattern.length > 150) {
    return { safe: false, error: 'Biểu thức kiểm tra (pattern) không được vượt quá 150 ký tự' };
  }

  // 2. Syntax check
  try {
    new RegExp(pattern);
  } catch {
    return { safe: false, error: 'Biểu thức kiểm tra (pattern regex) cú pháp không hợp lệ' };
  }

  // 3. Static ReDoS pattern detection
  // Detect nested quantifiers such as (a+)+, (a*)*, (a+)*, (a{1,5})+
  const nestedQuantifierRegex = /\([^)]*([+*]|\{\d+,?\d*\})[^)]*\)([+*]|\{\d+,?\d*\})/;
  if (nestedQuantifierRegex.test(pattern)) {
    return { safe: false, error: 'Biểu thức chứa cấu trúc lặp lồng nhau nguy hiểm (nguy cơ ReDoS)' };
  }

  // Detect consecutive wildcards with quantifiers like .*.*, .+.*
  if (/\.[*+]\s*\.[*+]/.test(pattern)) {
    return { safe: false, error: 'Biểu thức chứa các ký tự đại diện lặp liên tiếp nguy hiểm (nguy cơ ReDoS)' };
  }

  // Detect overlapping alternatives with repetition like (a|a)+, (a|ab)+
  if (/\((?:[^|()]*\|)+[^()]*\)[+*]/.test(pattern)) {
    const altGroupMatch = pattern.match(/\(((?:[^|()]*\|)+[^()]*)\)[+*]/);
    if (altGroupMatch) {
      const branches = altGroupMatch[1].split('|');
      const hasQuantifierInBranch = branches.some((b) => /[*+]|\{\d+/.test(b));
      if (hasQuantifierInBranch) {
        return { safe: false, error: 'Biểu thức chứa nhóm phân nhánh lặp có nguy cơ ReDoS' };
      }
    }
  }

  // 4. Dynamic Sandbox Fuzzing with VM timeout
  // Test pattern against adversarial inputs designed to trigger exponential backtracking
  const adversarialInputs = [
    'a'.repeat(30) + '!',
    '0'.repeat(30) + 'x',
    ' '.repeat(30) + '_',
    'x'.repeat(30) + '?',
    'A'.repeat(25) + '@',
    '1234567890'.repeat(3) + '!',
  ];

  for (const input of adversarialInputs) {
    try {
      vm.runInNewContext(
        'regex.test(input)',
        { regex: new RegExp(pattern), input },
        { timeout: 35 } // 35ms timeout is plenty for linear regex, but halts exponential backtracking
      );
    } catch (err: any) {
      if (err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        return {
          safe: false,
          error: 'Biểu thức kiểm tra gây nghẽn xử lý (phát hiện lỗi backtracking ReDoS)',
        };
      }
      return { safe: false, error: 'Lỗi khi kiểm tra an toàn biểu thức regex' };
    }
  }

  return { safe: true };
}

/**
 * Execute regex.test in a time-bounded VM context to guarantee Node.js event loop
 * cannot be locked by unexpected adversarial customer input.
 */
export function safeRegexTest(pattern: string, input: string, timeoutMs = 50): boolean {
  if (!pattern) return true;
  const strInput = typeof input === 'string' ? input : String(input);

  // If input is unreasonably long (> 500 chars), reject immediately
  if (strInput.length > 500) return false;

  try {
    const regex = new RegExp(pattern);
    return Boolean(
      vm.runInNewContext(
        'regex.test(input)',
        { regex, input: strInput },
        { timeout: timeoutMs }
      )
    );
  } catch {
    return false;
  }
}

