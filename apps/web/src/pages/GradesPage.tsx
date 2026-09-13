import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { localDb, LocalClass, LocalStudent, LocalSubject, LocalGrade } from '../lib/local-db'
import { useSync } from '../context/SyncContext'
import { useAuth } from '../context/AuthContext'
import GradesGrid from '../components/grades/GradesGrid'

const SEMESTER_1 = 'Semester 1'
const SEMESTER_2 = 'Semester 2'
const FINAL_YEAR = 'Final Year'

const TERM_OPTIONS = [SEMESTER_1, SEMESTER_2, FINAL_YEAR]

function gradeKey(studentId: string, subjectId: string) {
  return `${studentId}:${subjectId}`
}

export default function GradesPage() {
  const { sync }  = useSync()
  const { user }  = useAuth()
  const { t }     = useTranslation()

  const [classes,   setClasses]   = useState<LocalClass[]>([])
  const [students,  setStudents]  = useState<LocalStudent[]>([])
  const [subjects,  setSubjects]  = useState<LocalSubject[]>([]) // those scheduled for selected class
  const [gradesMap, setGradesMap] = useState<Map<string, LocalGrade>>(new Map())
  const [suggestions, setSuggestions] = useState<Map<string, 1|2|3|4|5>>(new Map())

  const [classId,    setClassId]    = useState<string>('')
  const [term,       setTerm]       = useState<string>(SEMESTER_1)
  const [customTerm, setCustomTerm] = useState<string>('')
  const [useCustom,  setUseCustom]  = useState<boolean>(false)

  const activeTerm = useCustom ? customTerm.trim() : term

  // Load classes on mount
  useEffect(() => {
    localDb.classes.filter(c => !c.deletedAt).toArray().then(all => {
      const sorted = all.sort((a, b) => a.name.localeCompare(b.name))
      setClasses(sorted)
      if (sorted.length > 0 && !classId) setClassId(sorted[0].id)
    })
  }, [])

  // Reload students, subjects, and grades when class or term changes
  const reload = useCallback(async () => {
    if (!classId || !activeTerm) return

    const isFinalYear = activeTerm === FINAL_YEAR

    const [allStudents, allSchedules, allSubjects, allGrades, semesterGrades] = await Promise.all([
      localDb.students.filter(s => !s.deletedAt && s.classId === classId).toArray(),
      localDb.schedules.filter(s => !s.deletedAt && s.classId === classId).toArray(),
      localDb.subjects.filter(s => !s.deletedAt).toArray(),
      localDb.grades.filter(g => !g.deletedAt && g.classId === classId && g.term === activeTerm).toArray(),
      isFinalYear
        ? localDb.grades.filter(g => !g.deletedAt && g.classId === classId && (g.term === SEMESTER_1 || g.term === SEMESTER_2)).toArray()
        : Promise.resolve([] as LocalGrade[]),
    ])

    // Only subjects that are actually scheduled for this class
    const scheduledSubjectIds = new Set(allSchedules.map(s => s.subjectId))
    const classSubjects = allSubjects
      .filter(s => scheduledSubjectIds.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name))

    const sorted = allStudents.sort((a, b) => a.lastName.localeCompare(b.lastName))

    const map = new Map<string, LocalGrade>()
    for (const g of allGrades) {
      map.set(gradeKey(g.studentId, g.subjectId), g)
    }

    // Final Year suggestions: average of both semester grades, only when
    // both are present — a single semester's grade isn't a fair stand-in
    // for the other half of the year.
    const suggestionMap = new Map<string, 1|2|3|4|5>()
    if (isFinalYear) {
      const bySemester = new Map<string, { s1?: number; s2?: number }>()
      for (const g of semesterGrades) {
        const key = gradeKey(g.studentId, g.subjectId)
        const entry = bySemester.get(key) ?? {}
        if (g.term === SEMESTER_1) entry.s1 = g.score
        if (g.term === SEMESTER_2) entry.s2 = g.score
        bySemester.set(key, entry)
      }
      for (const [key, { s1, s2 }] of bySemester) {
        if (s1 !== undefined && s2 !== undefined) {
          suggestionMap.set(key, Math.round((s1 + s2) / 2) as 1|2|3|4|5)
        }
      }
    }

    setStudents(sorted)
    setSubjects(classSubjects)
    setGradesMap(map)
    setSuggestions(suggestionMap)
  }, [classId, activeTerm])

  useEffect(() => { reload() }, [reload])

  async function handleGradeChange(studentId: string, subjectId: string, score: 1|2|3|4|5) {
    if (!user || !classId || !activeTerm) return

    const key      = gradeKey(studentId, subjectId)
    const existing = gradesMap.get(key)
    const now      = new Date().toISOString()

    if (existing) {
      await localDb.grades.update(existing.id, { score, updatedAt: now, syncStatus: 'pending' })
    } else {
      await localDb.grades.add({
        id:         globalThis.crypto.randomUUID(),
        studentId,
        subjectId,
        classId,
        term:       activeTerm,
        score,
        teacherId:  user.id,
        updatedAt:  now,
        syncStatus: 'pending',
      })
    }

    await reload()
    sync()
  }

  const selectedClass = classes.find(c => c.id === classId)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{t('grades.title')}</h1>
        <p className="text-sm text-gray-500">{t('grades.subtitle')}</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        {/* Class selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('grades.class')}</label>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.gradeLevel} · {c.academicYear}
              </option>
            ))}
          </select>
        </div>

        {/* Term selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('grades.term')}</label>
          {useCustom ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder={t('grades.customTermPlaceholder')}
                value={customTerm}
                onChange={e => setCustomTerm(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              />
              <button
                onClick={() => { setUseCustom(false); setCustomTerm('') }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {t('grades.backToPresets')}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <select
                value={term}
                onChange={e => setTerm(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={() => setUseCustom(true)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {t('grades.customTerm')}
              </button>
            </div>
          )}
        </div>

        {selectedClass && activeTerm && (
          <div className="text-sm text-gray-400 pb-2">
            {selectedClass.name} · {activeTerm} · {students.length} {t('grades.student', { count: students.length })}
          </div>
        )}
      </div>

      {/* Grid */}
      {classId && activeTerm ? (
        <GradesGrid
          students={students}
          subjects={subjects}
          grades={gradesMap}
          suggestions={suggestions}
          onGradeChange={handleGradeChange}
        />
      ) : (
        <div className="text-center py-16 text-sm text-gray-400">{t('grades.selectPrompt')}</div>
      )}
    </div>
  )
}
