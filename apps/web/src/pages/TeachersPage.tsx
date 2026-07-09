import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { localDb, LocalTeacher } from '../lib/local-db'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'

type Role = 'admin' | 'teacher'

interface TeacherForm {
  firstName: string
  lastName:  string
  email:     string
  password:  string
  role:      Role
}

const EMPTY_FORM: TeacherForm = { firstName: '', lastName: '', email: '', password: '', role: 'teacher' }

// ── Modal ──────────────────────────────────────────────────────────────────────

function TeacherModal({
  teacher, token, onClose, onDone,
}: {
  teacher:   LocalTeacher | null
  token:     string
  onClose:   () => void
  onDone:    () => void
}) {
  const { t }    = useTranslation()
  const isEdit   = !!teacher
  const [form, setForm]   = useState<TeacherForm>(() => teacher
    ? { firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, password: '', role: teacher.role }
    : EMPTY_FORM
  )
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [confirming, setConfirming] = useState(false)

  function set<K extends keyof TeacherForm>(key: K, value: TeacherForm[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        const body: Record<string, string> = {
          firstName: form.firstName,
          lastName:  form.lastName,
          role:      form.role,
        }
        if (form.password) body.password = form.password
        const res = await fetch(`/api/admin/teachers/${teacher!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      } else {
        const res = await fetch('/api/admin/teachers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      }
      onDone()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/teachers/${teacher!.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      onDone()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? t('teacherModal.editTeacher') : t('teacherModal.newTeacher')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('teacherModal.firstName')} *</label>
              <input
                required value={form.firstName} onChange={e => set('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('teacherModal.lastName')} *</label>
              <input
                required value={form.lastName} onChange={e => set('lastName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('teacherModal.email')} *</label>
            <input
              required type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? t('teacherModal.newPassword') : t('teacherModal.password')} {!isEdit && '*'}
            </label>
            <input
              type="password"
              required={!isEdit}
              minLength={6}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={isEdit ? t('teacherModal.leaveBlank') : ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('teacherModal.role')}</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value as Role)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="teacher">{t('teacherModal.roleTeacher')}</option>
              <option value="admin">{t('teacherModal.roleAdmin')}</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            {isEdit && !confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                {t('teacherModal.deactivate')}
              </button>
            )}
            {confirming && (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-red-600">{t('teacherModal.deactivateConfirm')}</span>
                <button type="button" onClick={handleDeactivate} disabled={saving}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                  {t('teacherModal.confirmYes')}
                </button>
                <button type="button" onClick={() => setConfirming(false)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  {t('teacherModal.confirmNo')}
                </button>
              </div>
            )}
            {!confirming && (
              <>
                <div className="flex-1" />
                <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  {t('teacherModal.cancel')}
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                  {saving ? '…' : (isEdit ? t('teacherModal.save') : t('teacherModal.create'))}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TeachersPage() {
  const { t }             = useTranslation()
  const { user, token }   = useAuth()
  const { sync }          = useSync()
  const [teachers, setTeachers] = useState<LocalTeacher[]>([])
  const [modal, setModal]       = useState<{ open: boolean; teacher: LocalTeacher | null }>({ open: false, teacher: null })

  // Admin guard
  if (user?.role !== 'admin') {
    return <div className="p-6 text-sm text-gray-400">{t('teachers.adminOnly')}</div>
  }

  const reload = useCallback(async () => {
    const all = await localDb.teachers.toArray()
    setTeachers(all.sort((a, b) => a.lastName.localeCompare(b.lastName)))
  }, [])

  useEffect(() => { reload() }, [reload])

  function handleDone() {
    setModal({ open: false, teacher: null })
    // Trigger a sync pull to refresh teacher list from server
    sync()
    setTimeout(reload, 800)   // reload after pull settles
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex-1">{t('teachers.title')}</h1>
        <button
          onClick={() => setModal({ open: true, teacher: null })}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {t('teachers.newTeacher')}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-gray-500">{t('teachers.colName')}</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">{t('teachers.colEmail')}</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">{t('teachers.colRole')}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {teachers.map((te, i) => (
              <tr key={te.id} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                <td className="px-5 py-3 font-medium text-gray-900">{te.firstName} {te.lastName}</td>
                <td className="px-5 py-3 text-gray-500">{te.email}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    te.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {te.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setModal({ open: true, teacher: te })}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {t('teachers.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {teachers.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">{t('teachers.noTeachers')}</p>
        )}
      </div>

      {modal.open && token && (
        <TeacherModal
          teacher={modal.teacher}
          token={token}
          onClose={() => setModal({ open: false, teacher: null })}
          onDone={handleDone}
        />
      )}
    </div>
  )
}
