import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { localDb, LocalAssessment, LocalStudent, LocalSubject, LocalClass } from '../lib/local-db'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { scopeClasses, scopeSubjects, scopeByClassId, classIdSet } from '../lib/scope'
import BulkImportModal from '../components/common/BulkImportModal'
import { ColumnMap } from '../lib/spreadsheet'

// ── Types ─────────────────────────────────────────────────────────────────────

type AssessmentType = 'quiz' | 'test' | 'exam' | 'homework' | 'other'

type AssessmentImportField =
  'student' | 'subject' | 'title' | 'type' | 'score' | 'maxScore' | 'grade' | 'date' | 'notes'

const ASSESSMENT_COLUMN_MAP: ColumnMap<AssessmentImportField> = {
  student: 'student', studentname: 'student', student_name: 'student', email: 'student',
  subject: 'subject', subjectname: 'subject', subject_name: 'subject', code: 'subject',
  title: 'title',
  type: 'type',
  score: 'score',
  maxscore: 'maxScore', max_score: 'maxScore', outof: 'maxScore', out_of: 'maxScore',
  grade: 'grade',
  date: 'date',
  notes: 'notes',
}

const ASSESSMENT_PREVIEW_COLUMNS: { key: AssessmentImportField; label: string }[] = [
  { key: 'student', label: 'student' },
  { key: 'subject', label: 'subject' },
  { key: 'title', label: 'title' },
  { key: 'score', label: 'score' },
  { key: 'maxScore', label: 'maxScore' },
  { key: 'grade', label: 'grade' },
  { key: 'date', label: 'date' },
]

function parseGrade(value: string | undefined): 1 | 2 | 3 | 4 | 5 | undefined {
  const n = Number(value)
  return n >= 1 && n <= 5 && Number.isInteger(n) ? (n as 1 | 2 | 3 | 4 | 5) : undefined
}

const GRADE_STYLE: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-green-100 text-green-700',
  5: 'bg-emerald-100 text-emerald-700',
}

const ASSESSMENT_TYPES: AssessmentType[] = ['quiz', 'test', 'exam', 'homework', 'other']

interface AssessmentForm {
  studentId: string
  subjectId: string
  title:     string
  type:      AssessmentType
  score:     string
  maxScore:  string
  grade:     string
  date:      string
  notes:     string
}

