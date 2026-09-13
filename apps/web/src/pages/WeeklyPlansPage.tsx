import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  localDb,
  LocalClass, LocalSchedule, LocalSubject,
  LocalWeeklyPlan, LocalWeeklyPlanEntry,
} from '../lib/local-db'
import { useSync } from '../context/SyncContext'
import { useAuth } from '../context/AuthContext'
import { scopeClasses, scopeSubjects } from '../lib/scope'
import { exportPlanToPDF, exportPlanToWord } from '../lib/plan-export'

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns 'YYYY-MM-DD' for the Monday of the week containing `date`. */
function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()                      // 0=Sun, 1=Mon…6=Sat
  const diff = day === 0 ? -6 : 1 - day      // shift to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Offset weekStart by `days` days and return 'YYYY-MM-DD'. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

/** dayOfWeek 1=Mon…6=Sat → date within the week starting at weekStart */
function dateForDow(weekStart: string, dow: number): string {
  return addDays(weekStart, dow - 1)
}

/** Format 'YYYY-MM-DD' to localised short date, e.g. "Mon 23 Jun" */
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

// ── Slot + entry modal ────────────────────────────────────────────────────────

interface SlotEntry {
  schedule: LocalSchedule
  subject:  LocalSubject | undefined
  date:     string
  entry:    LocalWeeklyPlanEntry | undefined
}

function Field({
  label, value, onChange, placeholder, rows,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 resize-none border border-transparent focus:border-blue-300 focus:bg-white focus:outline-none transition-colors placeholder-gray-300"
      />
    </div>
  )
}

