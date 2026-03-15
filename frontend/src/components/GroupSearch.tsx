import { useEffect, useRef, useState } from 'react'
import { searchGroups } from '../api/client'

export interface Group {
  id: string
  displayName: string
  description?: string
}

interface Props {
  onSelect: (group: Group) => void
  placeholder?: string
}

export default function GroupSearch({ onSelect, placeholder = 'Search for a group...' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchGroups(query)
        setResults(data.groups || [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(g: Group) {
    setQuery(g.displayName)
    setOpen(false)
    onSelect(g)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map(g => (
            <button
              key={g.id}
              onClick={() => handleSelect(g)}
              className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="text-sm font-medium text-gray-900">{g.displayName}</span>
              {g.description && <span className="text-xs text-gray-400 truncate">{g.description}</span>}
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg">
          No groups found matching "{query}"
        </div>
      )}
    </div>
  )
}
