import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';

// Primary key derived from dedicated DATA_ENCRYPTION_KEY (mandatory in production)
const primarySecretSource =
  env.DATA_ENCRYPTION_KEY ||
  (() => {
    if (env.NODE_ENV === 'production') {
      throw new Error('FATAL: DATA_ENCRYPTION_KEY must be configured in production');
    }
    return env.COOKIE_SECRET || env.JWT_SECRET || 'duke1305_fallback_key_salt_32bytes';
  })();

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

// Fallback keys in case rotation occurred
const FALLBACK_KEYS: Buffer[] = [
  PRIMARY_KEY,
  ...previousConfigKeys,
  ...(env.NODE_ENV === 'production'
    ? []
    : [
        createHash('sha256').update(env.JWT_SECRET || 'duke1305_fallback_key_salt_32bytes').digest(),
        createHash('sha256').update(env.COOKIE_SECRET || 'duke1305_fallback_key_salt_32bytes').digest(),
        createHash('sha256').update('duke1305_fallback_key_salt_32bytes').digest(),
      ]),
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

export const KNOWN_PUBLIC_TOPUP_KEYS = new Set([
  'uid',
  'server',
  'character',
  'charactername',
  'riotid',
  'tagline',
  'zoneid',
  'playerid',
  'roleid',
  'region',
  'note',
  'email',
  'contactemail',
  'phone',
  'ign',
  'ingamename',
  'account',
  'username',
]);

export function isKnownPublicField(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return KNOWN_PUBLIC_TOPUP_KEYS.has(normalized);
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
    normalized.includes('mk') ||
    normalized.includes('credential') ||
    normalized.includes('token') ||
    normalized.includes('auth')
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
    if (isSensitiveFieldKey(key, templateFields)) {
      if (value !== null && value !== undefined && value !== '') {
        const strVal = typeof value === 'string' ? value : String(value);
        result[key] = encryptSensitive(strVal); // Preserves exact characters without trimming
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Check if a topup field should be treated as private/confidential.
 * Known public game identifiers (like UID, Server, Riot ID) are NEVER private.
 * Passwords, tokens, credentials, and unrecognized orphan fields without template are private.
 */
export function isPrivateTopupField(key: string, fields?: unknown): boolean {
  if (isSensitiveFieldKey(key, Array.isArray(fields) ? (fields as Array<Record<string, unknown>>) : undefined)) {
    return true;
  }

  if (isKnownPublicField(key)) {
    return false;
  }

  if (Array.isArray(fields) && fields.length > 0) {
    const field = fields.find((f) => String(f?.key || f?.id || f?.name) === key);
    if (field) {
      return String(field.type).toLowerCase() === 'password';
    }
  }

  return true;
}

/**
 * Mask topupInfo before returning to clients:
 * If user is a customer, sensitive fields are masked as '••••••••'.
 * If user is staff/admin, they can be decrypted for fulfillment.
 */
export function maskTopupInfo(
  topupInfo: unknown,
  isStaffOrAdmin = false,
  templateFields?: unknown
): unknown {
  if (!topupInfo || typeof topupInfo !== 'object') return topupInfo;
  const entries = Object.entries(topupInfo as Record<string, unknown>);
  const result: Record<string, unknown> = {};

  for (const [key, value] of entries) {
    const isEncrypted = typeof value === 'string' && value.startsWith('enc:');
    const isSensitive = isEncrypted || isPrivateTopupField(key, templateFields);

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

export function maskCachedTopupInfo(topupInfo: unknown, fields?: unknown): unknown {
  return maskTopupInfo(topupInfo, false, fields);
}
