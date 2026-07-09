/**
 * Client-side report export helpers.
 * Lazy-import heavy libraries so the main bundle stays lean.
 */

export interface StudentExportRow {
  name:       string
  avgGrade:   string
  absent:     number
  excused:    number
  totalMissed: number
}

export interface SubjectExportRow {
  subject:    string
  avgGrade:   string
  gradesRecorded: number
}

export interface ReportExportData {
  className:   string
  term:        string
  generatedAt: string
  students:    StudentExportRow[]
  subjects:    SubjectExportRow[]
}

// ── Excel ──────────────────────────────────────────────────────────────────────

export async function exportToExcel(data: ReportExportData) {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Student overview ──
  const studentHeader = ['Student', 'Avg Grade', 'Absent', 'Excused', 'Total Missed']
  const studentRows   = data.students.map(r => [
    r.name, r.avgGrade, r.absent, r.excused, r.totalMissed,
  ])
  const ws1 = XLSX.utils.aoa_to_sheet([studentHeader, ...studentRows])

  // Column widths
  ws1['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }]

  XLSX.utils.book_append_sheet(wb, ws1, 'Students')

  // ── Sheet 2: Subject averages ──
  const subjectHeader = ['Subject', 'Class Avg Grade', 'Grades Recorded']
  const subjectRows   = data.subjects.map(r => [r.subject, r.avgGrade, r.gradesRecorded])
  const ws2 = XLSX.utils.aoa_to_sheet([subjectHeader, ...subjectRows])
  ws2['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Subjects')

  // ── Sheet 3: Info ──
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Report'],
    ['Class',        data.className],
    ['Term',         data.term],
    ['Generated at', data.generatedAt],
  ])
  ws3['!cols'] = [{ wch: 16 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Info')

  const filename = `report_${data.className}_${data.term}.xlsx`
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]/g, '')

  XLSX.writeFile(wb, filename)
}

// ── PDF ────────────────────────────────────────────────────────────────────────

export async function exportToPDF(data: ReportExportData) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const MARGIN  = 14
  const PAGE_W  = doc.internal.pageSize.getWidth()

  // ── Header ──
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Class Report', MARGIN, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`${data.className}  ·  ${data.term}`, MARGIN, 28)
  doc.text(`Generated ${data.generatedAt}`, PAGE_W - MARGIN, 28, { align: 'right' })

  doc.setTextColor(0)
  doc.setDrawColor(220)
  doc.line(MARGIN, 32, PAGE_W - MARGIN, 32)

  // ── Student table ──
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Student Overview', MARGIN, 40)

  autoTable(doc, {
    startY: 43,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Student', 'Avg Grade', 'Absent', 'Excused', 'Total Missed']],
    body: data.students.map(r => [r.name, r.avgGrade, r.absent, r.excused, r.totalMissed]),
    headStyles: {
      fillColor:  [30, 30, 30],
      textColor:  255,
      fontStyle:  'bold',
      fontSize:   9,
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 28, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    didParseCell(hookData) {
      // Color-code avg grade column
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const val = parseFloat(hookData.cell.raw as string)
        if (!isNaN(val)) {
          if (val < 2)        hookData.cell.styles.textColor = [185, 28, 28]
          else if (val < 3)   hookData.cell.styles.textColor = [194, 65, 12]
          else if (val < 4)   hookData.cell.styles.textColor = [133, 77, 14]
          else if (val < 4.5) hookData.cell.styles.textColor = [21, 128, 61]
          else                hookData.cell.styles.textColor = [4, 120, 87]
        }
      }
      // Color-code total missed
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const val = Number(hookData.cell.raw)
        if (val >= 5) hookData.cell.styles.textColor = [194, 65, 12]
      }
    },
  })

  // ── Subject breakdown ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterStudents = (doc as any).lastAutoTable?.finalY ?? 43
  const subjectY      = afterStudents + 12

  // New page if not enough room
  const PAGE_H = doc.internal.pageSize.getHeight()
  const startY = subjectY + 43 > PAGE_H ? (doc.addPage(), 14) : subjectY

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Subject Averages', MARGIN, startY)

  autoTable(doc, {
    startY: startY + 3,
    margin: { left: MARGIN, right: MARGIN },
    head:   [['Subject', 'Class Avg Grade', 'Grades Recorded']],
    body:   data.subjects.map(r => [r.subject, r.avgGrade, r.gradesRecorded]),
    headStyles: {
      fillColor: [30, 30, 30],
      textColor:  255,
      fontStyle:  'bold',
      fontSize:   9,
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 40, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  })

  // ── Page numbers ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
  }

  const filename = `report_${data.className}_${data.term}.pdf`
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]/g, '')

  doc.save(filename)
}
