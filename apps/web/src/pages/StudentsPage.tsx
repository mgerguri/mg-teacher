import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { localDb, LocalStudent, LocalClass } from '../lib/local-db'
import { useSync } from '../context/SyncContext'
import StudentModal, { StudentFormState } from '../components/students/StudentModal'
import CsvImportModal from '../components/students/CsvImportModal'

export default function StudentsPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate    = useNavigate()
  const { sync }    = useSync()
  const { t }       = useTranslation()

  const [cls,       setCls]       = useState<LocalClass | null>(null)
  const [classes,   setClasses]   = useState<LocalClass[]>([])
  const [students,  setStudents]  = useState<LocalStudent[]>([])
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState<{ open: boolean; student: LocalStudent | null }>({ open: false, student: null })
  const [showImport, setShowImport] = useState(false)

  const reload = useCallback(async () => {
    const [allClasses, allStudents] = await Promise.all([
      localDb.classes.filter(c => !c.deletedAt).toArray(),
      localDb.students.filter(s => !s.deletedAt && s.classId === classId).toArray(),
    ])
    const current = allClasses.find(c => c.id === classId) ?? null
    setCls(current)
    setClasses(allClasses)
    setStudents(allStudents.sort((a, b) => a.lastName.localeCompare(b.lastName)))
  }, [classId])

  useEffect(() => { reload() }, [reload])

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    return !q
      || s.firstName.toLowerCase().includes(q)
      || s.lastName.toLowerCase().includes(q)
      || (s.email ?? '').toLowerCase().includes(q)
  })

  async function handleSave(data: StudentFormState) {
    const now = new Date().toISOString()
    if (modal.student) {
      await localDb.students.update(modal.student.id, { ...data, updatedAt: now, syncStatus: 'pending' })
    } else {
      await localDb.students.add({
        id:         globalThis.crypto.randomUUID(),
        enrolledAt: now,
        updatedAt:  now,
        syncStatus: 'pending',
        ...data,
        classId:    classId ?? data.classId,
      })
    }
    setModal({ open: false, student: null })
    await reload()
    sync()
  }

  async function handleDelete() {
    if (!modal.student) return
    const now = new Date().toISOString()
    await localDb.students.update(modal.student.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
    setModal({ open: false, student: null })
    await reload()
    sync()
  }

  async function handleImport(rows: StudentFormState[]) {
    const now = new Date().toISOString()
    await localDb.students.bulkAdd(rows.map(r => ({
      id:         globalThis.crypto.randomUUID(),
      enrolledAt: now,
      updatedAt:  now,
      syncStatus: 'pending' as const,
      ...r,
      classId:    classId ?? r.classId,
    })))
    setShowImport(false)
    await reload()
    sync()
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/classes" className="hover:text-gray-600">{t('common.breadcrumbClasses')}</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{cls?.name ?? '…'}</span>
        {cls && <span className="text-gray-400">· {cls.gradeLevel} · {cls.academicYear}</span>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="search"
          placeholder={t('students.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <span className="text-sm text-gray-400">
          {filtered.length} {t('students.student', { count: filtered.length })}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setShowImport(true)}
          className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg transition-colors"
        >
          {t('students.importCsv')}
        </button>
        <button
          onClick={() => setModal({ open: true, student: null })}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {t('students.addStudent')}
        </button>
      </div>

      {/* Student table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          {search ? t('students.noStudentsSearch') : t('students.noStudents')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('students.colName')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">{t('students.colEmail')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">{t('students.colDob')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden lg:table-cell">{t('students.colParent')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-t border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${i === 0 ? 'border-t-0' : ''}`}
                  onClick={() => navigate(`/students/${s.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.lastName}, {s.firstName}
                    {s.syncStatus === 'pending' && (
                      <span className="ml-2 text-xs text-amber-400">●</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{s.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{s.dateOfBirth || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{s.parentName || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); setModal({ open: true, student: s }) }}
                      className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
                      title={t('studentModal.editStudent')}
                    >
                      ✎
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <StudentModal
          student={modal.student}
          classes={classes}
          defaultClassId={classId}
          onSave={handleSave}
          onDelete={modal.student ? handleDelete : undefined}
          onClose={() => setModal({ open: false, student: null })}
        />
      )}

      {showImport && (
        <CsvImportModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
