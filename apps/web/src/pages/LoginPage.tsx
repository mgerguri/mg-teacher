import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

// Seeded into an empty database by apps/api/src/ensure-default-admin.ts, so
// there's always a working login on a fresh dev setup. Keep in sync with that
// file if these ever change.
//
// Only rendered in development builds. Printing working admin credentials on
// the sign-in page of a deployed instance hands an admin session to anyone
// who loads it — and the server no longer seeds this account in production
// unless explicitly asked to, so the shortcut would not work there anyway.
const DEFAULT_ADMIN_EMAIL = 'teacher@school.com'
const DEFAULT_ADMIN_PASSWORD = 'password123'
const SHOW_DEV_ADMIN_SHORTCUT = import.meta.env.DEV

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminLogin() {
    setError(null)
    setLoading(true)
    try {
      await login(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">{t('auth.signIn')}</h1>
        <p className="text-sm text-gray-500 mb-6">MG Teacher</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        {SHOW_DEV_ADMIN_SHORTCUT && (
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={handleAdminLogin}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
            >
              {t('auth.loginAsAdmin')}
            </button>
            <p className="text-[11px] text-gray-300 mt-1">
              {DEFAULT_ADMIN_EMAIL} / {DEFAULT_ADMIN_PASSWORD}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
