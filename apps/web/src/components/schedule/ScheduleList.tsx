import { useTranslation } from 'react-i18next'
import { LocalSchedule, LocalSubject, LocalClass, LocalTeacher } from '../../lib/local-db'
import { Perspective } from './WeeklyGrid'

interface Props {
  schedules:   LocalSchedule[]
  subjects:    Map<string, LocalSubject>
  classes:     Map<string, LocalClass>
  teachers:    Map<string, LocalTeacher>
  perspective: Perspective
  onEntryClick: (entry: LocalSchedule) => void
}

export default function ScheduleList({ schedules, subjects, classes, teachers, perspective, onEntryClick }: Props) {
  const { t } = useTranslation()
  const active = schedules.filter(s => !s.deletedAt)

  // Group by day, sorted Mon → Sat
  const byDay = [1, 2, 3, 4, 5, 6].reduce<Record<number, LocalSchedule[]>>((acc, day) => {
    const entries = active
      .filter(s => s.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    if (entries.length) acc[day] = entries
    return acc
  }, {})

  if (Object.keys(byDay).length === 0) {
    return <p className="text-gray-400 text-sm text-center py-12">{t('schedule.noEntries')}</p>
  }

  return (
    <div className="space-y-6">
      {Object.entries(byDay).map(([day, entries]) => (
        <div key={day}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t(`days.${day}`)}
          </h3>
          <div className="space-y-1">
            {entries.map(entry => {
              const subject = subjects.get(entry.subjectId)
              const cls     = classes.get(entry.classId)
              const teacher = teachers.get(entry.teacherId)

              return (
                <button
                  key={entry.id}
                  onClick={() => onEntryClick(entry)}
                  className="w-full text-left flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-100 bg-white hover:border-gray-300 transition-colors"
                >
                  <span className="text-xs text-gray-400 w-24 flex-shrink-0">
                    {entry.startTime} – {entry.endTime}
                  </span>
                  <span className="font-medium text-sm text-gray-900 flex-1 truncate">
                    {subject?.name ?? '—'}
                  </span>
                  <span className="text-sm text-gray-500 truncate">
                    {perspective === 'class'
                      ? `${teacher?.firstName ?? ''} ${teacher?.lastName ?? ''}`.trim() || '—'
                      : cls?.name ?? '—'}
                  </span>
                  {entry.syncStatus === 'pending' && (
                    <span className="text-xs text-amber-500 flex-shrink-0">{t('schedule.pendingSync')}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
