import { useState } from 'react'
import AIKeyBanner from '../components/AIKeyBanner'
import { deviceSearch } from '../api/client'

interface DeviceResult {
  deviceName?: string
  operatingSystem?: string
  complianceState?: string
  lastSyncDateTime?: string
  userDisplayName?: string
  [key: string]: unknown
}

interface SearchResult {
  devices: DeviceResult[]
  count: number
  filter: string
  description: string
  error?: string
}

const EXAMPLES = [
  'Show me all Windows devices that haven\'t synced in 30 days',
  'Find non-compliant iOS devices',
  'List all devices assigned to john@contoso.com',
  'Devices with less than 10GB free storage',
  'All unencrypted Windows devices',
]

export default function DeviceSearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState('')

  async function handleSearch(q?: string) {
    const searchQuery = q || query
    if (!searchQuery.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await deviceSearch(searchQuery.trim())
      if (data.error) {
        setError(data.error)
      }
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 text-white text-xs">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">AI-Powered</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Device Search</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search your Intune devices using plain English. AI translates your query into the right Graph API filter.
        </p>
      </div>

      <AIKeyBanner>
        {/* Search input */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5 shadow-sm">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Describe what you're looking for..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="rounded-lg bg-violet-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-900 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              Search
            </button>
          </div>

          {/* Example queries */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-gray-400">Try:</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); handleSearch(ex) }}
                className="text-xs text-violet-600 hover:text-violet-800 hover:underline"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 mb-5">
            {error}
          </div>
        )}

        {/* Generated filter */}
        {result?.filter && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 mb-5 flex items-center gap-3">
            <span className="text-xs font-semibold text-violet-700">OData Filter:</span>
            <code className="text-xs text-violet-900 font-mono flex-1 truncate">{result.filter}</code>
            <button
              onClick={() => navigator.clipboard.writeText(result.filter)}
              className="text-xs text-violet-600 hover:text-violet-800 flex-shrink-0"
            >
              Copy
            </button>
          </div>
        )}

        {/* Results table */}
        {result?.devices && result.devices.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {result.count} device{result.count !== 1 ? 's' : ''} found
              </span>
              {result.description && (
                <span className="text-xs text-gray-500">{result.description}</span>
              )}
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Device Name</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">OS</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Compliance</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Last Sync</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">User</th>
                  </tr>
                </thead>
                <tbody>
                  {result.devices.map((dev, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{dev.deviceName || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{dev.operatingSystem || '—'}</td>
                      <td className="px-5 py-3">
                        {dev.complianceState && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            dev.complianceState === 'compliant'
                              ? 'bg-green-100 text-green-800'
                              : dev.complianceState === 'noncompliant'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {dev.complianceState}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {dev.lastSyncDateTime
                          ? new Date(dev.lastSyncDateTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">{dev.userDisplayName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result?.devices && result.devices.length === 0 && !error && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">No devices matched your query.</p>
          </div>
        )}
      </AIKeyBanner>
    </div>
  )
}
