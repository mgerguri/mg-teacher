import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { localDb, LocalSchedule, LocalClass, LocalSubject, LocalTeacher } from '../lib/local-db'
import { useSync } from '../context/SyncContext'
import { useAuth } from '../context/AuthContext'
import WeeklyGrid, { Perspective } from '../components/schedule/WeeklyGrid'
import ScheduleList from '../components/schedule/ScheduleList'
import ScheduleEntryModal from '../components/schedule/ScheduleEntryModal'

type ViewMode = 'grid' | 'list'

interface ModalState {
  open: boolean
  entry: LocalSchedule | null
  defaults?: { dayOfWeek?: number; startTime?: string }
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useLocalData() {
  const [schedules, setSchedules] = useState<LocalSchedule[]>([])
  const [classes,   setClasses]   = useState<LocalClass[]>([])
  const [subjects,  setSubjects]  = useState<LocalSubject[]>([])
  const [teachers,  setTeachers]  = useState<LocalTeacher[]>([])

  const reload = useCallback(async () => {
    const [sc, cl, su, te] = await Promise.all([
      localDb.schedules.filter(s => !s.deletedAt).toArray(),
      localDb.classes.filter(c => !c.deletedAt).toArray(),
      localDb.subjects.filter(s => !s.deletedAt).toArray(),
      localDb.teachers.toArray(),
    ])
    setSchedules(sc)
    setClasses(cl)
    setSubjects(su)
    setTeachers(te)
  }, [])

  useEffect(() => { reload() }, [reload])

  return { schedules, classes, subjects, teachers, reload }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user } = useAuth()
  const { sync, state: syncState } = useSync()
  const { t }    = useTranslation()
  const { schedules, classes, subjects, teachers, reload } = useLocalData()

  const [view,        setView]        = useState<ViewMode>('grid')
  const [perspective, setPerspective] = useState<Perspective>('class')
  const [selectedId,  setSelectedId]  = useState<string>('')
  const [modal,       setModal]       = useState<ModalState>({ open: false, entry: null })

  // Default selector to first option when data loads
  useEffect(() => {
    if (!selectedId) {
      if (perspective === 'class' && classes.length)   setSelectedId(classes[0].id)
      if (perspective === 'teacher' && teachers.length) setSelectedId(teachers[0].id)
    }
  }, [perspective, classes, teachers, selectedId])

  // Reset selection when perspective changes
  function switchPerspective(p: Perspective) {
    setPerspective(p)
    setSelectedId('')
  }

  // Filter schedules for the current selector
  const filtered = schedules.filter(s =>
    perspective === 'class' ? s.classId === selectedId : s.teacherId === selectedId
  )

  // Maps for fast lookup in child components
  const subjectMap  = new Map(subjects.map(s  => [s.id, s]))
  const classMap    = new Map(classes.map(c   => [c.id, c]))
  const teacherMap  = new Map(teachers.map(t  => [t.id, t]))

  // ── Write helpers ────────────────────────────────────────────────────────────

  async function handleSave(data: {
    dayOfWeek: number; startTime: string; endTime: string
    subjectId: string; classId: string; teacherId: string
  }) {
    const now = new Date().toISOString()

    if (modal.entry) {
      // Edit existing
      await localDb.schedules.update(modal.entry.id, {
        ...data,
        updatedAt:  now,
        syncStatus: 'pending',
      })
    } else {
      // Create new — use crypto.randomUUID()
      const id = globalThis.crypto.randomUUID()
      await localDb.schedules.add({
        id,
        ...data,
        updatedAt:  now,
        syncStatus: 'pending',
      })
    }

    setModal({ open: false, entry: null })
    await reload()
    sync() // fire-and-forget push
  }

  async function handleDelete() {
    if (!modal.entry) return
    const now = new Date().toISOString()
    await localDb.schedules.update(modal.entry.id, {
      deletedAt:  now,
      updatedAt:  now,
      syncStatus: 'pending',
    })
    setModal({ open: false, entry: null })
    await reload()
    sync()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectorOptions = perspective === 'class'
    ? classes.map(c  => ({ id: c.id,  label: c.name }))
    : teachers.map(t => ({ id: t.id,  label: `${t.firstName} ${t.lastName}` }))

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-900 mr-2">{t('schedule.title')}</h1>

        {/* Perspective toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => switchPerspective('class')}
            className={`px-3 py-1.5 transition-colors ${perspective === 'class' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {t('schedule.byClass')}
          </button>
          <button
            onClick={() => switchPerspective('teacher')}
            className={`px-3 py-1.5 transition-colors ${perspective === 'teacher' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {t('schedule.byTeacher')}
          </button>
        </div>

        {/* Entity selector */}
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="h-9 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{perspective === 'class' ? t('schedule.selectClass') : t('schedule.selectTeacher')}</option>
          {selectorOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        <div className="flex-1" />

        {syncState === 'syncing' && (
          <span className="text-xs text-gray-400">{t('nav.syncing')}</span>
        )}

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['grid', 'list'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 transition-colors ${view === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {v === 'grid' ? t('schedule.grid') : t('schedule.list')}
            </button>
          ))}
        </div>

        <button
          onClick={() => setModal({ open: true, entry: null })}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {t('schedule.addEntry')}
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedId ? (
          <p className="text-gray-400 text-sm text-center py-12">
            {t('schedule.selectPrompt', { perspective: perspective === 'class' ? t('schedule.byClass').toLowerCase() : t('schedule.byTeacher').toLowerCase() })}
          </p>
        ) : view === 'grid' ? (
          <WeeklyGrid
            schedules={filtered}
            subjects={subjectMap}
            classes={classMap}
            teachers={teacherMap}
            perspective={perspective}
            onEntryClick={entry => setModal({ open: true, entry })}
            onSlotClick={(day, time) => setModal({
              open: true,
              entry: null,
              defaults: { dayOfWeek: day, startTime: time },
            })}
          />
        ) : (
          <ScheduleList
            schedules={filtered}
            subjects={subjectMap}
            classes={classMap}
            teachers={teacherMap}
            perspective={perspective}
            onEntryClick={entry => setModal({ open: true, entry })}
          />
        )}
      </div>

      {/* ── Modal ── */}
      {modal.open && (
        <ScheduleEntryModal
          entry={modal.entry}
          subjects={subjects}
          classes={classes}
          teachers={teachers}
          defaults={modal.defaults}
          onSave={handleSave}
          onDelete={modal.entry ? handleDelete : undefined}
          onClose={() => setModal({ open: false, entry: null })}
        />
      )}
    </div>
  )
}
