import { localDb, LocalTeacher } from './local-db'
import { hashPassword, verifyPassword } from './password-hash'

// All auth lives on-device: passwords are hashed with PBKDF2 (Web Crypto,
// available in both browsers and the Tauri webview) and checked against
// the local `teachers` table. Nothing here ever touches the network.

export { hashPassword, verifyPassword }

// Email is the sign-in identifier, so it has to be compared the same way on
// the way in and the way out. Without this, an account registered as
// "Teacher@School.com" cannot be signed into as "teacher@school.com", and the
// duplicate check below happily creates a second account for the same person.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export interface CreateAccountInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: 'admin' | 'teacher'
}

export async function createLocalAccount(input: CreateAccountInput): Promise<LocalTeacher> {
  const email = normalizeEmail(input.email)
  const existing = await localDb.teachers.where('email').equals(email).first()
  if (existing) throw new Error('Email already in use')

  const teacher: LocalTeacher = {
    id: crypto.randomUUID(),
    email,
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
  const teacher = await localDb.teachers.where('email').equals(normalizeEmail(email)).first()
  if (!teacher?.passwordHash || !(await verifyPassword(password, teacher.passwordHash))) {
    throw new Error('Invalid credentials')
  }
  return teacher
}
