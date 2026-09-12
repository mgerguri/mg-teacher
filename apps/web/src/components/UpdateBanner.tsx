import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { checkForUpdate, getDownloadUrlForCurrentOs, UpdateCheckResult } from '../lib/update-check'

const DISMISSED_KEY = 'mg_teacher_update_dismissed_version'

export default function UpdateBanner() {
  const { t } = useTranslation()
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null)

  useEffect(() => {
    if (!('__TAURI__' in window)) return // only relevant for the installed desktop app

    let cancelled = false
    ;(async () => {
      const { getVersion } = await import('@tauri-apps/api/app')
      const currentVersion = await getVersion()
      const result = await checkForUpdate(currentVersion)
      if (cancelled || !result?.hasUpdate) return
      if (localStorage.getItem(DISMISSED_KEY) === result.latestVersion) return
      setUpdate(result)
    })()

    return () => { cancelled = true }
  }, [])

  if (!update) return null

  async function downloadUpdate() {
    const { open } = await import('@tauri-apps/api/shell')
    await open(getDownloadUrlForCurrentOs())
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, update!.latestVersion)
    setUpdate(null)
  }

  return (
    <div className="bg-blue-600 text-white text-sm px-4 py-2 flex items-center justify-center gap-3">
      <span>{t('update.available', { version: update.latestVersion })}</span>
      <button onClick={downloadUpdate} className="underline font-medium hover:no-underline">
        {t('update.download')}
      </button>
      <button onClick={dismiss} className="text-blue-100 hover:text-white leading-none" aria-label={t('update.dismiss')}>
        ×
      </button>
    </div>
  )
}
