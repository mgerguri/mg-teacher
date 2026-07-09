import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StudentFormState } from './StudentModal'

const COLUMN_MAP: Record<string, keyof StudentFormState> = {
  firstname:   'firstName',
  first_name:  'firstName',
  lastname:    'lastName',
  last_name:   'lastName',
  email:       'email',
  dateofbirth: 'dateOfBirth',
  dob:         'dateOfBirth',
  date_of_birth: 'dateOfBirth',
  phone:       'phone',
  parentname:  'parentName',
  parent_name: 'parentName',
  parentphone: 'parentPhone',
  parent_phone: 'parentPhone',
  parentemail: 'parentEmail',
  parent_email: 'parentEmail',
  address:     'address',
  notes:       'notes',
}

function parseCsv(text: string): StudentFormState[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers   = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''))
  const colKeys   = headers.map(h => COLUMN_MAP[h] ?? null)

  return lines.slice(1).map(line => {
    const vals = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: StudentFormState = {
      firstName: '', lastName: '', email: '', dateOfBirth: '',
      phone: '', parentName: '', parentPhone: '', parentEmail: '',
      address: '', notes: '', classId: '',
    }
    colKeys.forEach((key, i) => {
      if (key) row[key] = vals[i] ?? ''
    })
    return row
  }).filter(r => r.firstName || r.lastName)
}

interface Props {
  onImport: (students: StudentFormState[]) => void
  onClose:  () => void
}

export default function CsvImportModal({ onImport, onClose }: Props) {
  const { t }  = useTranslation()
  const [preview,  setPreview]  = useState<StudentFormState[] | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setFileName(file.name)
    setError(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCsv(text)
      if (rows.length === 0) {
        setError(t('csvImport.noValidRows'))
        setPreview(null)
      } else {
        setPreview(rows)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('csvImport.title')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('csvImport.columnsHint')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
          >
            <p className="text-sm text-gray-500">
              {fileName ? `📄 ${fileName}` : t('csvImport.dropzone')}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {preview && (
            <div>
              <p className="text-sm text-gray-500 mb-2">
                {t('csvImport.studentsFound', { count: preview.length })}
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {(['firstName', 'lastName', 'email', 'dateOfBirth', 'phone'] as const).map(k => (
                        <th key={k} className="px-3 py-2 text-left font-medium text-gray-500">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{row.firstName}</td>
                        <td className="px-3 py-2 text-gray-700">{row.lastName}</td>
                        <td className="px-3 py-2 text-gray-500">{row.email}</td>
                        <td className="px-3 py-2 text-gray-500">{row.dateOfBirth}</td>
                        <td className="px-3 py-2 text-gray-500">{row.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 5 && (
                <p className="text-xs text-gray-400 mt-1">{t('csvImport.andMore', { count: preview.length - 5 })}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <div className="flex-1" />
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            {t('csvImport.cancel')}
          </button>
          <button
            disabled={!preview || preview.length === 0}
            onClick={() => preview && onImport(preview)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {preview ? t('csvImport.import', { count: preview.length }) : t('csvImport.import', { count: 0 })}
          </button>
        </div>
      </div>
    </div>
  )
}
