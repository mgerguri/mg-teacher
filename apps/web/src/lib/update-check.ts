// Lightweight update nudge: no signing/release infra, just compares the
// running app's version against whatever is committed on desktop-main
// (that's the version the CI build in .github/workflows/build-desktop.yml
// just built). Good enough until this ships to more than a handful of
// people — see the full Tauri updater plugin if that changes.

const CONFIG_URL =
  'https://raw.githubusercontent.com/mgerguri/mg-teacher/desktop-main/apps/desktop/src-tauri/tauri.conf.json'

// The `release` job in build-desktop.yml publishes each build to a GitHub
// Release under these exact filenames, so `releases/latest/download/<name>`
// always resolves to the newest installer — no login required, unlike
// workflow-run artifacts.
export const MACOS_DOWNLOAD_URL =
  'https://github.com/mgerguri/mg-teacher/releases/latest/download/MG-Teacher-macOS.dmg'
export const WINDOWS_DOWNLOAD_URL =
  'https://github.com/mgerguri/mg-teacher/releases/latest/download/MG-Teacher-Windows-Setup.exe'

export function getDownloadUrlForCurrentOs(): string {
  const isMac = /Mac/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent)
  return isMac ? MACOS_DOWNLOAD_URL : WINDOWS_DOWNLOAD_URL
}

// The release job tags each GitHub Release `desktop-v<version>` and fills
// its body from that version's CHANGELOG.md section, so this always points
// at real release notes for the version being offered.
export function getReleaseNotesUrl(version: string): string {
  return `https://github.com/mgerguri/mg-teacher/releases/tag/desktop-v${version}`
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
}

function isNewer(latest: string, current: string): boolean {
  const parts = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0)
  const [lMaj, lMin, lPatch] = parts(latest)
  const [cMaj, cMin, cPatch] = parts(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPatch > cPatch
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateCheckResult | null> {
  try {
    const res = await fetch(CONFIG_URL, { cache: 'no-store' })
    if (!res.ok) return null
    const conf = await res.json()
    const latestVersion: string | undefined = conf?.package?.version
    if (!latestVersion) return null
    return { currentVersion, latestVersion, hasUpdate: isNewer(latestVersion, currentVersion) }
  } catch {
    return null
  }
}
