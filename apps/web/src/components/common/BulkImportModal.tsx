import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ColumnMap, mapSpreadsheetRows, readSpreadsheetRows } from '../../lib/spreadsheet'

interface Props<T extends string> {
  title:          string
  columnsHint:    string
  columnMap:      ColumnMap<T>
  previewColumns: { key: T; label: string }[]
  isRowUsable:    (row: Partial<Record<T, string>>) => boolean
  onImport:       (rows: Partial<Record<T, string>>[]) => void
  onClose:        () => void
}

export default function BulkImportModal<T extends string>({
  title, columnsHint, columnMap, previewColumns, isRowUsable, onImport, onClose,
}: Props<T>) {
  const { t } = useTranslation()
  const [preview,  setPreview]  = useState<Partial<Record<T, string>>[] | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    setError(null)
    try {
      const rows = await readSpreadsheetRows(file)
      const mapped = mapSpreadsheetRows(rows, columnMap).filter(isRowUsable)
      if (mapped.length === 0) {
        setError(t('bulkImport.noValidRows'))
        setPreview(null)
      } else {
        setPreview(mapped)
      }
    } catch {
      setError(t('bulkImport.parseError'))
      setPreview(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{columnsHint}</p>
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
              {fileName ? `📄 ${fileName}` : t('bulkImport.dropzone')}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {preview && (
            <div>
              <p className="text-sm text-gray-500 mb-2">
                {t('bulkImport.rowsFound', { count: preview.length })}
              </p>
              <div className="max-h-72 overflow-y-auto overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-400 w-10">#</th>
                      {previewColumns.map(col => (
                        <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-500">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        {previewColumns.map(col => (
                          <td key={col.key} className="px-3 py-2 text-gray-700">{row[col.key] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <div className="flex-1" />
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            {t('bulkImport.cancel')}
          </button>
          <button
            disabled={!preview || preview.length === 0}
            onClick={() => preview && onImport(preview)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {t('bulkImport.import', { count: preview?.length ?? 0 })}
          </button>
        </div>
      </div>
    </div>
  )
}
