import { useRef, useState } from 'react'
import { bulkAddDevices } from '../api/client'
import GroupSearch, { Group } from '../components/GroupSearch'
import StatusBadge from '../components/StatusBadge'

interface DeviceResult {
  deviceName: string
  objectId?: string
  status: string
  message?: string
}

interface BulkResult {
  results: DeviceResult[]
  summary: { added: number; already_member: number; not_found: number; error: number }
}

export default function BulkAddPage() {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [rawInput, setRawInput] = useState('')
  const [deviceNames, setDeviceNames] = useState<string[]>([])
  const [result, setResult] = useState<BulkResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function parseNames(text: string): string[] {
    return text
      .split(/[\r\n,]+/)
      .map(s => s.trim())
      .filter(Boolean)
  }

  function handleTextChange(val: string) {
    setRawInput(val)
    setDeviceNames(parseNames(val))
    setResult(null)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setRawInput(text)
      setDeviceNames(parseNames(text))
      setResult(null)
    }
    reader.readAsText(file)
  }

  async function handleSubmit() {
    if (!selectedGroup || deviceNames.length === 0) return
    setLoading(true)
    setError('')
    try {
      const data = await bulkAddDevices(selectedGroup.id, deviceNames)
      setResult(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setRawInput('')
    setDeviceNames([])
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Device Add</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV (or paste) device names to add them to an Entra group in bulk.
        </p>
      </div>

      {/* Step 1: Target group */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white text-xs">1</span>
          Select target group
        </h2>
        <GroupSearch
          onSelect={g => { setSelectedGroup(g); setResult(null) }}
          placeholder="Search group name..."
        />
        {selectedGroup && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{selectedGroup.displayName}</span>
            <span className="text-gray-400 font-mono text-xs">{selectedGroup.id}</span>
          </div>
        )}
      </div>

      {/* Step 2: Device names */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white text-xs">2</span>
          Enter device names
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload CSV
            </button>
            <span className="text-xs text-gray-400">or paste device names below (one per line)</span>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
          </div>
          <textarea
            value={rawInput}
            onChange={e => handleTextChange(e.target.value)}
            rows={6}
            placeholder="DEVICE-001&#10;DEVICE-002&#10;LAPTOP-JOHN&#10;..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono resize-none focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          {deviceNames.length > 0 && (
            <p className="text-xs text-gray-500">{deviceNames.length} device{deviceNames.length > 1 ? 's' : ''} ready to process</p>
          )}
        </div>
      </div>

      {/* Preview + submit */}
      {deviceNames.length > 0 && selectedGroup && !result && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white text-xs">3</span>
            Preview & submit
          </h2>
          <div className="mb-4 rounded-lg bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-800">
            Adding <strong>{deviceNames.length} device{deviceNames.length > 1 ? 's' : ''}</strong> to <strong>{selectedGroup.displayName}</strong>.
            Devices not found in Entra will be skipped.
          </div>
          <div className="max-h-40 overflow-y-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-1.5 text-left text-gray-500 font-medium">Device Name</th>
                </tr>
              </thead>
              <tbody>
                {deviceNames.slice(0, 50).map((name, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 font-mono text-gray-700">{name}</td>
                  </tr>
                ))}
                {deviceNames.length > 50 && (
                  <tr>
                    <td className="py-1 text-gray-400">...and {deviceNames.length - 50} more</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing {deviceNames.length} devices...
              </span>
            ) : `Add ${deviceNames.length} Device${deviceNames.length > 1 ? 's' : ''} to Group`}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Results</h2>
            <button onClick={handleReset} className="text-xs text-fuchsia-600 hover:underline">
              Start new batch
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Added', count: result.summary.added, color: 'text-green-700 bg-green-50' },
              { label: 'Already Member', count: result.summary.already_member, color: 'text-violet-700 bg-violet-50' },
              { label: 'Not Found', count: result.summary.not_found, color: 'text-red-700 bg-red-50' },
              { label: 'Error', count: result.summary.error, color: 'text-orange-700 bg-orange-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg px-3 py-2 text-center ${s.color}`}>
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Per-device table */}
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left font-semibold text-gray-600">Device Name</th>
                  <th className="py-2 text-left font-semibold text-gray-600">Status</th>
                  <th className="py-2 text-left font-semibold text-gray-600">Message</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 font-mono text-gray-800">{r.deviceName}</td>
                    <td className="py-1.5"><StatusBadge status={r.status} /></td>
                    <td className="py-1.5 text-gray-500">{r.message || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
