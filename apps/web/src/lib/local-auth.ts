import { localDb, LocalTeacher } from './local-db'

// All auth lives on-device: passwords are hashed with PBKDF2 (Web Crypto,
// available in both browsers and the Tauri webview) and checked against
// the local `teachers` table. Nothing here ever touches the network.

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

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const hash = await derive(password, fromHex(saltHex))
  return hash === hashHex
}

export async function hasAnyAccount(): Promise<boolean> {
  return (await localDb.teachers.count()) > 0
}

export interface CreateAccountInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: 'admin' | 'teacher'
}

export async function createLocalAccount(input: CreateAccountInput): Promise<LocalTeacher> {
  const existing = await localDb.teachers.where('email').equals(input.email).first()
  if (existing) throw new Error('Email already in use')

  const teacher: LocalTeacher = {
    id: crypto.randomUUID(),
    email: input.email,
    role: input.role ?? 'admin',
    firstName: input.firstName,
    lastName: input.lastName,
    updatedAt: new Date().toISOString(),
    passwordHash: await hashPassword(input.password),
  }
  await localDb.teachers.add(teacher)
  return teacher
}

export async function verifyLocalLogin(email: string, password: string): Promise<LocalTeacher> {
  const teacher = await localDb.teachers.where('email').equals(email).first()
  if (!teacher?.passwordHash || !(await verifyPassword(password, teacher.passwordHash))) {
    throw new Error('Invalid credentials')
  }
  return teacher
}
