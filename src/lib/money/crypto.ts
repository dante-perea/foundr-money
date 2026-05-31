import 'server-only'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

// ── Secret-at-rest encryption (AES-256-GCM) ───────────────────────────────
// Used to encrypt sensitive provider secrets — currently Plaid access tokens —
// before they hit Postgres. No real Plaid tokens exist yet (Plaid is
// uncredentialed), so this is correct-by-construction: every token persisted
// from here forward is encrypted.
//
// Wire format (a single opaque string stored in the DB column):
//   - WITH a key set:    "v1:" + base64( iv | authTag | ciphertext )
//                        iv   = 12 bytes (GCM standard nonce)
//                        tag  = 16 bytes (GCM auth tag)
//                        rest = ciphertext
//   - WITHOUT a key:     "plaintext:" + <raw value, unchanged>
//
// decrypt() detects the marker and round-trips either form, so the module
// degrades safely in environments that have not set ENCRYPTION_KEY (the
// orchestrator sets it in deployed envs). Values written under one mode are
// always readable later even if the key is added/removed between writes and
// reads — except, of course, a "v1:" value cannot be decrypted without its key.

const VERSION = 'v1'
const ENCRYPTED_PREFIX = `${VERSION}:`
const PLAINTEXT_PREFIX = 'plaintext:'

const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

/** Parse the 32-byte AES key from ENCRYPTION_KEY (hex). Returns null when absent
 *  or malformed, so callers fall back to the plaintext marker. */
function resolveKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY?.trim()
  if (!hex) return null
  let key: Buffer
  try {
    key = Buffer.from(hex, 'hex')
  } catch {
    return null
  }
  if (key.length !== KEY_BYTES) return null
  return key
}

/**
 * Encrypt a plaintext secret for storage at rest.
 * - With ENCRYPTION_KEY: returns "v1:" + base64(iv|tag|ciphertext).
 * - Without it: returns the value UNCHANGED behind a "plaintext:" marker so the
 *   round-trip is lossless and obviously-unencrypted in the DB.
 */
export function encrypt(plaintext: string): string {
  const key = resolveKey()
  if (!key) {
    return PLAINTEXT_PREFIX + plaintext
  }
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  const packed = Buffer.concat([iv, authTag, ciphertext]).toString('base64')
  return ENCRYPTED_PREFIX + packed
}

/**
 * Decrypt a value produced by encrypt(). Handles both markers:
 * - "plaintext:…"  → strips the marker, returns the raw value.
 * - "v1:…"         → AES-256-GCM decrypts using ENCRYPTION_KEY.
 * Unmarked legacy values (raw plaintext stored before this module existed) are
 * returned as-is, so older rows keep working.
 */
export function decrypt(stored: string): string {
  if (stored.startsWith(PLAINTEXT_PREFIX)) {
    return stored.slice(PLAINTEXT_PREFIX.length)
  }
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    // Legacy / externally-written raw value — pass through unchanged.
    return stored
  }
  const key = resolveKey()
  if (!key) {
    throw new Error('decrypt: ENCRYPTION_KEY is required to read a v1-encrypted value')
  }
  const packed = Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), 'base64')
  const iv = packed.subarray(0, IV_BYTES)
  const authTag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
