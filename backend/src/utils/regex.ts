
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

  return { safe: true };
}

/**
 * Execute regex.test with static safety verification and length constraint.
 */
export function safeRegexTest(pattern: string, input: string, _timeoutMs = 50): boolean {
  if (!pattern) return true;
  const strInput = typeof input === 'string' ? input : String(input);

  // If input is unreasonably long (> 500 chars), reject immediately
  if (strInput.length > 500) return false;

  // Statically check regex safety first to prevent catastrophic backtracking
  const safety = checkRegexSafety(pattern);
  if (!safety.safe) return false;

  try {
    const regex = new RegExp(pattern);
    return regex.test(strInput);
  } catch {
    return false;
  }
}

