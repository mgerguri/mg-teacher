import { useState, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalSchedule, LocalSubject, LocalClass, LocalTeacher } from '../../lib/local-db'

const DEFAULT_DURATION_MIN = 30

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60)
  const hh = Math.floor(total / 60).toString().padStart(2, '0')
  const mm = (total % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

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
  schedules:  LocalSchedule[]
  defaults?:  { dayOfWeek?: number; startTime?: string }
  onSave:     (data: FormState) => void
  onDelete?:  () => void
  onClose:    () => void
}

// Two ranges [aStart,aEnd) and [bStart,bEnd) overlap iff each starts before
// the other ends — comparing "HH:MM" strings lexically works the same as
// comparing minutes since both are zero-padded and same-length.
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd
}

export default function ScheduleEntryModal({
  entry, subjects, classes, teachers, schedules, defaults, onSave, onDelete, onClose,
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
    endTime:   entry?.endTime   ?? addMinutes(entry?.startTime ?? defaults?.startTime ?? '08:00', DEFAULT_DURATION_MIN),
    subjectId: entry?.subjectId ?? '',
    classId:   entry?.classId   ?? '',
    teacherId: entry?.teacherId ?? '',
  })
  const [error, setError] = useState('')

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // Changing the start time shifts the end time by the same amount, so the
  // duration the user already picked (5 min, 40 min, whatever) is kept —
  // it only resets to the default duration if end wasn't after start yet.
  function handleStartChange(newStart: string) {
    setForm(f => {
      const duration = minutesBetween(f.startTime, f.endTime)
      const keptDuration = duration > 0 ? duration : DEFAULT_DURATION_MIN
      return { ...f, startTime: newStart, endTime: addMinutes(newStart, keptDuration) }
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.subjectId || !form.classId || !form.teacherId) return
    if (minutesBetween(form.startTime, form.endTime) <= 0) {
      setError(t('scheduleModal.endAfterStart'))
      return
    }

    const others = schedules.filter(s =>
      s.id !== entry?.id &&
      s.dayOfWeek === form.dayOfWeek &&
      timesOverlap(form.startTime, form.endTime, s.startTime, s.endTime)
    )
    const classConflict   = others.find(s => s.classId === form.classId)
    const teacherConflict = others.find(s => s.teacherId === form.teacherId)
    if (classConflict) {
      setError(t('scheduleModal.classConflict'))
      return
    }
    if (teacherConflict) {
      setError(t('scheduleModal.teacherConflict'))
      return
    }

    setError('')
    onSave(form)
  }

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
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.start')}</label>
              <input
                type="time"
                step={60}
                value={form.startTime}
                onChange={e => handleStartChange(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.end')}</label>
              <input
                type="time"
                step={60}
                value={form.endTime}
                onChange={e => set('endTime', e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('scheduleModal.subject')}</label>
            <select
              required
              value={form.subjectId}
              onChange={e => set('subjectId', e.target.value)}
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('scheduleModal.selectTeacher')}</option>
              {teachers.map(te => (
                <option key={te.id} value={te.id}>
                  {te.firstName} {te.lastName}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

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
