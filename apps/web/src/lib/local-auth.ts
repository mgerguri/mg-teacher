import { localDb, LocalTeacher } from './local-db'
import { hashPassword, verifyPassword } from './password-hash'

// All auth lives on-device: passwords are hashed with PBKDF2 (Web Crypto,
// available in both browsers and the Tauri webview) and checked against
// the local `teachers` table. Nothing here ever touches the network.

export { hashPassword, verifyPassword }

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
    role: input.role ?? 'teacher',
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
