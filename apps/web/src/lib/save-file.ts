// Persists generated file bytes to disk. Clicking a blob-URL <a download>
// link — what XLSX.writeFile / jsPDF's doc.save / docx all do internally —
// only works in an actual browser with a download manager to catch it.
// Tauri's embedded webview has none, so those calls silently do nothing.
// Inside the desktop app this goes through Tauri's own save-dialog + fs
// write APIs instead; falls back to the browser download for `pnpm dev:web`
// (no Tauri runtime present there).

export async function saveFile(filename: string, data: ArrayBuffer | Uint8Array): Promise<void> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)

  if ('__TAURI__' in window) {
    const { save } = await import('@tauri-apps/api/dialog')
    const { writeBinaryFile } = await import('@tauri-apps/api/fs')
    const { downloadDir, join } = await import('@tauri-apps/api/path')
    const defaultPath = await join(await downloadDir(), filename)
    const path = await save({ defaultPath })
    if (!path) return // user cancelled the save dialog
    await writeBinaryFile(path, bytes)
    return
  }

  const blob = new Blob([bytes.buffer as ArrayBuffer])
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
