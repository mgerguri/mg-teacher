import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { localDb, LocalSubject, LocalTeacher } from '../lib/local-db'
import { useSync } from '../context/SyncContext'
import SubjectModal, { SubjectFormState } from '../components/subjects/SubjectModal'
import BulkImportModal from '../components/common/BulkImportModal'
import { ColumnMap } from '../lib/spreadsheet'

type SubjectImportField = 'name' | 'code' | 'description' | 'teacher'

const SUBJECT_COLUMN_MAP: ColumnMap<SubjectImportField> = {
  name: 'name',
  code: 'code',
  description: 'description',
  teacher: 'teacher', teacheremail: 'teacher', teacher_email: 'teacher',
}

const SUBJECT_PREVIEW_COLUMNS: { key: SubjectImportField; label: string }[] = [
  { key: 'name', label: 'name' },
  { key: 'code', label: 'code' },
  { key: 'teacher', label: 'teacher' },
  { key: 'description', label: 'description' },
]

export default function SubjectsPage() {
  const { sync } = useSync()
  const { t }    = useTranslation()

  const [subjects,  setSubjects]  = useState<LocalSubject[]>([])
  const [teachers,  setTeachers]  = useState<LocalTeacher[]>([])
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState<{ open: boolean; subject: LocalSubject | null }>({ open: false, subject: null })
  const [showImport, setShowImport] = useState(false)

  const reload = useCallback(async () => {
    const [subs, tes] = await Promise.all([
      localDb.subjects.filter(s => !s.deletedAt).toArray(),
      localDb.teachers.toArray(),
    ])
    setSubjects(subs.sort((a, b) => a.name.localeCompare(b.name)))
    setTeachers(tes.sort((a, b) => a.lastName.localeCompare(b.lastName)))
  }, [])

  useEffect(() => { reload() }, [reload])

  const teacherMap = new Map(teachers.map(t => [t.id, t]))

  const filtered = subjects.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave(data: SubjectFormState) {
    const now = new Date().toISOString()
    if (modal.subject) {
      await localDb.subjects.update(modal.subject.id, {
        ...data,
        teacherId:  data.teacherId || undefined,
        updatedAt:  now,
        syncStatus: 'pending',
      })
    } else {
      await localDb.subjects.add({
        id:          globalThis.crypto.randomUUID(),
        name:        data.name,
        code:        data.code,
        description: data.description || undefined,
        teacherId:   data.teacherId || undefined,
        updatedAt:   now,
        syncStatus:  'pending',
      })
    }
    setModal({ open: false, subject: null })
    await reload()
    sync()
  }

  async function handleDelete() {
    if (!modal.subject) return
    const now = new Date().toISOString()
    await localDb.subjects.update(modal.subject.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
    setModal({ open: false, subject: null })
    await reload()
    sync()
  }

  async function handleImport(rows: Partial<Record<SubjectImportField, string>>[]) {
    const now = new Date().toISOString()
    const teacherByEmail = new Map(teachers.map(te => [te.email.toLowerCase(), te]))
    await localDb.subjects.bulkAdd(rows.map(r => ({
      id:          globalThis.crypto.randomUUID(),
      name:        r.name ?? '',
      code:        r.code ?? '',
      description: r.description || undefined,
      teacherId:   r.teacher ? teacherByEmail.get(r.teacher.toLowerCase())?.id : undefined,
      updatedAt:   now,
      syncStatus:  'pending' as const,
    })))
    setShowImport(false)
    await reload()
    sync()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-900 flex-1">{t('subjects.title')}</h1>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('subjects.searchPlaceholder')}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        />
        <button
          onClick={() => setShowImport(true)}
          className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg transition-colors"
        >
          {t('subjects.importSubjects')}
        </button>
        <button
          onClick={() => setModal({ open: true, subject: null })}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {t('subjects.newSubject')}
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">
          {search ? t('subjects.noResults') : t('subjects.noSubjects')}
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">{t('subjects.colName')}</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">{t('subjects.colCode')}</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">{t('subjects.colTeacher')}</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">{t('subjects.colDescription')}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub, i) => {
                const teacher = sub.teacherId ? teacherMap.get(sub.teacherId) : undefined
                return (
                  <tr key={sub.id} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-5 py-3 font-medium text-gray-900">{sub.name}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{sub.code || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {teacher ? `${teacher.firstName} ${teacher.lastName}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{sub.description || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setModal({ open: true, subject: sub })}
                        className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        {t('subjects.edit')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <SubjectModal
          subject={modal.subject}
          teachers={teachers}
          onSave={handleSave}
          onDelete={modal.subject ? handleDelete : undefined}
          onClose={() => setModal({ open: false, subject: null })}
        />
      )}

      {showImport && (
        <BulkImportModal
          title={t('subjects.importTitle')}
          columnsHint={t('subjects.importColumnsHint')}
          columnMap={SUBJECT_COLUMN_MAP}
          previewColumns={SUBJECT_PREVIEW_COLUMNS}
          isRowUsable={row => !!row.name}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
