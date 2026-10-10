import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';

// Derive a stable 32-byte key from JWT_SECRET or COOKIE_SECRET
const SECRET_KEY = createHash('sha256').update(env.JWT_SECRET || 'duke1305_fallback_key_salt_32bytes').digest();
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a string using AES-256-GCM.
 * Output format: enc:<iv-hex>:<authTag-hex>:<encrypted-hex>
 */
export function encryptSensitive(text: string): string {
  if (!text) return text;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 */
export function decryptSensitive(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith('enc:')) return ciphertext;
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return ciphertext;
    const [, ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(dataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '••••••••';
  }
}

/**
 * Check if a topup field key is considered sensitive (e.g. password, secret).
 */
export function isSensitiveFieldKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes('pass') || lower.includes('pwd') || lower.includes('secret') || lower.includes('pin');
}

/**
 * Process topupInfo before saving to database:
 * Encrypts sensitive fields (passwords) so they are encrypted at rest.
 */
export function sanitizeTopupInfoForStorage(
  topupInfo: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(topupInfo)) {
    if (isSensitiveFieldKey(key) && typeof value === 'string' && value.trim()) {
      result[key] = encryptSensitive(value.trim());
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Mask topupInfo before returning to clients:
 * If user is a customer, sensitive fields are masked as '••••••••'.
 * If user is staff/admin, they can be decrypted for fulfillment.
 */
export function maskTopupInfo(
  topupInfo: unknown,
  isStaffOrAdmin = false
): unknown {
  if (!topupInfo || typeof topupInfo !== 'object') return topupInfo;
  const entries = Object.entries(topupInfo as Record<string, unknown>);
  const result: Record<string, unknown> = {};

  for (const [key, value] of entries) {
    if (isSensitiveFieldKey(key)) {
      if (isStaffOrAdmin && typeof value === 'string' && value.startsWith('enc:')) {
        result[key] = decryptSensitive(value);
      } else {
        result[key] = '••••••••';
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}
