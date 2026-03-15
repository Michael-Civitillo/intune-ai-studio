import { useState } from 'react'
import GroupSearch from '../components/GroupSearch'
import { syncGroupDevices } from '../api/client'

interface Group {
  id: string
  displayName: string
}

interface SyncResult {
  deviceName: string
  operatingSystem: string
  status: 'synced' | 'not_managed' | 'error'
  message: string
}

interface SyncSummary {
  total: number
  synced: number
  not_managed: number
  errors: number
}

export default function GroupSyncPage() {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SyncResult[] | null>(null)
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  function handleGroupSelect(group: Group) {
    setSelectedGroup(group)
    setResults(null)
    setSummary(null)
    setError('')
    setConfirmed(false)
  }

  async function handleSync() {
    if (!selectedGroup || !confirmed) return
    setLoading(true)
    setError('')
    setResults(null)
    setSummary(null)
    try {
      const data = await syncGroupDevices(selectedGroup.id)
      setResults(data.results)
      setSummary(data.summary)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setLoading(false)
      setConfirmed(false)
    }
  }

  function handleReset() {
    setResults(null)
    setSummary(null)
    setSelectedGroup(null)
    setError('')
    setFilter('')
    setConfirmed(false)
  }

  const filtered = results
    ? results.filter(r => r.deviceName.toLowerCase().includes(filter.toLowerCase()))
    : []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Force Sync Devices</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Trigger an immediate Intune sync for all managed devices in a group — no more waiting for the scheduled check-in window.
        </p>
      </div>

      {/* Step 1: Select group */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white text-xs">
            1
          </span>
          Select target group
        </h2>
        <GroupSearch onSelect={handleGroupSelect} />
      </div>

      {/* Step 2: Confirm & trigger */}
      {!results && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white text-xs">
              2
            </span>
            Confirm & sync
          </h2>

          {/* Checklist when group isn't selected yet */}
          {!selectedGroup && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
              Select a target group above
            </div>
          )}

          {selectedGroup && (
            <>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm">
                <p className="font-medium text-amber-800">
                  ⚠️ This will trigger an immediate sync on <strong>all Intune-managed devices</strong> in{' '}
                  <strong>{selectedGroup.displayName}</strong>.
                </p>
                <p className="mt-1 text-amber-700">
                  Entra devices not enrolled in Intune will be skipped automatically.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                I understand — sync all managed devices in <strong className="ml-1">{selectedGroup.displayName}</strong>
              </label>
            </>
          )}

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={loading || !selectedGroup || !confirmed}
            className="w-full rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Syncing devices… this may take a moment
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {selectedGroup ? `Sync All Devices in ${selectedGroup.displayName}` : 'Sync All Devices'}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {results && summary && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Results — {selectedGroup?.displayName}
            </h2>
            <button
              onClick={handleReset}
              className="text-xs font-medium text-fuchsia-600 hover:text-fuchsia-700"
            >
              Sync another group
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-3 text-center">
              <p className="text-2xl font-bold text-green-700">{summary.synced}</p>
              <p className="text-xs text-green-600 mt-0.5">Synced ✓</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 text-center">
              <p className="text-2xl font-bold text-gray-500">{summary.not_managed}</p>
              <p className="text-xs text-gray-400 mt-0.5">Not in Intune</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-center">
              <p className="text-2xl font-bold text-red-700">{summary.errors}</p>
              <p className="text-xs text-red-600 mt-0.5">Errors</p>
            </div>
          </div>

          {summary.synced === summary.total && summary.total > 0 && (
            <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
              🎉 All {summary.total} devices synced successfully!
            </div>
          )}

          {/* Filter */}
          {results.length > 5 && (
            <input
              type="text"
              placeholder="Filter by device name…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full mb-3 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          )}

          {/* Table */}
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-100">
                <tr>
                  <th className="py-2 text-left text-gray-500 font-medium">Device</th>
                  <th className="py-2 text-left text-gray-500 font-medium">OS</th>
                  <th className="py-2 text-left text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 font-mono text-gray-700">{r.deviceName}</td>
                    <td className="py-1.5 text-gray-500">{r.operatingSystem || '—'}</td>
                    <td className="py-1.5">
                      {r.status === 'synced' && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          ✓ Synced
                        </span>
                      )}
                      {r.status === 'not_managed' && (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Not in Intune
                        </span>
                      )}
                      {r.status === 'error' && (
                        <span
                          className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 cursor-help"
                          title={r.message}
                        >
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400">
                      No devices match your filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
