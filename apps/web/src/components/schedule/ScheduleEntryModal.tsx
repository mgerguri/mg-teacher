import { useState, useEffect, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalSchedule, LocalSubject, LocalClass, LocalTeacher } from '../../lib/local-db'

// 30-min slots from 07:00 to 20:30
const TIME_OPTIONS: string[] = []
for (let h = 7; h <= 20; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 20) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}
TIME_OPTIONS.push('20:30')

interface FormState {
  dayOfWeek: number
  startTime: string
  endTime:   string
  subjectId: string
  classId:   string
  teacherId: string
}

interface Props {
  entry?:     LocalSchedule | null
  subjects:   LocalSubject[]
  classes:    LocalClass[]
  teachers:   LocalTeacher[]
  defaults?:  { dayOfWeek?: number; startTime?: string }
  onSave:     (data: FormState) => void
  onDelete?:  () => void
  onClose:    () => void
}

export default function ScheduleEntryModal({
  entry, subjects, classes, teachers, defaults, onSave, onDelete, onClose,
}: Props) {
  const isEdit = !!entry
  const { t }  = useTranslation()

  // Day options built from translation keys
  const DAY_OPTIONS = [
    { label: t('scheduleModal.monday'),    value: 1 },
    { label: t('scheduleModal.tuesday'),   value: 2 },
    { label: t('scheduleModal.wednesday'), value: 3 },
    { label: t('scheduleModal.thursday'),  value: 4 },
    { label: t('scheduleModal.friday'),    value: 5 },
    { label: t('scheduleModal.saturday'),  value: 6 },
  ]

  const [form, setForm] = useState<FormState>({
    dayOfWeek: entry?.dayOfWeek ?? defaults?.dayOfWeek ?? 1,
    startTime: entry?.startTime ?? defaults?.startTime ?? '08:00',
    endTime:   entry?.endTime   ?? '09:00',
    subjectId: entry?.subjectId ?? '',
    classId:   entry?.classId   ?? '',
    teacherId: entry?.teacherId ?? '',
  })

  useEffect(() => {
    const idx = TIME_OPTIONS.indexOf(form.startTime)
    const endIdx = idx + 2
    if (idx >= 0 && endIdx < TIME_OPTIONS.length) {
      setForm(f => ({ ...f, endTime: TIME_OPTIONS[endIdx] }))
    }
  }, [form.startTime])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.subjectId || !form.classId || !form.teacherId) return
    onSave(form)
  }

  const endOptions = TIME_OPTIONS.filter(t => t > form.startTime)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? t('scheduleModal.editEntry') : t('scheduleModal.newEntry')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.day')}</label>
            <select
              value={form.dayOfWeek}
              onChange={e => set('dayOfWeek', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.start')}</label>
              <select
                value={form.startTime}
                onChange={e => set('startTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIME_OPTIONS.slice(0, -1).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.end')}</label>
              <select
                value={form.endTime}
                onChange={e => set('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {endOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.subject')}</label>
            <select
              required
              value={form.subjectId}
              onChange={e => set('subjectId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('scheduleModal.selectSubject')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.class')}</label>
            <select
              required
              value={form.classId}
              onChange={e => set('classId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('scheduleModal.selectClass')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.teacher')}</label>
            <select
              required
              value={form.teacherId}
              onChange={e => set('teacherId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('scheduleModal.selectTeacher')}</option>
              {teachers.map(te => (
                <option key={te.id} value={te.id}>
                  {te.firstName} {te.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            {isEdit && onDelete && (
              <button type="button" onClick={onDelete}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                {t('scheduleModal.delete')}
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              {t('scheduleModal.cancel')}
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              {isEdit ? t('scheduleModal.saveChanges') : t('scheduleModal.addEntry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
