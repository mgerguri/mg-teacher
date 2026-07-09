import { useState, useEffect, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalSubject, LocalTeacher } from '../../lib/local-db'

export interface SubjectFormState {
  name:        string
  code:        string
  description: string
  teacherId:   string
}

interface Props {
  subject?:  LocalSubject | null
  teachers:  LocalTeacher[]
  onSave:    (data: SubjectFormState) => void
  onDelete?: () => void
  onClose:   () => void
}

export default function SubjectModal({ subject, teachers, onSave, onDelete, onClose }: Props) {
  const { t }    = useTranslation()
  const isEdit   = !!subject

  const [form, setForm] = useState<SubjectFormState>({
    name:        subject?.name        ?? '',
    code:        subject?.code        ?? '',
    description: subject?.description ?? '',
    teacherId:   subject?.teacherId   ?? '',
  })

  useEffect(() => {
    setForm({
      name:        subject?.name        ?? '',
      code:        subject?.code        ?? '',
      description: subject?.description ?? '',
      teacherId:   subject?.teacherId   ?? '',
    })
  }, [subject?.id])

  function set<K extends keyof SubjectFormState>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? t('subjectModal.editSubject') : t('subjectModal.newSubject')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('subjectModal.name')} *</label>
              <input
                required
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder={t('subjectModal.namePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('subjectModal.code')}</label>
              <input
                value={form.code}
                onChange={e => set('code', e.target.value)}
                placeholder={t('subjectModal.codePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('subjectModal.teacher')}</label>
              <select
                value={form.teacherId}
                onChange={e => set('teacherId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('subjectModal.noTeacher')}</option>
                {teachers.map(te => (
                  <option key={te.id} value={te.id}>
                    {te.firstName} {te.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('subjectModal.description')}</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={t('subjectModal.descriptionPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {isEdit && onDelete && (
              <button
                type="button" onClick={onDelete}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                {t('subjectModal.delete')}
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              {t('subjectModal.cancel')}
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              {isEdit ? t('subjectModal.save') : t('subjectModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
