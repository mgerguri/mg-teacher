import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { localDb } from '../lib/local-db'
import { useAuth } from '../context/AuthContext'

interface Stats {
  students:   number
  classes:    number
  todaySlots: TodaySlot[]
  atRisk:     AtRiskStudent[]
}

interface TodaySlot {
  scheduleId: string
  startTime:  string
  endTime:    string
  subjectName: string
  className:   string
}

interface AtRiskStudent {
  id:        string
  firstName: string
  lastName:  string
  classId?:  string
  className: string
  avgGrade:  number | null
  absences:  number
  reason:    string[]
}

const TODAY_DOW = new Date().getDay() // 0=Sun … 6=Sat

export default function DashboardPage() {
  const { t }    = useTranslation()
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [students, classes, subjects, schedules, grades, attendances] = await Promise.all([
        localDb.students.filter(s => !s.deletedAt).toArray(),
        localDb.classes.filter(c => !c.deletedAt).toArray(),
        localDb.subjects.filter(s => !s.deletedAt).toArray(),
        localDb.schedules.filter(s => !s.deletedAt).toArray(),
        localDb.grades.filter(g => !g.deletedAt).toArray(),
        localDb.attendances.filter(a => !a.deletedAt).toArray(),
      ])

      const subjectMap = new Map(subjects.map(s => [s.id, s.name]))
      const classMap   = new Map(classes.map(c => [c.id, c.name]))

      // ── Today's slots ────────────────────────────────────────────────────
      const todaySlots: TodaySlot[] = schedules
        .filter(sc => sc.dayOfWeek === TODAY_DOW)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .slice(0, 8)
        .map(sc => ({
          scheduleId:  sc.id,
          startTime:   sc.startTime,
          endTime:     sc.endTime,
          subjectName: subjectMap.get(sc.subjectId) ?? '—',
          className:   classMap.get(sc.classId)  ?? '—',
        }))

      // ── At-risk ─────────────────────────────────────────────────────────
      const atRisk: AtRiskStudent[] = []
      for (const s of students) {
        const sGrades = grades.filter(g => g.studentId === s.id)
        const sAbs    = attendances.filter(a => a.studentId === s.id && a.status === 'absent').length

        const avgGrade = sGrades.length > 0
          ? sGrades.reduce((sum, g) => sum + g.score, 0) / sGrades.length
          : null

        const reason: string[] = []
        if (avgGrade !== null && avgGrade < 2.5) reason.push(t('dashboard.atRisk.lowGrade', { avg: avgGrade.toFixed(1) }))
        if (sAbs >= 5)                            reason.push(t('dashboard.atRisk.absences', { count: sAbs }))

        if (reason.length > 0) {
          atRisk.push({
            id:        s.id,
            firstName: s.firstName,
            lastName:  s.lastName,
            classId:   s.classId,
            className: s.classId ? (classMap.get(s.classId) ?? '—') : '—',
            avgGrade,
            absences:  sAbs,
            reason,
          })
        }
      }
      atRisk.sort((a, b) => (b.absences + (b.avgGrade == null ? 0 : (2.5 - b.avgGrade) * 2))
                          - (a.absences + (a.avgGrade == null ? 0 : (2.5 - a.avgGrade) * 2)))

      if (!cancelled) {
        setStats({
          students: students.length,
          classes:  classes.length,
          todaySlots,
          atRisk,
        })
      }
    }
    load()
    return () => { cancelled = true }
  }, [t])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t('dashboard.greeting', { name: user?.firstName ?? '' })}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('dashboard.stats.students')} value={stats?.students ?? '—'} color="blue"   href="/classes" />
        <StatCard label={t('dashboard.stats.classes')}  value={stats?.classes  ?? '—'} color="indigo" href="/classes" />
        <StatCard label={t('dashboard.stats.todaySlots')} value={stats?.todaySlots.length ?? '—'} color="emerald" />
        <StatCard label={t('dashboard.stats.atRisk')}   value={stats?.atRisk.length ?? '—'}   color={stats && stats.atRisk.length > 0 ? 'red' : 'gray'} href="#at-risk" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's schedule */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('dashboard.todaySchedule')}</h2>
          {!stats || stats.todaySlots.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-8">{t('dashboard.noSlotsToday')}</p>
          ) : (
            <div className="space-y-1">
              {stats.todaySlots.map(slot => (
                <div key={slot.scheduleId} className="flex items-center gap-3 py-2 border-t border-gray-50 first:border-0">
                  <span className="text-xs font-mono text-gray-400 w-24 flex-shrink-0">
                    {slot.startTime}–{slot.endTime}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{slot.subjectName}</p>
                    <p className="text-xs text-gray-400">{slot.className}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* At-risk students */}
        <div id="at-risk" className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('dashboard.atRiskTitle')}</h2>
          {!stats || stats.atRisk.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-8">{t('dashboard.noAtRisk')}</p>
          ) : (
            <div className="space-y-1">
              {stats.atRisk.slice(0, 10).map(s => (
                <div key={s.id} className="flex items-center gap-3 py-2 border-t border-gray-50 first:border-0">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/students/${s.id}`}
                      className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate block"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                    <p className="text-xs text-gray-400">{s.className}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {s.reason.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600">{r}</span>
                    ))}
                  </div>
                </div>
              ))}
              {stats.atRisk.length > 10 && (
                <p className="text-xs text-gray-400 text-center pt-2">
                  {t('dashboard.andMore', { count: stats.atRisk.length - 10 })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 mt-6">
        {([
          ['/classes',    t('nav.classes')],
          ['/grades',     t('nav.grades')],
          ['/attendance', t('nav.attendance')],
          ['/plans',      t('nav.plans')],
          ['/reports',    t('nav.reports')],
          ['/subjects',   t('nav.subjects')],
        ] as [string, string][]).map(([to, label]) => (
          <Link key={to} to={to}
            className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-900 rounded-xl transition-colors">
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, color, href }: {
  label: string
  value: number | string
  color: 'blue' | 'indigo' | 'emerald' | 'red' | 'gray'
  href?: string
}) {
  const colors = {
    blue:    'text-blue-600',
    indigo:  'text-indigo-600',
    emerald: 'text-emerald-600',
    red:     'text-red-600',
    gray:    'text-gray-600',
  }
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 transition-colors">
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
  return href ? <a href={href}>{inner}</a> : inner
}
