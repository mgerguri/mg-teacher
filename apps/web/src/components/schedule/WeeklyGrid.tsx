import { LocalSchedule, LocalSubject, LocalClass, LocalTeacher } from '../../lib/local-db'

// ── Constants ─────────────────────────────────────────────────────────────────

const START_HOUR = 7          // 07:00
const END_HOUR   = 20         // 20:00
const PX_PER_MIN = 1.5        // grid height scale
const TOTAL_MINS = (END_HOUR - START_HOUR) * 60
const GRID_HEIGHT = TOTAL_MINS * PX_PER_MIN  // 1170px

const DAYS = [
  { label: 'Monday',    value: 1 },
  { label: 'Tuesday',   value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday',  value: 4 },
  { label: 'Friday',    value: 5 },
]

const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeToMins(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function topPct(time: string): number {
  return ((timeToMins(time) - START_HOUR * 60) / TOTAL_MINS) * 100
}

function heightPct(start: string, end: string): number {
  return ((timeToMins(end) - timeToMins(start)) / TOTAL_MINS) * 100
}

// Palette — cycles by subjectId for consistent colouring
const COLORS = [
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-green-100 border-green-300 text-green-900',
  'bg-purple-100 border-purple-300 text-purple-900',
  'bg-orange-100 border-orange-300 text-orange-900',
  'bg-rose-100 border-rose-300 text-rose-900',
  'bg-teal-100 border-teal-300 text-teal-900',
  'bg-yellow-100 border-yellow-300 text-yellow-900',
]

function colorFor(subjectId: string): string {
  const hash = subjectId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return COLORS[hash % COLORS.length]
}

// ── Props ─────────────────────────────────────────────────────────────────────

export type Perspective = 'class' | 'teacher'

interface Props {
  schedules:   LocalSchedule[]
  subjects:    Map<string, LocalSubject>
  classes:     Map<string, LocalClass>
  teachers:    Map<string, LocalTeacher>
  perspective: Perspective
  onEntryClick: (entry: LocalSchedule) => void
  onSlotClick:  (day: number, time: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyGrid({
  schedules, subjects, classes, teachers, perspective, onEntryClick, onSlotClick,
}: Props) {
  return (
    <div className="flex overflow-x-auto">
      {/* Time labels column */}
      <div className="flex-shrink-0 w-14 relative" style={{ height: GRID_HEIGHT }}>
        {HOUR_LABELS.map(hour => (
          <div
            key={hour}
            className="absolute right-2 text-xs text-gray-400 -translate-y-2"
            style={{ top: ((hour - START_HOUR) * 60 * PX_PER_MIN) }}
          >
            {String(hour).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div className="flex flex-1 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        {DAYS.map(day => (
          <div key={day.value} className="flex-1 flex flex-col min-w-[120px]">
            {/* Day header */}
            <div className="text-center text-xs font-semibold text-gray-600 py-2 bg-gray-50 border-b border-gray-200">
              {day.label}
            </div>

            {/* Column body */}
            <div
              className="relative bg-white flex-1 cursor-pointer"
              style={{ height: GRID_HEIGHT }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const y = e.clientY - rect.top
                const mins = Math.floor((y / GRID_HEIGHT) * TOTAL_MINS / 30) * 30
                const totalMins = START_HOUR * 60 + mins
                const h = Math.floor(totalMins / 60)
                const m = totalMins % 60
                onSlotClick(day.value, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
              }}
            >
              {/* Hour grid lines */}
              {HOUR_LABELS.map(hour => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: (hour - START_HOUR) * 60 * PX_PER_MIN }}
                />
              ))}

              {/* Schedule entries for this day */}
              {schedules
                .filter(s => s.dayOfWeek === day.value && !s.deletedAt)
                .map(entry => {
                  const subject  = subjects.get(entry.subjectId)
                  const cls      = classes.get(entry.classId)
                  const teacher  = teachers.get(entry.teacherId)
                  const color    = colorFor(entry.subjectId)
                  const top      = topPct(entry.startTime)
                  const height   = heightPct(entry.startTime, entry.endTime)

                  return (
                    <div
                      key={entry.id}
                      className={`absolute left-1 right-1 rounded border px-1.5 py-1 overflow-hidden cursor-pointer hover:brightness-95 transition-all ${color}`}
                      style={{
                        top:    `${top}%`,
                        height: `${height}%`,
                        minHeight: 24,
                      }}
                      onClick={(e) => { e.stopPropagation(); onEntryClick(entry) }}
                    >
                      <p className="text-xs font-semibold leading-tight truncate">
                        {subject?.name ?? '—'}
                      </p>
                      <p className="text-xs leading-tight truncate opacity-75">
                        {perspective === 'class'
                          ? `${teacher?.firstName ?? ''} ${teacher?.lastName ?? ''}`.trim() || '—'
                          : cls?.name ?? '—'}
                      </p>
                      <p className="text-xs leading-tight truncate opacity-60">
                        {entry.startTime}–{entry.endTime}
                      </p>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
