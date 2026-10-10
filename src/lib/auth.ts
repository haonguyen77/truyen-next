/**
 * Auth utilities — Web Crypto API (no external libraries needed)
 * - Password: PBKDF2 hash (SHA-256, 100k iterations)
 * - Session: signed JWT-like token via HMAC-SHA256 stored in HttpOnly cookie
 */

const SECRET = process.env.AUTH_SECRET ?? 'truyen-secret-change-me-in-production'
const COOKIE_NAME = 'truyen_session'
const SESSION_DAYS = 30

// ── Crypto helpers ─────────────────────────────────────────────

async function getKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage
  )
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

// ── Password hashing (PBKDF2) ──────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    keyMaterial, 256
  ) as ArrayBuffer
  return toHex(salt) + ':' + toHex(bits)
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const enc = new TextEncoder()
  const salt = fromHex(saltHex)
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    keyMaterial, 256
  ) as ArrayBuffer
  return toHex(bits) === hashHex
}

// ── Session token (HMAC-SHA256 signed) ────────────────────────

export interface SessionPayload {
  userId: string
  username: string
  exp: number // Unix timestamp (seconds)
}

export async function createSessionToken(payload: Omit<SessionPayload, 'exp'>): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  const data = JSON.stringify({ ...payload, exp })
  const enc = new TextEncoder()
  const key = await getKey(SECRET, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const b64data = btoa(unescape(encodeURIComponent(data)))
  const b64sig = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return b64data + '.' + b64sig
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return null
    const b64data = token.slice(0, dotIdx)
    const b64sig = token.slice(dotIdx + 1)
    const dataStr = decodeURIComponent(escape(atob(b64data)))
    const sigBytes = Uint8Array.from(atob(b64sig), c => c.charCodeAt(0))
    const enc = new TextEncoder()
    const key = await getKey(SECRET, ['verify'])
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(dataStr))
    if (!valid) return null
    const payload = JSON.parse(dataStr) as SessionPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function cookieName() { return COOKIE_NAME }

export function makeSessionCookie(token: string): string {
  const maxAge = SESSION_DAYS * 86400
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

// ── Get session from server-side request ──────────────────────
// NOTE: Moved to src/lib/session.ts to avoid importing next/headers in client contexts
