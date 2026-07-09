import { useState, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalClass } from '../../lib/local-db'

interface FormState {
  name: string
  gradeLevel: string
  academicYear: string
}

interface Props {
  cls?: LocalClass | null
  onSave:   (data: FormState) => void
  onDelete?: () => void
  onClose:  () => void
}

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - 1 + i
  return `${y}/${y + 1}`
})

export default function ClassModal({ cls, onSave, onDelete, onClose }: Props) {
  const isEdit = !!cls
  const { t }  = useTranslation()
  const [form, setForm] = useState<FormState>({
    name:         cls?.name         ?? '',
    gradeLevel:   cls?.gradeLevel   ?? '',
    academicYear: cls?.academicYear ?? YEAR_OPTIONS[1],
  })

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? t('classModal.editClass') : t('classModal.newClass')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('classModal.className')}</label>
            <input
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={t('classModal.classNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('classModal.gradeLevel')}</label>
            <input
              required
              value={form.gradeLevel}
              onChange={e => set('gradeLevel', e.target.value)}
              placeholder={t('classModal.gradeLevelPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('classModal.academicYear')}</label>
            <select
              value={form.academicYear}
              onChange={e => set('academicYear', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            {isEdit && onDelete && (
              <button type="button" onClick={onDelete}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                {t('classModal.delete')}
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              {t('classModal.cancel')}
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              {isEdit ? t('classModal.save') : t('classModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
