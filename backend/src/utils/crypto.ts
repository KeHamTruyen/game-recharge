import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';

// Primary key derived from dedicated DATA_ENCRYPTION_KEY or COOKIE_SECRET / JWT_SECRET
const primarySecretSource =
  env.DATA_ENCRYPTION_KEY ||
  process.env.DATA_ENCRYPTION_KEY ||
  env.COOKIE_SECRET ||
  env.JWT_SECRET ||
  'duke1305_fallback_key_salt_32bytes';

const PRIMARY_KEY = createHash('sha256').update(primarySecretSource).digest();

// Parse previous encryption keys for graceful secret rotation
const previousConfigKeys = (
  env.PREVIOUS_ENCRYPTION_KEYS ||
  process.env.PREVIOUS_ENCRYPTION_KEYS ||
  ''
)
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean)
  .map((k) => createHash('sha256').update(k).digest());

// Fallback keys in case JWT_SECRET, COOKIE_SECRET or PREVIOUS_ENCRYPTION_KEYS was previously used
const FALLBACK_KEYS: Buffer[] = [
  PRIMARY_KEY,
  ...previousConfigKeys,
  createHash('sha256').update(env.JWT_SECRET || 'duke1305_fallback_key_salt_32bytes').digest(),
  createHash('sha256').update(env.COOKIE_SECRET || 'duke1305_fallback_key_salt_32bytes').digest(),
  createHash('sha256').update('duke1305_fallback_key_salt_32bytes').digest(),
];

/**
 * Encrypt a string using AES-256-GCM.
 * Output format: enc:<iv-hex>:<authTag-hex>:<encrypted-hex>
 */
export function encryptSensitive(text: string): string {
  if (text === undefined || text === null || text === '') return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, PRIMARY_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Tries the primary key, followed by fallback key candidates to support secret rotation.
 */
export function decryptSensitive(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith('enc:')) return ciphertext;

  const parts = ciphertext.split(':');
  if (parts.length !== 4) return ciphertext;
  const [, ivHex, tagHex, dataHex] = parts;

  for (const key of FALLBACK_KEYS) {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(dataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Try next candidate key
    }
  }

  return '[Không thể giải mã: Khóa mã hóa đã thay đổi]';
}

/**
 * Check if a topup field key is considered sensitive (e.g. password, secret).
 * Also inspects topup template fields if provided.
 */
export function isSensitiveFieldKey(
  key: string,
  templateFields?: Array<Record<string, unknown>>
): boolean {
  if (templateFields && Array.isArray(templateFields)) {
    const field = templateFields.find((f) => String(f.key || f.id || f.name) === key);
    if (field && String(field.type).toLowerCase() === 'password') {
      return true;
    }
  }

  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    normalized.includes('pass') ||
    normalized.includes('pwd') ||
    normalized.includes('secret') ||
    normalized.includes('pin') ||
    normalized.includes('matkhau') ||
    normalized.includes('mk')
  );
}

/**
 * Process topupInfo before saving to database:
 * Encrypts sensitive fields (passwords) without trimming or altering leading/trailing characters.
 */
export function sanitizeTopupInfoForStorage(
  topupInfo: Record<string, string | number | boolean>,
  templateFields?: Array<Record<string, unknown>>
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(topupInfo)) {
    if (
      isSensitiveFieldKey(key, templateFields) &&
      typeof value === 'string' &&
      value.length > 0
    ) {
      result[key] = encryptSensitive(value); // Preserves exact value without trimming
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
  isStaffOrAdmin = false,
  templateFields?: Array<Record<string, unknown>>
): unknown {
  if (!topupInfo || typeof topupInfo !== 'object') return topupInfo;
  const entries = Object.entries(topupInfo as Record<string, unknown>);
  const result: Record<string, unknown> = {};

  for (const [key, value] of entries) {
    const isEncrypted = typeof value === 'string' && value.startsWith('enc:');
    const isSensitive = isEncrypted || isSensitiveFieldKey(key, templateFields);

    if (isSensitive) {
      if (isStaffOrAdmin) {
        if (isEncrypted) {
          result[key] = decryptSensitive(value as string);
        } else {
          // Plaintext password in legacy records: visible to staff/admin for fulfillment
          result[key] = value;
        }
      } else {
        result[key] = '••••••••';
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}