const EMPTY_FORM: AssessmentForm = {
  studentId: '',
  subjectId: '',
  title:     '',
  type:      'test',
  score:     '',
  maxScore:  '100',
  grade:     '',
  date:      new Date().toISOString().slice(0, 10),
  notes:     '',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { t }    = useTranslation()
  const { user } = useAuth()
  const { sync } = useSync()

  const [classes,     setClasses]     = useState<LocalClass[]>([])
  const [students,    setStudents]    = useState<LocalStudent[]>([])
  const [subjects,    setSubjects]    = useState<LocalSubject[]>([])
  const [assessments, setAssessments] = useState<LocalAssessment[]>([])

  const [classId,    setClassId]    = useState('')
  const [subjectId,  setSubjectId]  = useState('')

  const [modal, setModal] = useState<{ open: boolean; editing?: LocalAssessment }>({ open: false })
  const [form,  setForm]  = useState<AssessmentForm>(EMPTY_FORM)
  const [showImport,    setShowImport]    = useState(false)
  const [importSkipped, setImportSkipped] = useState<number | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    const [cl, st, su, as] = await Promise.all([
      localDb.classes.filter((c: { deletedAt?: string }) => !c.deletedAt).toArray(),
      localDb.students.filter((s: { deletedAt?: string }) => !s.deletedAt).toArray(),
      localDb.subjects.filter((s: { deletedAt?: string }) => !s.deletedAt).toArray(),
      localDb.assessments.filter((a: { deletedAt?: string }) => !a.deletedAt).toArray(),
    ])
    const ownClasses = scopeClasses(cl, user)
    const ownClassIds = classIdSet(ownClasses)
    setClasses(ownClasses)
    setStudents(scopeByClassId(st, user, ownClassIds))
    setSubjects(scopeSubjects(su, user))
    setAssessments(scopeByClassId(as, user, ownClassIds))
  }, [user])

  useEffect(() => { reload() }, [reload])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const classStudents = students.filter(s => s.classId === classId)

  const filtered = assessments.filter(a => {
    const st = students.find(s => s.id === a.studentId)
    if (classId  && st?.classId !== classId)   return false
    if (subjectId && a.subjectId !== subjectId) return false
    return true
  })

  // Group by student for the table view
  const byStudent = classStudents.map(st => ({
    student: st,
    rows:    filtered.filter(a => a.studentId === st.id).sort((a, b) => b.date.localeCompare(a.date)),
  }))

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      studentId: classStudents[0]?.id ?? '',
      subjectId: subjectId || subjects[0]?.id || '',
    })
    setModal({ open: true })
  }

  function openEdit(a: LocalAssessment) {
    setForm({
      studentId: a.studentId,
      subjectId: a.subjectId,
      title:     a.title,
      type:      a.type,
      score:     String(a.score),
      maxScore:  String(a.maxScore),
      grade:     a.grade ? String(a.grade) : '',
      date:      a.date,
      notes:     a.notes ?? '',
    })
    setModal({ open: true, editing: a })
  }

  async function handleSave() {
    if (!user || !form.studentId || !form.subjectId || !form.title || form.score === '') return
    const now = new Date().toISOString()
    const score    = Number(form.score)
    const maxScore = Number(form.maxScore) || 100
    const grade    = parseGrade(form.grade)

    const student = students.find(s => s.id === form.studentId)
    if (!student) return

    if (modal.editing) {
      await localDb.assessments.update(modal.editing.id, {
        studentId: form.studentId,
        subjectId: form.subjectId,
        title:     form.title,
        type:      form.type,
        score,
        maxScore,
        grade,
        date:      form.date,
        notes:     form.notes || undefined,
        updatedAt: now,
        syncStatus: 'pending',
      })
    } else {
      await localDb.assessments.add({
        id:         globalThis.crypto.randomUUID(),
        studentId:  form.studentId,
        subjectId:  form.subjectId,
        classId:    student.classId ?? classId,
        teacherId:  user.id,
        title:      form.title,
        type:       form.type,
        score,
        maxScore,
        grade,
        date:       form.date,
        notes:      form.notes || undefined,
        updatedAt:  now,
        syncStatus: 'pending',
      })
    }

    setModal({ open: false })
    await reload()
    sync()
  }

  async function handleDelete() {
    if (!modal.editing) return
    const now = new Date().toISOString()
    await localDb.assessments.update(modal.editing.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
    setModal({ open: false })
    await reload()
    sync()
  }

  function findStudent(query: string): LocalStudent | undefined {
    const q = query.trim().toLowerCase()
    if (!q) return undefined
    return classStudents.find(s =>
      s.email?.toLowerCase() === q
      || `${s.firstName} ${s.lastName}`.toLowerCase() === q
      || `${s.lastName} ${s.firstName}`.toLowerCase() === q
    )
  }

  function findSubject(query: string): LocalSubject | undefined {
    const q = query.trim().toLowerCase()
    if (!q) return undefined
    return subjects.find(s => s.name.toLowerCase() === q || s.code.toLowerCase() === q)
  }

  async function handleImport(rows: Partial<Record<AssessmentImportField, string>>[]) {
    if (!user) return
    const now = new Date().toISOString()
    const toAdd: LocalAssessment[] = []
    let skipped = 0

    for (const r of rows) {
      const student = r.student ? findStudent(r.student) : undefined
      const subject = r.subject ? findSubject(r.subject) : undefined
      const score = Number(r.score)
      if (!student || !subject || !r.title || Number.isNaN(score)) {
        skipped++
        continue
      }
      const type = ASSESSMENT_TYPES.includes(r.type as AssessmentType) ? (r.type as AssessmentType) : 'other'
      toAdd.push({
        id:         globalThis.crypto.randomUUID(),
        studentId:  student.id,
        subjectId:  subject.id,
        classId:    student.classId ?? classId,
        teacherId:  user.id,
        title:      r.title,
        type,
        score,
        maxScore:   Number(r.maxScore) || 100,
        grade:      parseGrade(r.grade),
        date:       r.date || now.slice(0, 10),
        notes:      r.notes || undefined,
        updatedAt:  now,
        syncStatus: 'pending',
      })
    }

    if (toAdd.length > 0) await localDb.assessments.bulkAdd(toAdd)
    setImportSkipped(skipped > 0 ? skipped : null)
    setShowImport(false)
    await reload()
    sync()
  }

  function pct(score: number, max: number) {
    return Math.round((score / max) * 100)
  }

  function pctColor(p: number) {
    if (p >= 85) return 'text-emerald-600'
    if (p >= 60) return 'text-amber-600'
    return 'text-red-500'
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('assessments.title')}</h1>
        {classId && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setImportSkipped(null); setShowImport(true) }}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              {t('assessments.importAssessments')}
            </button>
            <button
              onClick={openCreate}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              {t('assessments.addAssessment')}
            </button>
          </div>
        )}
      </div>

      {importSkipped !== null && (
        <p className="text-sm text-amber-600 mb-4">
          {t('assessments.importSkipped', { count: importSkipped })}
        </p>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={classId}
          onChange={e => { setClassId(e.target.value); setSubjectId('') }}
          className="h-9 border border-gray-300 rounded-lg px-3 text-sm"
        >
          <option value="">{t('assessments.selectClass')}</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={subjectId}
          onChange={e => setSubjectId(e.target.value)}
          className="h-9 border border-gray-300 rounded-lg px-3 text-sm"
        >
          <option value="">{t('assessments.allSubjects')}</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* No class selected */}
      {!classId && (
        <p className="text-gray-500 text-sm">{t('assessments.selectPrompt')}</p>
      )}

      {/* Table */}
      {classId && classStudents.length === 0 && (
        <p className="text-gray-500 text-sm">{t('assessments.noStudents')}</p>
      )}

      {classId && classStudents.length > 0 && (
        <div className="space-y-6">
          {byStudent.map(({ student, rows }) => {
            const avg = rows.length
              ? Math.round(rows.reduce((s, a) => s + pct(a.score, a.maxScore), 0) / rows.length)
              : null

            return (
              <div key={student.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Student header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="font-medium text-gray-900">
                    {student.lastName} {student.firstName}
                  </span>
                  {avg !== null && (
                    <span className={`text-sm font-medium ${pctColor(avg)}`}>
                      {t('assessments.avg')}: {avg}%
                    </span>
                  )}
                </div>

                {rows.length === 0 ? (
                  <p className="text-gray-400 text-sm px-4 py-3">{t('assessments.noEntries')}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-4 py-2 font-medium">{t('assessments.date')}</th>
                        <th className="px-4 py-2 font-medium">{t('assessments.title')}</th>
                        <th className="px-4 py-2 font-medium">{t('assessments.type')}</th>
                        <th className="px-4 py-2 font-medium">{t('assessments.subject')}</th>
                        <th className="px-4 py-2 font-medium">{t('assessments.score')}</th>
                        <th className="px-4 py-2 font-medium">{t('assessments.grade')}</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(a => {
                        const p = pct(a.score, a.maxScore)
                        const sub = subjects.find(s => s.id === a.subjectId)
                        return (
                          <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-600">{a.date}</td>
                            <td className="px-4 py-2 text-gray-900">{a.title}</td>
                            <td className="px-4 py-2">
                              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                {t(`assessments.types.${a.type}`)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-600">{sub?.name ?? '—'}</td>
                            <td className="px-4 py-2">
                              <span className={`font-medium ${pctColor(p)}`}>
                                {a.score}/{a.maxScore} ({p}%)
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {a.grade ? (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${GRADE_STYLE[a.grade]}`}>
                                  {a.grade}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => openEdit(a)}
                                className="text-indigo-600 hover:underline text-xs"
                              >
                                {t('assessments.edit')}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">
              {modal.editing ? t('assessments.editAssessment') : t('assessments.newAssessment')}
            </h2>

            <div className="space-y-3">
              {/* Student */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.student')}</label>
                <select
                  value={form.studentId}
                  onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                  className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm"
                >
                  <option value="">—</option>
                  {classStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.subject')}</label>
                <select
                  value={form.subjectId}
                  onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                  className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm"
                >
                  <option value="">—</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.titleField')}</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('assessments.titlePlaceholder')}
                  className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm"
                />
              </div>

              {/* Type + Date */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.type')}</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as AssessmentType }))}
                    className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm"
                  >
                    {(['quiz','test','exam','homework','other'] as AssessmentType[]).map(t2 => (
                      <option key={t2} value={t2}>{t(`assessments.types.${t2}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.date')}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm"
                  />
                </div>
              </div>

              {/* Score / MaxScore */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.score')}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.score}
                    onChange={e => setForm(f => ({ ...f, score: e.target.value }))}
                    className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.maxScore')}</label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxScore}
                    onChange={e => setForm(f => ({ ...f, maxScore: e.target.value }))}
                    className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.grade')}</label>
                  <select
                    value={form.grade}
                    onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                    className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm bg-white"
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('assessments.notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-5">
              <div>
                {modal.editing && (
                  <button
                    onClick={handleDelete}
                    className="text-red-600 text-sm hover:underline"
                  >
                    {t('assessments.delete')}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setModal({ open: false })}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('assessments.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.studentId || !form.subjectId || !form.title || form.score === ''}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                >
                  {modal.editing ? t('assessments.save') : t('assessments.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <BulkImportModal
          title={t('assessments.importTitle')}
          columnsHint={t('assessments.importColumnsHint')}
          columnMap={ASSESSMENT_COLUMN_MAP}
          previewColumns={ASSESSMENT_PREVIEW_COLUMNS}
          isRowUsable={row => !!(row.student && row.subject && row.title)}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
          templateFilename="assessments-template.xlsx"
          templateHeaders={['student', 'subject', 'title', 'type', 'score', 'maxScore', 'grade', 'date', 'notes']}
          templateExample={['Ana Berisha', 'Mathematics', 'Chapter 5 test', 'test', '85', '100', '4', '2026-09-15', '']}
        />
      )}
    </div>
  )
}
