/**
 * Client-side export helpers for Weekly Plan.
 * Both libraries are lazy-imported to keep the main bundle small.
 */

export interface PlanSlot {
  time:       string
  subject:    string
  topic:      string
  objectives: string
  activities: string
  homework:   string
}

export interface PlanDay {
  date:  string   // formatted, e.g. "Mon 23 Jun"
  slots: PlanSlot[]
}

export interface PlanExportData {
  className: string
  weekStart: string   // 'YYYY-MM-DD'
  weekLabel: string   // formatted range e.g. "Mon 23 Jun – Sat 28 Jun"
  days:      PlanDay[]
}

function safeFilename(className: string, weekStart: string, ext: string): string {
  return `weekly_plan_${className}_${weekStart}.${ext}`
    .replace(/[\s·]/g, '_')
    .replace(/[^\w.-]/g, '')
}

// ── PDF ────────────────────────────────────────────────────────────────────────

export async function exportPlanToPDF(data: PlanExportData) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const MARGIN  = 14
  const PAGE_W  = doc.internal.pageSize.getWidth()
  const PAGE_H  = doc.internal.pageSize.getHeight()

  // ── Cover header ──
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Weekly Lesson Plan', MARGIN, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(data.className, MARGIN, 28)
  doc.text(data.weekLabel, PAGE_W - MARGIN, 28, { align: 'right' })

  doc.setTextColor(0)
  doc.setDrawColor(220)
  doc.line(MARGIN, 32, PAGE_W - MARGIN, 32)

  let cursorY = 38

  for (const day of data.days) {
    // Day heading
    if (cursorY > PAGE_H - 60) {
      doc.addPage()
      cursorY = 14
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(day.date, MARGIN, cursorY)
    cursorY += 5

    for (const slot of day.slots) {
      const body: string[][] = []

      if (slot.topic)      body.push(['Topic',       slot.topic])
      if (slot.objectives) body.push(['Objectives',  slot.objectives])
      if (slot.activities) body.push(['Activities',  slot.activities])
      if (slot.homework)   body.push(['Homework',    slot.homework])

      if (body.length === 0) {
        body.push(['', '(no content)'])
      }

      autoTable(doc, {
        startY:  cursorY,
        margin:  { left: MARGIN, right: MARGIN },
        head:    [[`${slot.subject}  ·  ${slot.time}`, '']],
        body,
        headStyles: {
          fillColor:  [245, 245, 245],
          textColor:  30,
          fontStyle:  'bold',
          fontSize:   9,
          halign:     'left',
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold', textColor: [100, 100, 100] },
          1: { cellWidth: 'auto' },
        },
        theme: 'plain',
        tableLineColor: [220, 220, 220],
        tableLineWidth: 0.2,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cursorY = (doc as any).lastAutoTable?.finalY + 6 ?? cursorY + 20
    }

    cursorY += 4
  }

  // Page numbers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
  }

  doc.save(safeFilename(data.className, data.weekStart, 'pdf'))
}

// ── Word (.docx) ───────────────────────────────────────────────────────────────

export async function exportPlanToWord(data: PlanExportData) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, HeadingLevel, WidthType, BorderStyle, AlignmentType,
  } = await import('docx')

  const children: (Paragraph | Table)[] = []

  // Title
  children.push(
    new Paragraph({
      text:    'Weekly Lesson Plan',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: data.className, bold: true }),
        new TextRun({ text: `   ${data.weekLabel}`, color: '888888' }),
      ],
      spacing: { after: 300 },
    })
  )

  for (const day of data.days) {
    // Day heading
    children.push(
      new Paragraph({
        text:    day.date,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    )

    for (const slot of day.slots) {
      // Slot heading row
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: slot.subject, bold: true }),
            new TextRun({ text: `  ·  ${slot.time}`, color: '888888' }),
          ],
          spacing: { before: 160, after: 80 },
        })
      )

      const NOOP_BORDER = {
        style: BorderStyle.NONE, size: 0, color: 'FFFFFF',
      }
      const CELL_BORDER = {
        top:    { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE' },
        left:   NOOP_BORDER,
        right:  NOOP_BORDER,
      }

      function fieldRow(label: string, value: string) {
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: '777777', size: 18 })] })],
              width:    { size: 20, type: WidthType.PERCENTAGE },
              borders:  CELL_BORDER,
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 18 })] })],
              width:    { size: 80, type: WidthType.PERCENTAGE },
              borders:  CELL_BORDER,
            }),
          ],
        })
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            fieldRow('Topic',       slot.topic),
            fieldRow('Objectives',  slot.objectives),
            fieldRow('Activities',  slot.activities),
            fieldRow('Homework',    slot.homework),
          ],
        })
      )
    }
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)

  // Trigger download
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = safeFilename(data.className, data.weekStart, 'docx')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
