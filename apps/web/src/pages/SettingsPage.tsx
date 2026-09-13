import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { exportBackup, restoreBackup, BackupRestoreError } from '../lib/backup'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { sync } = useSync()

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreDone, setRestoreDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (user?.role !== 'admin') {
    return <div className="p-6 text-sm text-gray-400">{t('settings.adminOnly')}</div>
  }

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      await exportBackup()
    } catch {
      setExportError(t('settings.backup.exportError'))
    } finally {
      setExporting(false)
    }
  }

  function handlePickFile(file: File) {
    setRestoreFile(file)
    setRestoreError(null)
    setRestoreDone(false)
    setConfirming(false)
  }

  async function handleRestore() {
    if (!restoreFile) return
    setRestoring(true)
    setRestoreError(null)
    try {
      await restoreBackup(restoreFile)
      // Every restored record is marked pending (see backup.ts) so this
      // pushes the whole restored dataset back up to the server, rather than
      // leaving it stuck local-only until the next scheduled sync.
      await sync()
      setRestoreDone(true)
      setRestoreFile(null)
      setConfirming(false)
      // Every page holds data loaded into React state before the restore, so
      // a full reload is the simplest way to make the whole app reflect it.
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      const reason = err instanceof BackupRestoreError ? err.reason : 'parse'
      setRestoreError(
        reason === 'version' ? t('settings.backup.restoreVersionError') : t('settings.backup.restoreError')
      )
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">{t('settings.title')}</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">{t('settings.backup.title')}</h2>
        <p className="text-xs text-gray-400 mb-4">{t('settings.backup.subtitle')}</p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="self-start px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {exporting ? t('settings.backup.exporting') : t('settings.backup.exportButton')}
          </button>
          {exportError && <p className="text-sm text-red-600">{exportError}</p>}
        </div>

        <div className="border-t border-gray-100 mt-6 pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-1">{t('settings.backup.restoreTitle')}</h3>
          <p className="text-xs text-gray-400 mb-4">{t('settings.backup.restoreSubtitle')}</p>

          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePickFile(f) }}
          />

          {!restoreFile ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 text-sm border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors"
            >
              {t('settings.backup.chooseFile')}
            </button>
          ) : !confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">📄 {restoreFile.name}</span>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                {t('settings.backup.restoreButton')}
              </button>
              <button
                type="button"
                onClick={() => setRestoreFile(null)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('settings.backup.cancel')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-red-600">{t('settings.backup.restoreConfirm')}</span>
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {restoring ? t('settings.backup.restoring') : t('settings.backup.confirmYes')}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={restoring}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('settings.backup.confirmNo')}
              </button>
            </div>
          )}

          {restoreError && <p className="text-sm text-red-600 mt-3">{restoreError}</p>}
          {restoreDone && <p className="text-sm text-green-600 mt-3">{t('settings.backup.restoreSuccess')}</p>}
        </div>
      </div>
    </div>
  )
}
