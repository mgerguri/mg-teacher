import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { localDb, LocalStudent } from '../lib/local-db'
import { useAuth } from '../context/AuthContext'
import { scopeClasses, scopeByClassId, classIdSet } from '../lib/scope'

interface Result {
  student:   LocalStudent
  className: string
}

export default function GlobalSearch() {
  const { t }    = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [cursor,  setCursor]  = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Open on Cmd/Ctrl+K ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // ── Search ───────────────────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    const lower = q.toLowerCase()

    const [studentsRaw, classesRaw] = await Promise.all([
      localDb.students.filter(s => !s.deletedAt).toArray(),
      localDb.classes.filter(c => !c.deletedAt).toArray(),
    ])
    const classes = scopeClasses(classesRaw, user)
    const students = scopeByClassId(studentsRaw, user, classIdSet(classes))
    const classMap = new Map(classes.map(c => [c.id, c.name]))

    const matched = students
      .filter(s => {
        const full = `${s.firstName} ${s.lastName}`.toLowerCase()
        return full.includes(lower)
            || s.email?.toLowerCase().includes(lower)
            || s.parentName?.toLowerCase().includes(lower)
      })
      .slice(0, 12)
      .map(s => ({ student: s, className: s.classId ? (classMap.get(s.classId) ?? '—') : '—' }))

    setResults(matched)
    setCursor(0)
  }, [user])

  useEffect(() => { search(query) }, [query, search])

  // ── Keyboard navigation ──────────────────────────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) {
      navigate(`/students/${results[cursor].student.id}`)
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-600 transition-colors"
      >
        <span>🔍</span>
        <span className="hidden sm:inline">{t('search.placeholder')}</span>
        <kbd className="hidden sm:inline text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/30"
      onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <span className="text-gray-400">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 text-sm outline-none placeholder-gray-300"
          />
          <kbd className="text-xs text-gray-300 font-mono">Esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => (
              <li key={r.student.id}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === cursor ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => { navigate(`/students/${r.student.id}`); setOpen(false) }}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-500 flex-shrink-0">
                    {r.student.firstName[0]}{r.student.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {r.student.firstName} {r.student.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{r.className}</p>
                  </div>
                  {r.student.email && (
                    <span className="text-xs text-gray-300 truncate max-w-32">{r.student.email}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : query ? (
          <p className="text-sm text-gray-300 text-center py-10">{t('search.noResults')}</p>
        ) : (
          <p className="text-sm text-gray-300 text-center py-10">{t('search.hint')}</p>
        )}
      </div>
    </div>
  )
}
