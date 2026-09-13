// PBKDF2 password hashing (Web Crypto, available in both browsers and the
// Tauri webview). Split out from local-auth.ts so local-db.ts can hash the
// seeded default admin's password without a circular import (local-auth.ts
// imports `localDb` from local-db.ts).

const PBKDF2_ITERATIONS = 100_000

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return toHex(new Uint8Array(bits))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt)
  return `${toHex(salt)}:${hash}`
}

// Compared without an early exit so the time taken doesn't depend on how many
// leading characters matched. `===` on strings short-circuits at the first
// difference, which leaks that prefix length to anything able to time it.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const hash = await derive(password, fromHex(saltHex))
  return timingSafeEqual(hash, hashHex)
}
