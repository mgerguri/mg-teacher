import { useState, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalStudent, LocalClass } from '../../lib/local-db'

export interface StudentFormState {
  firstName: string
  lastName: string
  email: string
  dateOfBirth: string
  phone: string
  parentName: string
  parentPhone: string
  parentEmail: string
  address: string
  notes: string
  classId: string
}

interface Props {
  student?:  LocalStudent | null
  classes:   LocalClass[]
  defaultClassId?: string
  onSave:    (data: StudentFormState) => void
  onDelete?: () => void
  onClose:   () => void
}

export default function StudentModal({ student, classes, defaultClassId, onSave, onDelete, onClose }: Props) {
  const isEdit = !!student
  const { t }  = useTranslation()
  const [form, setForm] = useState<StudentFormState>({
    firstName:   student?.firstName   ?? '',
    lastName:    student?.lastName    ?? '',
    email:       student?.email       ?? '',
    dateOfBirth: student?.dateOfBirth ?? '',
    phone:       student?.phone       ?? '',
    parentName:  student?.parentName  ?? '',
    parentPhone: student?.parentPhone ?? '',
    parentEmail: student?.parentEmail ?? '',
    address:     student?.address     ?? '',
    notes:       student?.notes       ?? '',
    classId:     student?.classId     ?? defaultClassId ?? '',
  })

  function set<K extends keyof StudentFormState>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const field = (label: string, key: keyof StudentFormState, opts?: {
    type?: string; required?: boolean; placeholder?: string
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        required={opts?.required}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? t('studentModal.editStudent') : t('studentModal.newStudent')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <form
          id="student-form"
          onSubmit={e => { e.preventDefault(); onSave(form) }}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
        >
          {/* Basic info */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('studentModal.basicInfo')}</p>
            <div className="grid grid-cols-2 gap-3">
              {field(t('studentModal.firstName'), 'firstName', { required: true })}
              {field(t('studentModal.lastName'),  'lastName',  { required: true })}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {field(t('studentModal.dateOfBirth'), 'dateOfBirth', { type: 'date' })}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('studentModal.class')}</label>
                <select
                  value={form.classId}
                  onChange={e => set('classId', e.target.value)}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('studentModal.noClass')}</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('studentModal.contact')}</p>
            <div className="grid grid-cols-2 gap-3">
              {field(t('studentModal.email'), 'email', { type: 'email', placeholder: t('studentModal.emailPlaceholder') })}
              {field(t('studentModal.phone'), 'phone', { placeholder: t('studentModal.phonePlaceholder') })}
            </div>
          </section>

          {/* Parent / Guardian */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('studentModal.parentGuardian')}</p>
            <div className="space-y-3">
              {field(t('studentModal.name'), 'parentName')}
              <div className="grid grid-cols-2 gap-3">
                {field(t('studentModal.phone'), 'parentPhone')}
                {field(t('studentModal.email'), 'parentEmail', { type: 'email' })}
              </div>
            </div>
          </section>

          {/* Other */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('studentModal.other')}</p>
            {field(t('studentModal.address'), 'address')}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('studentModal.notes')}</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          {isEdit && onDelete && (
            <button type="button" onClick={onDelete}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              {t('studentModal.delete')}
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            {t('studentModal.cancel')}
          </button>
          <button type="submit" form="student-form"
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            {isEdit ? t('studentModal.save') : t('studentModal.addStudent')}
          </button>
        </div>
      </div>
    </div>
  )
}
