import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { localDb, LocalClass, LocalStudent, LocalAttendance } from '../lib/local-db'
import { useSync } from '../context/SyncContext'
import { useAuth } from '../context/AuthContext'

type Tab = 'mark' | 'summary'
type AttendanceStatus = 'absent' | 'excused'

// key for looking up an attendance record: `${studentId}:${date}`
function attKey(studentId: string, date: string) {
  return `${studentId}:${date}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  absent:  'bg-red-100 text-red-700 border-red-200',
  excused: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

function nextStatus(current: AttendanceStatus | undefined): AttendanceStatus | null {
  if (!current) return 'absent'
  if (current === 'absent') return 'excused'
  return null // null = mark as present (delete the record)
}

// ── Mark view ─────────────────────────────────────────────────────────────────

interface MarkViewProps {
  students:    LocalStudent[]
  date:        string
  attMap:      Map<string, LocalAttendance>
  onToggle:    (studentId: string, current: LocalAttendance | undefined) => void
  onMarkAll:   (status: AttendanceStatus) => void
  onClearAll:  () => void
}

function MarkView({ students, date, attMap, onToggle, onMarkAll, onClearAll }: MarkViewProps) {
  const { t } = useTranslation()

  if (students.length === 0) {
    return <p className="text-center py-16 text-sm text-gray-400">{t('attendance.mark.noStudents')}</p>
  }

  const absentCount  = students.filter(s => attMap.get(attKey(s.id, date))?.status === 'absent').length
  const excusedCount = students.filter(s => attMap.get(attKey(s.id, date))?.status === 'excused').length
  const presentCount = students.length - absentCount - excusedCount

  return (
    <div>
      {/* Mini stats + bulk actions */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="text-sm"><span className="font-semibold text-green-700">{presentCount}</span> <span className="text-gray-500">{t('attendance.present')}</span></div>
        <div className="text-sm"><span className="font-semibold text-red-600">{absentCount}</span> <span className="text-gray-500">{t('attendance.absent')}</span></div>
        <div className="text-sm"><span className="font-semibold text-yellow-600">{excusedCount}</span> <span className="text-gray-500">{t('attendance.excused')}</span></div>
        <div className="flex-1" />
        <button onClick={onClearAll}
          className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
          {t('attendance.bulk.allPresent')}
        </button>
        <button onClick={() => onMarkAll('absent')}
          className="px-3 py-1 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
          {t('attendance.bulk.allAbsent')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {students.map((s, i) => {
          const rec    = attMap.get(attKey(s.id, date))
          const status = rec?.deletedAt ? undefined : rec?.status
          return (
            <div
              key={s.id}
              className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <span className="flex-1 text-sm font-medium text-gray-800">
                {s.lastName}, {s.firstName}
              </span>
              {rec?.syncStatus === 'pending' && (
                <span className="text-xs text-amber-400">●</span>
              )}
              <button
                onClick={() => onToggle(s.id, rec?.deletedAt ? undefined : rec)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  status
                    ? STATUS_STYLES[status]
                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {status ? t(`attendance.${status}`) : t('attendance.present')}
              </button>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 mt-3">{t('attendance.mark.hint')}</p>
    </div>
  )
}

// ── Summary view ──────────────────────────────────────────────────────────────

interface SummaryViewProps {
  students:  LocalStudent[]
  classId:   string
  dateFrom:  string
  dateTo:    string
}

function SummaryView({ students, classId, dateFrom, dateTo }: SummaryViewProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Array<{ student: LocalStudent; absent: number; excused: number; total: number }>>([])

  useEffect(() => {
    if (!classId || !dateFrom || !dateTo) return
    localDb.attendances
      .filter(a => !a.deletedAt && a.classId === classId && a.date >= dateFrom && a.date <= dateTo)
      .toArray()
      .then(all => {
        const studentIds = new Set(students.map(s => s.id))
        const relevant   = all.filter(a => studentIds.has(a.studentId))

        const counts = new Map<string, { absent: number; excused: number }>()
        for (const s of students) counts.set(s.id, { absent: 0, excused: 0 })
        for (const a of relevant) {
          const c = counts.get(a.studentId)
          if (c) c[a.status]++
        }

        const sorted = students
          .map(s => {
            const c = counts.get(s.id) ?? { absent: 0, excused: 0 }
            return { student: s, ...c, total: c.absent + c.excused }
          })
          .sort((a, b) => b.total - a.total || a.student.lastName.localeCompare(b.student.lastName))

        setRows(sorted)
      })
  }, [students, classId, dateFrom, dateTo])

  if (students.length === 0) {
    return <p className="text-center py-16 text-sm text-gray-400">{t('attendance.summary.noStudents')}</p>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('attendance.summary.student')}</th>
            <th className="px-4 py-3 text-center font-medium text-red-500">{t('attendance.absent')}</th>
            <th className="px-4 py-3 text-center font-medium text-yellow-500">{t('attendance.excused')}</th>
            <th className="px-4 py-3 text-center font-medium text-gray-500">{t('attendance.summary.total')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.student.id} className={`${i > 0 ? 'border-t border-gray-50' : ''} ${row.total > 0 ? '' : 'opacity-50'}`}>
              <td className="px-4 py-3 font-medium text-gray-800">
                {row.student.lastName}, {row.student.firstName}
              </td>
              <td className="px-4 py-3 text-center">
                {row.absent > 0
                  ? <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">{row.absent}</span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-center">
                {row.excused > 0
                  ? <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">{row.excused}</span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-center">
                {row.total > 0
                  ? <span className="font-semibold text-gray-700">{row.total}</span>
                  : <span className="text-gray-300">0</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { sync }  = useSync()
  const { user }  = useAuth()
  const { t }     = useTranslation()

  const [tab,      setTab]      = useState<Tab>('mark')
  const [classes,  setClasses]  = useState<LocalClass[]>([])
  const [classId,  setClassId]  = useState<string>('')
  const [date,     setDate]     = useState<string>(today())
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo,   setDateTo]   = useState<string>(today())

  const [students,  setStudents]  = useState<LocalStudent[]>([])
  const [attMap,    setAttMap]    = useState<Map<string, LocalAttendance>>(new Map())

  // Load classes once
  useEffect(() => {
    localDb.classes.filter(c => !c.deletedAt).toArray().then(all => {
      const sorted = all.sort((a, b) => a.name.localeCompare(b.name))
      setClasses(sorted)
      if (sorted.length && !classId) setClassId(sorted[0].id)
    })
  }, [])

  // Reload when class or date changes (mark tab data)
  const reload = useCallback(async () => {
    if (!classId) return

    const allStudents = await localDb.students.filter(s => !s.deletedAt && s.classId === classId).toArray()
    const sorted = allStudents.sort((a, b) => a.lastName.localeCompare(b.lastName))
    setStudents(sorted)

    // Load attendance records for this class + date
    const recs = await localDb.attendances
      .filter(a => !a.deletedAt && a.classId === classId && a.date === date)
      .toArray()
    const map = new Map<string, LocalAttendance>()
    for (const r of recs) map.set(attKey(r.studentId, r.date), r)
    setAttMap(map)
  }, [classId, date])

  useEffect(() => { reload() }, [reload])

  async function handleToggle(studentId: string, existing: LocalAttendance | undefined) {
    if (!user || !classId) return
    const next = nextStatus(existing?.status)
    const now  = new Date().toISOString()

    if (next === null) {
      // Mark as present: soft-delete the record
      if (existing) {
        await localDb.attendances.update(existing.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
      }
    } else if (existing) {
      // Update status
      await localDb.attendances.update(existing.id, { status: next, updatedAt: now, syncStatus: 'pending' })
    } else {
      // Create new record
      await localDb.attendances.add({
        id:         globalThis.crypto.randomUUID(),
        studentId,
        classId,
        date,
        status:     next,
        teacherId:  user.id,
        updatedAt:  now,
        syncStatus: 'pending',
      })
    }

    await reload()
    sync()
  }

  async function handleMarkAll(status: AttendanceStatus) {
    if (!user || !classId) return
    const now = new Date().toISOString()
    for (const s of students) {
      const existing = attMap.get(attKey(s.id, date))
      if (existing && !existing.deletedAt) {
        await localDb.attendances.update(existing.id, { status, updatedAt: now, syncStatus: 'pending' })
      } else {
        await localDb.attendances.add({
          id:         globalThis.crypto.randomUUID(),
          studentId:  s.id,
          classId,
          date,
          status,
          teacherId:  user.id,
          updatedAt:  now,
          syncStatus: 'pending',
        })
      }
    }
    await reload()
    sync()
  }

  async function handleClearAll() {
    if (!classId) return
    const now = new Date().toISOString()
    for (const s of students) {
      const existing = attMap.get(attKey(s.id, date))
      if (existing && !existing.deletedAt) {
        await localDb.attendances.update(existing.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
      }
    }
    await reload()
    sync()
  }

  const selectedClass = classes.find(c => c.id === classId)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-900 mr-2">{t('attendance.title')}</h1>

        {/* Tab toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => setTab('mark')}
            className={`px-3 py-1.5 transition-colors ${tab === 'mark' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {t('attendance.tabMark')}
          </button>
          <button
            onClick={() => setTab('summary')}
            className={`px-3 py-1.5 transition-colors ${tab === 'summary' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {t('attendance.tabSummary')}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        {/* Class */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('attendance.class')}</label>
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

        {tab === 'mark' ? (
          <>
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('attendance.date')}</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Context label */}
            {selectedClass && (
              <div className="text-sm text-gray-400 pb-2">
                {selectedClass.name} · {date}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Date range for summary */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('attendance.from')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('attendance.to')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {tab === 'mark' ? (
        <MarkView
          students={students}
          date={date}
          attMap={attMap}
          onToggle={handleToggle}
          onMarkAll={handleMarkAll}
          onClearAll={handleClearAll}
        />
      ) : (
        <SummaryView
          students={students}
          classId={classId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}
    </div>
  )
}
