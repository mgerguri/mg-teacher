import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { localDb, LocalClass, LocalStudent, LocalSubject, LocalGrade, LocalSchedule } from '../lib/local-db'
import { useAuth } from '../context/AuthContext'
import { scopeClasses, scopeSubjects } from '../lib/scope'
import { exportToExcel, exportToPDF, ReportExportData } from '../lib/report-export'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentRow {
  student:    LocalStudent
  avgGrade:   number | null
  gradeCount: number
  absent:     number
  excused:    number
  grades:     Map<string, number>  // subjectId → score
}

type SortKey = 'name' | 'avgGrade' | 'absent' | 'excused' | 'total'
type SortDir = 'asc' | 'desc'

// ── Helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function fmt(n: number | null, decimals = 1): string {
  if (n === null) return '—'
  return n.toFixed(decimals)
}

const SCORE_BG: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-green-100 text-green-700',
  5: 'bg-emerald-100 text-emerald-700',
}

function gradeColor(avg: number | null): string {
  if (avg === null) return 'text-gray-300'
  if (avg < 2)   return 'text-red-600'
  if (avg < 3)   return 'text-orange-600'
  if (avg < 4)   return 'text-yellow-600'
  if (avg < 4.5) return 'text-green-600'
  return 'text-emerald-600'
}

function avgBadge(avg: number | null): string {
  if (avg === null) return 'bg-gray-100 text-gray-400'
  if (avg < 2)   return 'bg-red-100 text-red-700'
  if (avg < 3)   return 'bg-orange-100 text-orange-700'
  if (avg < 4)   return 'bg-yellow-100 text-yellow-700'
  if (avg < 4.5) return 'bg-green-100 text-green-700'
  return 'bg-emerald-100 text-emerald-700'
}

