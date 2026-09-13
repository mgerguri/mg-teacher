import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalStudent, LocalSubject, LocalGrade } from '../../lib/local-db'
import { useAuth } from '../../context/AuthContext'

const SCORES = [1, 2, 3, 4, 5] as const

// Score → colour
const SCORE_STYLE: Record<number, string> = {
  1: 'bg-red-100 text-red-700 hover:bg-red-200',
  2: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  3: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
  4: 'bg-green-100 text-green-700 hover:bg-green-200',
  5: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
}
const EMPTY_STYLE = 'text-gray-300 hover:bg-gray-50'

// Suggested-but-not-yet-confirmed grade (e.g. the computed year average) —
// a lighter, dashed-border variant of SCORE_STYLE so it reads as a hint
// rather than a saved fact.
const SUGGESTED_STYLE: Record<number, string> = {
  1: 'border-2 border-dashed border-red-300 text-red-500 bg-red-50',
  2: 'border-2 border-dashed border-orange-300 text-orange-500 bg-orange-50',
  3: 'border-2 border-dashed border-yellow-300 text-yellow-600 bg-yellow-50',
  4: 'border-2 border-dashed border-green-300 text-green-600 bg-green-50',
  5: 'border-2 border-dashed border-emerald-300 text-emerald-600 bg-emerald-50',
}

interface Props {
  students: LocalStudent[]
  subjects: LocalSubject[]
  grades:   Map<string, LocalGrade>  // key: `${studentId}:${subjectId}`
  suggestions?: Map<string, 1|2|3|4|5>  // same key — computed defaults, not yet saved
  onGradeChange: (studentId: string, subjectId: string, score: 1|2|3|4|5) => void
}

function gradeKey(studentId: string, subjectId: string) {
  return `${studentId}:${subjectId}`
}

export default function GradesGrid({ students, subjects, grades, suggestions, onGradeChange }: Props) {
  const { user } = useAuth()
  const { t }    = useTranslation()
  const [openCell, setOpenCell] = useState<string | null>(null)

  if (students.length === 0 || subjects.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-gray-400">
        {students.length === 0
          ? t('grades.noStudents')
          : t('grades.noSubjects')}
      </div>
    )
  }

  function canEdit(subject: LocalSubject) {
    if (!user) return false
    // A subject with no teacher assigned isn't "someone else's" — it's
    // unowned, so any teacher can grade it. Only an explicit assignment to
    // a different teacher should lock it out for non-admins.
    return user.role === 'admin' || !subject.teacherId || subject.teacherId === user.id
  }

  function handleCellClick(key: string, subject: LocalSubject) {
    if (!canEdit(subject)) return
    setOpenCell(prev => prev === key ? null : key)
  }

  function handleScore(studentId: string, subjectId: string, score: 1|2|3|4|5) {
    onGradeChange(studentId, subjectId, score)
    setOpenCell(null)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[160px]">
              Student
            </th>
            {subjects.map(sub => (
              <th key={sub.id} className="px-3 py-3 text-center font-medium text-gray-500 min-w-[100px]">
                <div>{sub.name}</div>
                {sub.code && <div className="text-xs text-gray-400 font-normal">{sub.code}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student, i) => (
            <tr key={student.id} className={`border-t border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
              <td className={`px-4 py-3 font-medium text-gray-800 sticky left-0 z-10 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                {student.lastName}, {student.firstName}
              </td>
              {subjects.map(subject => {
                const key   = gradeKey(student.id, subject.id)
                const grade = grades.get(key)
                const score = grade?.deletedAt ? undefined : grade?.score
                const suggestion   = suggestions?.get(key)
                const isSuggested  = score === undefined && suggestion !== undefined
                const displayScore = score ?? suggestion
                const editable = canEdit(subject)
                const isOpen   = openCell === key

                return (
                  <td key={subject.id} className="px-3 py-2 text-center relative">
                    <button
                      onClick={() => handleCellClick(key, subject)}
                      disabled={!editable}
                      title={editable ? (isSuggested ? t('grades.suggestedHint') : t('grades.clickToSet')) : t('grades.teacherOnly')}
                      className={`
                        w-10 h-10 rounded-lg font-semibold text-sm transition-colors
                        ${score ? SCORE_STYLE[score] : isSuggested ? SUGGESTED_STYLE[suggestion] : EMPTY_STYLE}
                        ${editable ? 'cursor-pointer' : 'cursor-default'}
                        ${grade?.syncStatus === 'pending' ? 'ring-2 ring-amber-300' : ''}
                      `}
                    >
                      {displayScore ?? '—'}
                    </button>

                    {/* Score picker popover */}
                    {isOpen && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => setOpenCell(null)}
                        />
                        <div className="absolute z-30 top-full mt-1 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-gray-100 p-2 flex gap-1">
                          {SCORES.map(s => (
                            <button
                              key={s}
                              onClick={() => handleScore(student.id, subject.id, s)}
                              className={`
                                w-9 h-9 rounded-lg font-semibold text-sm transition-colors
                                ${SCORE_STYLE[s]}
                                ${isSuggested && s === suggestion ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}
                              `}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
