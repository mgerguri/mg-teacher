import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } from '../lib/local-db'

type Mode = 'signin' | 'register'

export default function LoginPage() {
  const { login, createAccount } = useAuth()
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const [mode,      setMode]      = useState<Mode>('signin')
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const isRegister = mode === 'register'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isRegister) {
        await createAccount({ email, password, firstName, lastName })
      } else {
        await login(email, password)
      }
      navigate('/')
    } catch (err: any) {
      setError(err.message ?? t('auth.somethingWentWrong'))
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
    } catch (err: any) {
      setError(err.message ?? t('auth.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setMode(m => m === 'signin' ? 'register' : 'signin')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">
          {isRegister ? t('auth.createAccount') : t('auth.signIn')}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {isRegister ? t('auth.createAccountSubtitle') : 'MG Teacher'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.firstName')}</label>
                <input
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.lastName')}</label>
                <input
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

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
              minLength={isRegister ? 8 : undefined}
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
            {loading
              ? t('auth.signingIn')
              : isRegister ? t('auth.createAccount') : t('auth.signIn')}
          </button>
        </form>

        <button
          type="button"
          onClick={toggleMode}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-700 mt-4 transition-colors"
        >
          {isRegister ? t('auth.haveAccount') : t('auth.needAccount')}
        </button>

        {!isRegister && (
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