// ── Sort header ───────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, current, dir, onSort, className = ''
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = current === sortKey
  return (
    <th
      className={`px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1 justify-center">
        {label}
        <span className={`text-xs ${active ? 'text-gray-700' : 'text-gray-300'}`}>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { t }    = useTranslation()
  const { user } = useAuth()

  const [classes,  setClasses]  = useState<LocalClass[]>([])
  const [classId,  setClassId]  = useState<string>('')
  const [term,     setTerm]     = useState<string>('all')
  const [terms,    setTerms]    = useState<string[]>([])
  const [subjects, setSubjects] = useState<LocalSubject[]>([])
  const [rows,     setRows]     = useState<StudentRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [sortKey,   setSortKey]   = useState<SortKey>('name')
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')

  // ── Load classes ─────────────────────────────────────────────────────────────
  useEffect(() => {
    localDb.classes.filter(c => !c.deletedAt).toArray().then(all => {
      const sorted = scopeClasses(all, user).sort((a, b) => a.name.localeCompare(b.name))
      setClasses(sorted)
      if (sorted.length) setClassId(sorted[0].id)
    })
  }, [user])

  // ── Load report data when classId changes ─────────────────────────────────────
  useEffect(() => {
    if (!classId) return
    setLoading(true)

    Promise.all([
      localDb.students.filter(s => !s.deletedAt && s.classId === classId).toArray(),
      localDb.grades.filter(g => !g.deletedAt && g.classId === classId).toArray(),
      localDb.attendances.filter(a => !a.deletedAt && a.classId === classId).toArray(),
      localDb.schedules.filter(s => !s.deletedAt && s.classId === classId).toArray(),
      localDb.subjects.filter(s => !s.deletedAt).toArray(),
    ]).then(([students, grades, attendances, schedules, allSubjects]) => {
      // Collect distinct terms
      const distinctTerms = [...new Set(grades.map(g => g.term))].sort()
      setTerms(distinctTerms)

      // Subject lookup
      const subjectMap = new Map(scopeSubjects(allSubjects, user).map(s => [s.id, s]))

      // Subjects that are scheduled for this class (for column display)
      const scheduledSubjectIds = [...new Set(schedules.map(s => s.subjectId))]
      const classSubjects = scheduledSubjectIds
        .map(id => subjectMap.get(id))
        .filter(Boolean) as LocalSubject[]
      setSubjects(classSubjects)

      // Filter grades by selected term
      const filteredGrades = term === 'all' ? grades : grades.filter(g => g.term === term)

      // Build student rows
      const studentRows: StudentRow[] = students
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .map(student => {
          const studentGrades = filteredGrades.filter(g => g.studentId === student.id)
          const scores        = studentGrades.map(g => g.score)
          const gradeMap      = new Map<string, number>()
          for (const g of studentGrades) gradeMap.set(g.subjectId, g.score)

          const studentAtt = attendances.filter(a => a.studentId === student.id)

          return {
            student,
            avgGrade:   avg(scores),
            gradeCount: scores.length,
            absent:     studentAtt.filter(a => a.status === 'absent').length,
            excused:    studentAtt.filter(a => a.status === 'excused').length,
            grades:     gradeMap,
          }
        })

      setRows(studentRows)
      setLoading(false)
    })
  }, [classId, term, user])

  // ── Sorting ────────────────────────────────────────────────────────────────

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'name':     diff = (a.student.lastName + a.student.firstName).localeCompare(b.student.lastName + b.student.firstName); break
        case 'avgGrade': diff = (a.avgGrade ?? -1) - (b.avgGrade ?? -1); break
        case 'absent':   diff = a.absent  - b.absent;  break
        case 'excused':  diff = a.excused - b.excused; break
        case 'total':    diff = (a.absent + a.excused) - (b.absent + b.excused); break
      }
      return sortDir === 'asc' ? diff : -diff
    })
    return copy
  }, [rows, sortKey, sortDir])

  // ── Per-subject averages (declared before export helpers that need it) ────────

  const subjectAvgs = useMemo(() => {
    return subjects.map(sub => {
      const scores = rows
        .map(r => r.grades.get(sub.id))
        .filter(s => s !== undefined) as number[]
      return { subject: sub, avg: avg(scores), count: scores.length }
    }).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
  }, [subjects, rows])

  // ── Export helpers ────────────────────────────────────────────────────────────

  const buildExportData = useCallback((): ReportExportData => {
    const cls       = classes.find(c => c.id === classId)
    const className = cls ? `${cls.name} ${cls.gradeLevel}` : classId
    const termLabel = term === 'all' ? 'All terms' : term
    return {
      className,
      term:        termLabel,
      generatedAt: new Date().toLocaleString(),
      students: sorted.map(r => ({
        name:        `${r.student.lastName}, ${r.student.firstName}`,
        avgGrade:    fmt(r.avgGrade),
        absent:      r.absent,
        excused:     r.excused,
        totalMissed: r.absent + r.excused,
      })),
      subjects: subjectAvgs.map(s => ({
        subject:        s.subject.name,
        avgGrade:       fmt(s.avg),
        gradesRecorded: s.count,
      })),
    }
  }, [sorted, subjectAvgs, classes, classId, term])

  async function handleExportExcel() {
    setExporting('excel')
    setExportError(null)
    try { await exportToExcel(buildExportData()) }
    catch { setExportError(t('reports.export.error')) }
    finally { setExporting(null) }
  }

  async function handleExportPDF() {
    setExporting('pdf')
    setExportError(null)
    try { await exportToPDF(buildExportData()) }
    catch { setExportError(t('reports.export.error')) }
    finally { setExporting(null) }
  }

  // ── Class-level stats ────────────────────────────────────────────────────────

  const classStats = useMemo(() => {
    const allAvgs   = rows.map(r => r.avgGrade).filter(v => v !== null) as number[]
    const classAvg  = avg(allAvgs)
    const totalAbs  = rows.reduce((n, r) => n + r.absent,  0)
    const totalExc  = rows.reduce((n, r) => n + r.excused, 0)
    const atRisk    = rows.filter(r => (r.absent + r.excused) >= 5 || (r.avgGrade !== null && r.avgGrade < 2.5))
    return { classAvg, totalAbs, totalExc, atRisk }
  }, [rows])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{t('reports.title')}</h1>

        {/* Export buttons — only show when there's data */}
        {rows.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting === 'excel' ? '…' : '⬇'}
              {t('reports.export.excel')}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting === 'pdf' ? '…' : '⬇'}
              {t('reports.export.pdf')}
            </button>
          </div>
        )}
      </div>

      {exportError && <p className="text-sm text-red-600 -mt-4 mb-6">{exportError}</p>}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('reports.class')}</label>
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
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('reports.term')}</label>
          <select
            value={term}
            onChange={e => setTerm(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('reports.allTerms')}</option>
            {terms.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-12 text-center">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">{t('reports.noStudents')}</p>
      ) : (
        <>
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              label={t('reports.stats.students')}
              value={String(rows.length)}
            />
            <StatCard
              label={t('reports.stats.classAvg')}
              value={fmt(classStats.classAvg)}
              valueClass={gradeColor(classStats.classAvg)}
            />
            <StatCard
              label={t('reports.stats.totalAbsences')}
              value={String(classStats.totalAbs + classStats.totalExc)}
              valueClass={classStats.totalAbs + classStats.totalExc > 0 ? 'text-red-600' : 'text-gray-700'}
            />
            <StatCard
              label={t('reports.stats.atRisk')}
              value={String(classStats.atRisk.length)}
              valueClass={classStats.atRisk.length > 0 ? 'text-orange-600' : 'text-gray-700'}
              sublabel={t('reports.stats.atRiskHint')}
            />
          </div>

          {/* ── Student table ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">{t('reports.studentTable.title')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <SortTh label={t('reports.studentTable.name')}    sortKey="name"     current={sortKey} dir={sortDir} onSort={handleSort} className="text-left" />
                    <SortTh label={t('reports.studentTable.avgGrade')} sortKey="avgGrade" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label={t('attendance.absent')}            sortKey="absent"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label={t('attendance.excused')}           sortKey="excused"  current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label={t('reports.studentTable.total')}   sortKey="total"    current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => {
                    const totalMissed = row.absent + row.excused
                    const isAtRisk    = totalMissed >= 5 || (row.avgGrade !== null && row.avgGrade < 2.5)
                    return (
                      <tr key={row.student.id} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isAtRisk && (
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" title={t('reports.stats.atRiskHint')} />
                            )}
                            <span className="font-medium text-gray-800">
                              {row.student.lastName}, {row.student.firstName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${avgBadge(row.avgGrade)}`}>
                            {fmt(row.avgGrade)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.absent > 0
                            ? <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">{row.absent}</span>
                            : <span className="text-gray-300">0</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.excused > 0
                            ? <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">{row.excused}</span>
                            : <span className="text-gray-300">0</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {totalMissed > 0
                            ? <span className={`font-semibold ${totalMissed >= 5 ? 'text-orange-600' : 'text-gray-700'}`}>{totalMissed}</span>
                            : <span className="text-gray-300">0</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/students/${row.student.id}`}
                            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            {t('reports.studentTable.viewProfile')} →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Subject breakdown ── */}
          {subjectAvgs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">{t('reports.subjectBreakdown.title')}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{t('reports.subjectBreakdown.subtitle')}</p>
              </div>
              <div className="p-5 space-y-4">
                {subjectAvgs.map(({ subject, avg: subAvg, count }) => (
                  <div key={subject.id} className="flex items-center gap-4">
                    <div className="w-40 flex-shrink-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{subject.name}</p>
                      <p className="text-xs text-gray-400">{count} {count === 1 ? t('reports.subjectBreakdown.grade') : t('reports.subjectBreakdown.grades')}</p>
                    </div>
                    {/* Bar */}
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            subAvg === null ? 'w-0' :
                            subAvg < 2   ? 'bg-red-400' :
                            subAvg < 3   ? 'bg-orange-400' :
                            subAvg < 4   ? 'bg-yellow-400' :
                            subAvg < 4.5 ? 'bg-green-400' :
                            'bg-emerald-400'
                          }`}
                          style={{ width: subAvg !== null ? `${(subAvg / 5) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-10 text-right ${gradeColor(subAvg)}`}>
                        {fmt(subAvg)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueClass = 'text-gray-900',
  sublabel,
}: {
  label: string
  value: string
  valueClass?: string
  sublabel?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
    </div>
  )
}
