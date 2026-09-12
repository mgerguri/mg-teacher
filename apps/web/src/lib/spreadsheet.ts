// Shared CSV/Excel parsing for bulk-import features. Goes through the
// `xlsx` package (already a dependency, used for report exports) so both
// real .xlsx files and .csv files share one properly-quoted parser instead
// of the hand-rolled, comma-splitting one this replaced — that one broke on
// any value containing a comma or a quoted newline.

export type ColumnMap<T extends string> = Record<string, T>

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export async function readSpreadsheetRows(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []

  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return rawRows.map(raw => {
    const row: Record<string, string> = {}
    for (const [header, value] of Object.entries(raw)) {
      row[normalizeHeader(header)] = String(value ?? '').trim()
    }
    return row
  })
}

export function mapSpreadsheetRows<T extends string>(
  rows: Record<string, string>[],
  columnMap: ColumnMap<T>
): Partial<Record<T, string>>[] {
  return rows.map(row => {
    const mapped: Partial<Record<T, string>> = {}
    for (const [header, value] of Object.entries(row)) {
      const field = columnMap[header]
      if (field) mapped[field] = value
    }
    return mapped
  })
}
