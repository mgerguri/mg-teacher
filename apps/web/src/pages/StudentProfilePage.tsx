import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { localDb, LocalStudent, LocalClass, LocalSchedule, LocalSubject, LocalGrade, LocalConductNote, LocalContactLog } from '../lib/local-db'
import { useSync } from '../context/SyncContext'
import { useAuth } from '../context/AuthContext'
import StudentModal, { StudentFormState } from '../components/students/StudentModal'
import { saveFile } from '../lib/save-file'

async function downloadProgressReport(
  student:    LocalStudent,
  cls:        LocalClass | null,
  grades:     LocalGrade[],
  subjects:   Map<string, LocalSubject>,
  attendance: { absent: number; excused: number },
  t:          (k: string) => string,
) {
  const { default: jsPDF }   = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W    = doc.internal.pageSize.getWidth()
  let   y    = 18

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(t('studentProfile.progressReport'), W / 2, y, { align: 'center' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${student.firstName} ${student.lastName}`, W / 2, y, { align: 'center' })
  y += 5
  if (cls) doc.text(`${cls.name}  ·  ${cls.gradeLevel}  ·  ${cls.academicYear}`, W / 2, y, { align: 'center' })
  y += 5
  doc.setTextColor(150)
  doc.text(new Date().toLocaleDateString(), W / 2, y, { align: 'center' })
  doc.setTextColor(0)
  y += 10

  // ── Grades by term ──────────────────────────────────────────────────────────
  const terms = [...new Set(grades.map(g => g.term))].sort()
  for (const term of terms) {
    const termGrades = grades.filter(g => g.term === term)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(term, 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [[ t('studentProfile.subject'), t('studentProfile.score') ]],
      body: termGrades.map(g => [
        subjects.get(g.subjectId)?.name ?? '—',
        String(g.score),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 1: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  }

  // ── Attendance ───────────────────────────────────────────────────────────────
  const total = attendance.absent + attendance.excused
  autoTable(doc, {
    startY: y,
    head: [[ t('studentProfile.attendanceTitle'), '' ]],
    body: [
      [ t('attendance.absent'),  String(attendance.absent)  ],
      [ t('attendance.excused'), String(attendance.excused) ],
      [ t('attendance.summary.total'), String(total)         ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241] },
    columnStyles: { 1: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  })

  const name = `progress-${student.lastName}-${student.firstName}.pdf`.toLowerCase().replace(/\s+/g, '-')
  const buf  = doc.output('arraybuffer')
  await saveFile(name, buf)
}

const SCORE_STYLE: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-green-100 text-green-700',
  5: 'bg-emerald-100 text-emerald-700',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{children}</div>
    </div>
  )
}

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate      = useNavigate()
  const { sync }      = useSync()
  const { t }         = useTranslation()

  const [student,   setStudent]   = useState<LocalStudent | null>(null)
  const [cls,       setCls]       = useState<LocalClass | null>(null)
  const [classes,   setClasses]   = useState<LocalClass[]>([])
  const [schedules, setSchedules] = useState<LocalSchedule[]>([])
  const [subjects,  setSubjects]  = useState<Map<string, LocalSubject>>(new Map())
  const [grades,       setGrades]       = useState<LocalGrade[]>([])
  const [attendance,   setAttendance]   = useState<{ absent: number; excused: number }>({ absent: 0, excused: 0 })
  const [conductNotes, setConductNotes] = useState<LocalConductNote[]>([])
  const [contactLogs,  setContactLogs]  = useState<LocalContactLog[]>([])
  const [editing,      setEditing]      = useState(false)
  const [reportError,  setReportError]  = useState<string | null>(null)

  // Inline add-conduct-note form
  const [conductForm,  setConductForm]  = useState({ date: new Date().toISOString().slice(0, 10), category: 'neutral' as LocalConductNote['category'], note: '' })
  // Inline add-contact-log form
  const [contactForm,  setContactForm]  = useState({ date: new Date().toISOString().slice(0, 10), method: 'phone' as LocalContactLog['method'], topic: '', outcome: '' })

  const { user } = useAuth()

  const reload = useCallback(async () => {
    if (!studentId) return
    const [s, allClasses, allSubjects] = await Promise.all([
      localDb.students.get(studentId),
      localDb.classes.filter(c => !c.deletedAt).toArray(),
      localDb.subjects.filter(s => !s.deletedAt).toArray(),
    ])
    setStudent(s ?? null)
    setClasses(allClasses)
    setSubjects(new Map(allSubjects.map(su => [su.id, su])))

    const cls = s?.classId ? allClasses.find(c => c.id === s.classId) ?? null : null
    setCls(cls)

    if (cls) {
      const sc = await localDb.schedules.filter(s => s.classId === cls.id && !s.deletedAt).toArray()
      setSchedules(sc.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)))
    }

    const gr  = await localDb.grades.filter(g => !g.deletedAt && g.studentId === studentId).toArray()
    setGrades(gr.sort((a, b) => a.term.localeCompare(b.term)))

    const att = await localDb.attendances.filter(a => !a.deletedAt && a.studentId === studentId).toArray()
    setAttendance({
      absent:  att.filter(a => a.status === 'absent').length,
      excused: att.filter(a => a.status === 'excused').length,
    })

    const cn  = await localDb.conductNotes.filter(n => !n.deletedAt && n.studentId === studentId).toArray()
    setConductNotes(cn.sort((a, b) => b.date.localeCompare(a.date)))

    const cl  = await localDb.contactLogs.filter(l => !l.deletedAt && l.studentId === studentId).toArray()
    setContactLogs(cl.sort((a, b) => b.date.localeCompare(a.date)))
  }, [studentId])

  useEffect(() => { reload() }, [reload])

  async function handleSave(data: StudentFormState) {
    if (!student) return
    const now = new Date().toISOString()
    await localDb.students.update(student.id, { ...data, updatedAt: now, syncStatus: 'pending' })
    setEditing(false)
    await reload()
    sync()
  }

  async function handleDelete() {
    if (!student) return
    const now = new Date().toISOString()
    await localDb.students.update(student.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
    sync()
    navigate(cls ? `/classes/${cls.id}` : '/classes')
  }

  async function addConductNote() {
    if (!conductForm.note.trim() || !user) return
    const now = new Date().toISOString()
    await localDb.conductNotes.add({
      id:        globalThis.crypto.randomUUID(),
      studentId: studentId!,
      teacherId: user.id,
      date:      conductForm.date,
      category:  conductForm.category,
      note:      conductForm.note.trim(),
      updatedAt: now,
      syncStatus: 'pending',
    })
    setConductForm(f => ({ ...f, note: '' }))
    await reload()
    sync()
  }

  async function deleteConductNote(id: string) {
    const now = new Date().toISOString()
    await localDb.conductNotes.update(id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
    await reload()
    sync()
  }

  async function addContactLog() {
    if (!contactForm.topic.trim() || !user) return
    const now = new Date().toISOString()
    await localDb.contactLogs.add({
      id:        globalThis.crypto.randomUUID(),
      studentId: studentId!,
      teacherId: user.id,
      date:      contactForm.date,
      method:    contactForm.method,
      topic:     contactForm.topic.trim(),
      outcome:   contactForm.outcome.trim() || undefined,
      updatedAt: now,
      syncStatus: 'pending',
    })
    setContactForm(f => ({ ...f, topic: '', outcome: '' }))
    await reload()
    sync()
  }

  async function deleteContactLog(id: string) {
    const now = new Date().toISOString()
    await localDb.contactLogs.update(id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
    await reload()
    sync()
  }

  async function handleDownloadReport() {
    if (!student) return
    setReportError(null)
    try {
      await downloadProgressReport(student, cls, grades, subjects, attendance, t)
    } catch {
      setReportError(t('studentProfile.reportError'))
    }
  }

  if (!student) {
    return <div className="p-6 text-sm text-gray-400">{t('common.loading')}</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/classes" className="hover:text-gray-600">{t('common.breadcrumbClasses')}</Link>
        {cls && <>
          <span>/</span>
          <Link to={`/classes/${cls.id}`} className="hover:text-gray-600">{cls.name}</Link>
        </>}
        <span>/</span>
        <span className="text-gray-700">{student.firstName} {student.lastName}</span>
      </div>

      {reportError && <p className="text-sm text-red-600 mb-4">{reportError}</p>}

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {student.firstName} {student.lastName}
            </h1>
            {cls && (
              <p className="text-sm text-gray-500 mt-1">
                {cls.name} · {cls.gradeLevel} · {cls.academicYear}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadReport}
              className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 rounded-lg transition-colors"
            >
              {t('studentProfile.downloadReport')}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 rounded-lg transition-colors"
            >
              {t('studentProfile.edit')}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <Section title={t('studentProfile.basicInfo')}>
            <Field label={t('studentProfile.dateOfBirth')} value={student.dateOfBirth} />
            <Field label={t('studentProfile.enrolled')}    value={student.enrolledAt?.slice(0, 10)} />
          </Section>

          {(student.email || student.phone) && (
            <Section title={t('studentProfile.contact')}>
              <Field label={t('studentProfile.email')} value={student.email} />
              <Field label={t('studentProfile.phone')} value={student.phone} />
            </Section>
          )}

          {(student.parentName || student.parentPhone || student.parentEmail) && (
            <Section title={t('studentProfile.parentGuardian')}>
              <Field label={t('studentProfile.name')}  value={student.parentName} />
              <Field label={t('studentProfile.phone')} value={student.parentPhone} />
              <Field label={t('studentProfile.email')} value={student.parentEmail} />
            </Section>
          )}

          {(student.address || student.notes) && (
            <Section title={t('studentProfile.other')}>
              <Field label={t('studentProfile.address')} value={student.address} />
              <Field label={t('studentProfile.notes')}   value={student.notes} />
            </Section>
          )}
        </div>
      </div>

      {/* Schedule */}
      {schedules.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('studentProfile.classSchedule')}</h2>
          <div className="space-y-1">
            {schedules.map(entry => (
              <div key={entry.id} className="flex items-center gap-4 py-2 border-t border-gray-50 first:border-0">
                <span className="text-xs font-medium text-gray-400 w-8">{DAY_NAMES[entry.dayOfWeek]}</span>
                <span className="text-xs text-gray-400 w-24">{entry.startTime}–{entry.endTime}</span>
                <span className="text-sm text-gray-800">{subjects.get(entry.subjectId)?.name ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grades — subjects × terms matrix with trend arrows */}
      {grades.length > 0 && (() => {
        // Collect distinct sorted terms and subject ids
        const terms       = [...new Set(grades.map(g => g.term))].sort()
        const subjectIds  = [...new Set(grades.map(g => g.subjectId))]
        // grade lookup: subjectId → term → score
        const lookup = new Map<string, Map<string, number>>()
        for (const g of grades) {
          if (!lookup.has(g.subjectId)) lookup.set(g.subjectId, new Map())
          lookup.get(g.subjectId)!.set(g.term, g.score)
        }

        function trendArrow(subjectId: string): { arrow: string; color: string } | null {
          if (terms.length < 2) return null
          const last  = lookup.get(subjectId)?.get(terms[terms.length - 1])
          const prev  = lookup.get(subjectId)?.get(terms[terms.length - 2])
          if (last == null || prev == null) return null
          if (last > prev) return { arrow: '↑', color: 'text-emerald-600' }
          if (last < prev) return { arrow: '↓', color: 'text-red-500' }
          return { arrow: '→', color: 'text-gray-400' }
        }

        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('studentProfile.gradesTitle')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs">{t('studentProfile.subject')}</th>
                    {terms.map(term => (
                      <th key={term} className="pb-2 px-3 font-medium text-gray-500 text-xs text-center">{term}</th>
                    ))}
                    {terms.length >= 2 && (
                      <th className="pb-2 px-3 font-medium text-gray-400 text-xs text-center">{t('studentProfile.trend')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {subjectIds.map(subId => {
                    const sub   = subjects.get(subId)
                    const trend = trendArrow(subId)
                    return (
                      <tr key={subId} className="border-t border-gray-50">
                        <td className="py-2 pr-4 text-gray-700 font-medium">{sub?.name ?? '—'}</td>
                        {terms.map(term => {
                          const score = lookup.get(subId)?.get(term)
                          return (
                            <td key={term} className="py-2 px-3 text-center">
                              {score != null
                                ? <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-semibold ${SCORE_STYLE[score]}`}>{score}</span>
                                : <span className="text-gray-200">—</span>}
                            </td>
                          )
                        })}
                        {terms.length >= 2 && (
                          <td className="py-2 px-3 text-center font-bold text-lg">
                            {trend ? <span className={trend.color}>{trend.arrow}</span> : <span className="text-gray-200">—</span>}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Attendance summary */}
      {(attendance.absent > 0 || attendance.excused > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('studentProfile.attendanceTitle')}</h2>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{attendance.absent}</p>
              <p className="text-xs text-gray-400 mt-1">{t('attendance.absent')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{attendance.excused}</p>
              <p className="text-xs text-gray-400 mt-1">{t('attendance.excused')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-700">{attendance.absent + attendance.excused}</p>
              <p className="text-xs text-gray-400 mt-1">{t('attendance.summary.total')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Conduct notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('studentProfile.conductTitle')}</h2>

        {/* Add form */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="date" value={conductForm.date}
            onChange={e => setConductForm(f => ({ ...f, date: e.target.value }))}
            className="h-9 px-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={conductForm.category}
            onChange={e => setConductForm(f => ({ ...f, category: e.target.value as LocalConductNote['category'] }))}
            className="h-9 px-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="positive">{t('conduct.positive')}</option>
            <option value="neutral">{t('conduct.neutral')}</option>
            <option value="concern">{t('conduct.concern')}</option>
          </select>
          <input value={conductForm.note} onChange={e => setConductForm(f => ({ ...f, note: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addConductNote()}
            placeholder={t('conduct.notePlaceholder')}
            className="flex-1 min-w-48 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={addConductNote}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            {t('conduct.add')}
          </button>
        </div>

        {/* Timeline */}
        {conductNotes.length === 0
          ? <p className="text-sm text-gray-300 text-center py-4">{t('conduct.empty')}</p>
          : (
            <div className="space-y-2">
              {conductNotes.map(cn => {
                const catStyle = cn.category === 'positive' ? 'bg-emerald-100 text-emerald-700'
                               : cn.category === 'concern'  ? 'bg-red-100 text-red-700'
                               : 'bg-gray-100 text-gray-600'
                return (
                  <div key={cn.id} className="flex items-start gap-3 py-2 border-t border-gray-50 first:border-0">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">{cn.date}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${catStyle}`}>
                      {t(`conduct.${cn.category}`)}
                    </span>
                    <p className="text-sm text-gray-700 flex-1">{cn.note}</p>
                    <button onClick={() => deleteConductNote(cn.id)}
                      className="text-xs text-gray-300 hover:text-red-400 flex-shrink-0">✕</button>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {/* Contact log */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('studentProfile.contactLogTitle')}</h2>

        {/* Add form */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="date" value={contactForm.date}
            onChange={e => setContactForm(f => ({ ...f, date: e.target.value }))}
            className="h-9 px-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={contactForm.method}
            onChange={e => setContactForm(f => ({ ...f, method: e.target.value as LocalContactLog['method'] }))}
            className="h-9 px-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="phone">{t('contactLog.phone')}</option>
            <option value="email">{t('contactLog.email')}</option>
            <option value="meeting">{t('contactLog.meeting')}</option>
            <option value="other">{t('contactLog.other')}</option>
          </select>
          <input value={contactForm.topic} onChange={e => setContactForm(f => ({ ...f, topic: e.target.value }))}
            placeholder={t('contactLog.topicPlaceholder')}
            className="flex-1 min-w-32 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={contactForm.outcome} onChange={e => setContactForm(f => ({ ...f, outcome: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addContactLog()}
            placeholder={t('contactLog.outcomePlaceholder')}
            className="flex-1 min-w-32 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={addContactLog}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            {t('contactLog.add')}
          </button>
        </div>

        {contactLogs.length === 0
          ? <p className="text-sm text-gray-300 text-center py-4">{t('contactLog.empty')}</p>
          : (
            <div className="space-y-2">
              {contactLogs.map(cl => (
                <div key={cl.id} className="flex items-start gap-3 py-2 border-t border-gray-50 first:border-0">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">{cl.date}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex-shrink-0">
                    {t(`contactLog.${cl.method}`)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 font-medium truncate">{cl.topic}</p>
                    {cl.outcome && <p className="text-xs text-gray-400 truncate">{cl.outcome}</p>}
                  </div>
                  <button onClick={() => deleteContactLog(cl.id)}
                    className="text-xs text-gray-300 hover:text-red-400 flex-shrink-0">✕</button>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {editing && (
        <StudentModal
          student={student}
          classes={classes}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
