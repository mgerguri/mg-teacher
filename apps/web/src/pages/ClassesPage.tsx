import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { localDb, LocalClass, LocalTeacher } from '../lib/local-db'
import { useSync } from '../context/SyncContext'
import { useAuth } from '../context/AuthContext'
import { scopeClasses } from '../lib/scope'
import ClassModal from '../components/students/ClassModal'
import BulkImportModal from '../components/common/BulkImportModal'
import { ColumnMap } from '../lib/spreadsheet'

type ClassImportField = 'name' | 'gradeLevel' | 'academicYear'

const CLASS_COLUMN_MAP: ColumnMap<ClassImportField> = {
  name: 'name',
  gradelevel: 'gradeLevel', grade_level: 'gradeLevel', grade: 'gradeLevel',
  academicyear: 'academicYear', academic_year: 'academicYear', year: 'academicYear',
}

const CLASS_PREVIEW_COLUMNS: { key: ClassImportField; label: string }[] = [
  { key: 'name', label: 'name' },
  { key: 'gradeLevel', label: 'gradeLevel' },
  { key: 'academicYear', label: 'academicYear' },
]

export default function ClassesPage() {
  const navigate  = useNavigate()
  const { sync }  = useSync()
  const { user }  = useAuth()
  const { t }     = useTranslation()
  const [classes, setClasses] = useState<LocalClass[]>([])
  const [teachers, setTeachers] = useState<LocalTeacher[]>([])
  const [counts,  setCounts]  = useState<Record<string, number>>({})
  const [modal,   setModal]   = useState<{ open: boolean; cls: LocalClass | null }>({ open: false, cls: null })
  const [showImport, setShowImport] = useState(false)

  const reload = useCallback(async () => {
    const [cls, tes] = await Promise.all([
      localDb.classes.filter(c => !c.deletedAt).toArray(),
      localDb.teachers.toArray(),
    ])
    setClasses(scopeClasses(cls, user))
    setTeachers(tes)
    const all = await localDb.students.filter(s => !s.deletedAt).toArray()
    const map: Record<string, number> = {}
    for (const s of all) if (s.classId) map[s.classId] = (map[s.classId] ?? 0) + 1
    setCounts(map)
  }, [user])

  useEffect(() => { reload() }, [reload])

  async function handleSave(data: { name: string; gradeLevel: string; academicYear: string; teacherId?: string }) {
    const now = new Date().toISOString()
    if (modal.cls) {
      await localDb.classes.update(modal.cls.id, { ...data, updatedAt: now, syncStatus: 'pending' })
    } else {
      await localDb.classes.add({
        id: globalThis.crypto.randomUUID(),
        ...data,
        updatedAt: now,
        syncStatus: 'pending',
      })
    }
    setModal({ open: false, cls: null })
    await reload()
    sync()
  }

  async function handleDelete() {
    if (!modal.cls) return
    const now = new Date().toISOString()
    await localDb.classes.update(modal.cls.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' })
    setModal({ open: false, cls: null })
    await reload()
    sync()
  }

  async function handleImport(rows: Partial<Record<ClassImportField, string>>[]) {
    const now = new Date().toISOString()
    await localDb.classes.bulkAdd(rows.map(r => ({
      id:           globalThis.crypto.randomUUID(),
      name:         r.name ?? '',
      gradeLevel:   r.gradeLevel ?? '',
      academicYear: r.academicYear ?? '',
      teacherId:    user?.id,
      updatedAt:    now,
      syncStatus:   'pending' as const,
    })))
    setShowImport(false)
    await reload()
    sync()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{t('classes.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg transition-colors"
          >
            {t('classes.importClasses')}
          </button>
          <button
            onClick={() => setModal({ open: true, cls: null })}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('classes.newClass')}
          </button>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">{t('classes.noClasses')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes.map(cls => {
            const count = counts[cls.id] ?? 0
            return (
              <div
                key={cls.id}
                onClick={() => navigate(`/classes/${cls.id}`)}
                className="bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{cls.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{cls.gradeLevel}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{cls.academicYear}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setModal({ open: true, cls }) }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    title={t('classes.editClass')}
                  >
                    ✎
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <span className="text-sm font-medium text-gray-700">{count}</span>
                  <span className="text-sm text-gray-400 ml-1">
                    {t('classes.student', { count })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && (
        <ClassModal
          cls={modal.cls}
          teachers={teachers}
          isAdmin={user?.role === 'admin'}
          currentUserId={user?.id ?? ''}
          onSave={handleSave}
          onDelete={modal.cls ? handleDelete : undefined}
          onClose={() => setModal({ open: false, cls: null })}
        />
      )}

      {showImport && (
        <BulkImportModal
          title={t('classes.importTitle')}
          columnsHint={t('classes.importColumnsHint')}
          columnMap={CLASS_COLUMN_MAP}
          previewColumns={CLASS_PREVIEW_COLUMNS}
          isRowUsable={row => !!row.name}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
          templateFilename="classes-template.xlsx"
          templateHeaders={['name', 'gradeLevel', 'academicYear']}
          templateExample={['10A', 'Grade 10', '2026-2027']}
        />
      )}
    </div>
  )
}