function PlanEntryModal({
  slot, onSave, onClose,
}: {
  slot:   SlotEntry
  onSave: (fields: Partial<LocalWeeklyPlanEntry>) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { schedule, subject, date, entry } = slot

  const [topic,      setTopic]      = useState(entry?.topic      ?? '')
  const [objectives, setObjectives] = useState(entry?.objectives ?? '')
  const [activities, setActivities] = useState(entry?.activities ?? '')
  const [homework,   setHomework]   = useState(entry?.homework   ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave({ topic, objectives, activities, homework })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{subject?.name ?? '—'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(date)} · {schedule.startTime}–{schedule.endTime}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form id="plan-entry-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          <Field label={t('plans.topic')}      value={topic}      onChange={setTopic}      placeholder={t('plans.topicPlaceholder')}      rows={2} />
          <Field label={t('plans.objectives')} value={objectives} onChange={setObjectives} placeholder={t('plans.objectivesPlaceholder')} rows={3} />
          <Field label={t('plans.activities')} value={activities} onChange={setActivities} placeholder={t('plans.activitiesPlaceholder')} rows={3} />
          <Field label={t('plans.homework')}   value={homework}   onChange={setHomework}   placeholder={t('plans.homeworkPlaceholder')}   rows={2} />
        </form>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            {t('plans.cancel')}
          </button>
          <button type="submit" form="plan-entry-form" className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            {t('plans.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function WeeklyPlansPage() {
  const { t }    = useTranslation()
  const { sync } = useSync()
  const { user } = useAuth()

  const [classes,    setClasses]    = useState<LocalClass[]>([])
  const [classId,    setClassId]    = useState<string>('')
  const [weekStart,  setWeekStart]  = useState<string>(() => getMondayOf(new Date()))
  const [schedules,  setSchedules]  = useState<LocalSchedule[]>([])
  const [subjects,   setSubjects]   = useState<Map<string, LocalSubject>>(new Map())
  const [plan,       setPlan]       = useState<LocalWeeklyPlan | null>(null)
  const [entries,    setEntries]    = useState<LocalWeeklyPlanEntry[]>([])
  const [exporting,  setExporting]  = useState<'pdf' | 'word' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [editingSlot, setEditingSlot] = useState<SlotEntry | null>(null)

  // Load classes once
  useEffect(() => {
    localDb.classes.filter(c => !c.deletedAt).toArray().then(all => {
      const sorted = scopeClasses(all, user).sort((a, b) => a.name.localeCompare(b.name))
      setClasses(sorted)
      if (sorted.length) setClassId(sorted[0].id)
    })
  }, [user])

  // Load schedule + plan data whenever class or week changes
  const reload = useCallback(async () => {
    if (!classId) return
    const [allSchedules, allSubjects] = await Promise.all([
      localDb.schedules.filter(s => !s.deletedAt && s.classId === classId).toArray(),
      localDb.subjects.filter(s => !s.deletedAt).toArray(),
    ])
    setSchedules(allSchedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)))
    setSubjects(new Map(scopeSubjects(allSubjects, user).map(s => [s.id, s])))

    // Find or leave blank the plan for this class+week
    const existingPlan = await localDb.weeklyPlans
      .filter(p => !p.deletedAt && p.classId === classId && p.weekStart === weekStart)
      .first()
    setPlan(existingPlan ?? null)

    if (existingPlan) {
      const planEntries = await localDb.weeklyPlanEntries
        .filter(e => !e.deletedAt && e.planId === existingPlan.id)
        .toArray()
      setEntries(planEntries)
    } else {
      setEntries([])
    }
  }, [classId, weekStart, user])

  useEffect(() => { reload() }, [reload])

  // ── Ensure plan exists, then upsert an entry ──────────────────────────────

  const savingRef = useRef(false)

  async function handleSave(
    scheduleId: string,
    date: string,
    fields: Partial<LocalWeeklyPlanEntry>
  ) {
    if (!user || !classId || savingRef.current) return

    // Skip if all fields are empty (nothing to save yet)
    const { topic, objectives, activities, homework } = fields
    if (!topic && !objectives && !activities && !homework) return

    savingRef.current = true
    const now = new Date().toISOString()

    try {
      // Ensure plan record exists
      let currentPlan = plan
      if (!currentPlan) {
        const newPlan: LocalWeeklyPlan = {
          id:         globalThis.crypto.randomUUID(),
          classId,
          teacherId:  user.id,
          weekStart,
          updatedAt:  now,
          syncStatus: 'pending',
        }
        await localDb.weeklyPlans.add(newPlan)
        currentPlan = newPlan
        setPlan(newPlan)
      }

      // Upsert the entry for this slot
      const existing = entries.find(e => e.scheduleId === scheduleId && e.date === date)
      if (existing) {
        await localDb.weeklyPlanEntries.update(existing.id, {
          ...fields,
          updatedAt:  now,
          syncStatus: 'pending',
        })
      } else {
        await localDb.weeklyPlanEntries.add({
          id:         globalThis.crypto.randomUUID(),
          planId:     currentPlan.id,
          scheduleId,
          date,
          topic:      fields.topic,
          objectives: fields.objectives,
          activities: fields.activities,
          homework:   fields.homework,
          updatedAt:  now,
          syncStatus: 'pending',
        })
      }

      await reload()
      sync()
    } finally {
      savingRef.current = false
    }
  }

  // ── Group schedule slots by day of week ───────────────────────────────────

  const days = [1, 2, 3, 4, 5, 6] as const

  const slotsByDay = days.reduce<Record<number, SlotEntry[]>>((acc, dow) => {
    const date       = dateForDow(weekStart, dow)
    const daySlots   = schedules
      .filter(s => s.dayOfWeek === dow)
      .map(s => ({
        schedule: s,
        subject:  subjects.get(s.subjectId),
        date,
        entry:    entries.find(e => e.scheduleId === s.id && e.date === date),
      }))
    if (daySlots.length) acc[dow] = daySlots
    return acc
  }, {})

  const hasSlots = Object.keys(slotsByDay).length > 0

  // ── Export ────────────────────────────────────────────────────────────────

  function buildExportData() {
    const cls = classes.find(c => c.id === classId)
    return {
      className: cls ? `${cls.name} · ${cls.gradeLevel}` : '',
      weekStart,
      weekLabel: `${fmtDate(weekStart)} – ${fmtDate(addDays(weekStart, 5))}`,
      days: days
        .filter(dow => slotsByDay[dow]?.length)
        .map(dow => ({
          date:  fmtDate(dateForDow(weekStart, dow)),
          slots: (slotsByDay[dow] ?? []).map(s => ({
            time:       `${s.schedule.startTime}–${s.schedule.endTime}`,
            subject:    s.subject?.name ?? '—',
            topic:      s.entry?.topic      ?? '',
            objectives: s.entry?.objectives ?? '',
            activities: s.entry?.activities ?? '',
            homework:   s.entry?.homework   ?? '',
          })),
        })),
    }
  }

  async function handleExportPDF() {
    setExporting('pdf')
    setExportError(null)
    try { await exportPlanToPDF(buildExportData()) }
    catch { setExportError(t('plans.exportError')) }
    finally { setExporting(null) }
  }

  async function handleExportWord() {
    setExporting('word')
    setExportError(null)
    try { await exportPlanToWord(buildExportData()) }
    catch { setExportError(t('plans.exportError')) }
    finally { setExporting(null) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const weekEnd = addDays(weekStart, 5)        // Saturday

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{t('plans.title')}</h1>

        {hasSlots && (
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {exporting === 'pdf' ? '…' : '⬇'} {t('plans.exportPdf')}
            </button>
            <button
              onClick={handleExportWord}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {exporting === 'word' ? '…' : '⬇'} {t('plans.exportWord')}
            </button>
          </div>
        )}
      </div>

      {exportError && <p className="text-sm text-red-600 -mt-4 mb-6">{exportError}</p>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-4 mb-8">
        {/* Class */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('plans.class')}</label>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} · {c.gradeLevel}</option>
            ))}
          </select>
        </div>

        {/* Week navigation */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('plans.week')}</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              className="px-2 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors text-sm"
            >←</button>
            <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
              {fmtDate(weekStart)} – {fmtDate(weekEnd)}
            </span>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="px-2 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors text-sm"
            >→</button>
            <button
              onClick={() => setWeekStart(getMondayOf(new Date()))}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {t('plans.thisWeek')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!hasSlots ? (
        <div className="text-center py-20 text-sm text-gray-400">
          <p>{t('plans.noSchedule')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {days.filter(dow => slotsByDay[dow]?.length).map(dow => (
            <div key={dow}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <span className="text-sm font-semibold text-gray-800">{t(`days.${dow}`)}</span>
                  <span className="ml-2 text-xs text-gray-400">{fmtDate(dateForDow(weekStart, dow))}</span>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Slot table */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500 w-28">{t('plans.time')}</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500 w-40">{t('plans.subject')}</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">{t('plans.topic')}</th>
                      <th className="px-4 py-2 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {slotsByDay[dow].map((slot, i) => {
                      const isPending = slot.entry?.syncStatus === 'pending'
                      return (
                        <tr
                          key={`${slot.schedule.id}:${slot.date}`}
                          onClick={() => setEditingSlot(slot)}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}
                        >
                          <td className="px-4 py-2.5 text-gray-500 tabular-nums">
                            {slot.schedule.startTime}–{slot.schedule.endTime}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            {slot.subject?.name ?? '—'}
                            {isPending && <span className="ml-2 text-xs text-amber-400">●</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">
                            {slot.entry?.topic || <span className="text-gray-300">{t('plans.noTopic')}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={e => { e.stopPropagation(); setEditingSlot(slot) }}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              {t('plans.edit')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingSlot && (
        <PlanEntryModal
          slot={editingSlot}
          onSave={fields => handleSave(editingSlot.schedule.id, editingSlot.date, fields)}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  )
}
