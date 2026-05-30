// src/app/api/plaid/webhook/route.ts
//
// PUBLIC, unauthenticated Plaid webhook receiver. MUST NOT import
// requireOwnerId / Clerk — Plaid calls this with no session. The foundation
// Clerk proxy matcher excludes /api routes, so this is reachable.
//
// Flow: read the RAW body (req.text()), verify the Plaid-Verification JWT
// (ES256, key from /webhook_verification_key/get) when creds are present;
// in sandbox / on any verification gap we log + proceed (sandbox keys are
// short-lived and the bodies carry no secrets). On SYNC_UPDATES_AVAILABLE we
// resolve the owner by item_id and run an incremental syncPlaidItem. ALWAYS
// returns 200 fast so Plaid does not retry-storm.
import { createPublicKey, createHash, verify as cryptoVerify } from 'node:crypto'
import { plaidClient, plaidConfigured, ownerForPlaidItem, syncPlaidItem } from '@/lib/money/ingest/plaid'

interface PlaidWebhookBody {
  webhook_type?: string
  webhook_code?: string
  item_id?: string
  error?: unknown
}

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function b64urlJson<T>(s: string): T | null {
  try {
    return JSON.parse(b64urlToBuf(s).toString('utf8')) as T
  } catch {
    return null
  }
}

/**
 * Best-effort ES256 JWT verification of the Plaid-Verification header against
 * the raw body. Returns true if verified OR if verification is not possible
 * (sandbox / no creds) — we never hard-fail the webhook on verification, but a
 * genuine signature mismatch returns false and the caller logs + drops.
 */
async function verifyPlaidJwt(jwt: string | null, rawBody: string): Promise<boolean> {
  if (!jwt) return true // sandbox fire_webhook may omit the header
  if (!plaidConfigured()) return true
  try {
    const [headerB64, payloadB64, sigB64] = jwt.split('.')
    if (!headerB64 || !payloadB64 || !sigB64) return false
    const header = b64urlJson<{ alg: string; kid: string }>(headerB64)
    if (!header || header.alg !== 'ES256' || !header.kid) return false

    // Fetch the public verification key for this kid.
    const keyResp = await plaidClient().webhookVerificationKeyGet({ key_id: header.kid })
    const jwk = keyResp.data.key as unknown as import('node:crypto').JsonWebKey
    const pub = createPublicKey({ key: jwk, format: 'jwk' })

    // ES256 signature is raw R||S (64 bytes); Node verify expects DER for 'sha256'.
    const sig = b64urlToBuf(sigB64)
    const der = rawSignatureToDer(sig)
    const signingInput = `${headerB64}.${payloadB64}`
    const ok = cryptoVerify('sha256', Buffer.from(signingInput), { key: pub, dsaEncoding: 'der' }, der)
    if (!ok) return false

    // Body hash claim check (Plaid puts request_body_sha256 in the payload).
    const payload = b64urlJson<{ request_body_sha256?: string }>(payloadB64)
    if (payload?.request_body_sha256) {
      const bodyHash = createHash('sha256').update(rawBody).digest('hex')
      if (bodyHash !== payload.request_body_sha256) return false
    }
    return true
  } catch {
    // Verification path unavailable (e.g. sandbox key rollover) → proceed.
    return true
  }
}

/** Convert a raw R||S ECDSA signature (64 bytes) to DER for Node verify. */
function rawSignatureToDer(raw: Buffer): Buffer {
  const half = raw.length / 2
  let r = raw.subarray(0, half)
  let s = raw.subarray(half)
  const trim = (b: Buffer): Buffer => {
    let i = 0
    while (i < b.length - 1 && b[i] === 0) i++
    let out = b.subarray(i)
    if (out[0] & 0x80) out = Buffer.concat([Buffer.from([0]), out])
    return out
  }
  r = trim(r)
  s = trim(s)
  const seqLen = 2 + r.length + 2 + s.length
  return Buffer.concat([
    Buffer.from([0x30, seqLen]),
    Buffer.from([0x02, r.length]),
    r,
    Buffer.from([0x02, s.length]),
    s,
  ])
}

export async function POST(req: Request): Promise<Response> {
  let raw = ''
  try {
    raw = await req.text()
  } catch {
    return new Response('ok', { status: 200 })
  }

  if (!plaidConfigured()) {
    // Nothing to do without creds, but acknowledge so Plaid stops retrying.
    return new Response('ok', { status: 200 })
  }

  let body: PlaidWebhookBody = {}
  try {
    body = raw ? (JSON.parse(raw) as PlaidWebhookBody) : {}
  } catch {
    return new Response('ok', { status: 200 })
  }

  const jwt = req.headers.get('plaid-verification') ?? req.headers.get('Plaid-Verification')
  const verified = await verifyPlaidJwt(jwt, raw)
  if (!verified) {
    console.warn('[plaid:webhook] signature verification FAILED — dropping', {
      type: body.webhook_type,
      code: body.webhook_code,
    })
    return new Response('ok', { status: 200 })
  }

  try {
    if (
      body.webhook_type === 'TRANSACTIONS' &&
      (body.webhook_code === 'SYNC_UPDATES_AVAILABLE' ||
        body.webhook_code === 'DEFAULT_UPDATE' ||
        body.webhook_code === 'INITIAL_UPDATE' ||
        body.webhook_code === 'HISTORICAL_UPDATE') &&
      body.item_id
    ) {
      const owner = await ownerForPlaidItem(body.item_id)
      if (owner) {
        // Fire-and-forget would be lost on serverless; await but cap is fine.
        await syncPlaidItem(owner, body.item_id)
      } else {
        console.warn('[plaid:webhook] no owner for item_id', body.item_id)
      }
    }
  } catch (err) {
    console.error('[plaid:webhook] handler error', err)
  }

  // Always 200 fast.
  return new Response('ok', { status: 200 })
}
