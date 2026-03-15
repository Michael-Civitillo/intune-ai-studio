import { useState } from 'react'
import { exportMembersUrl, getGroupMembers } from '../api/client'
import GroupSearch, { Group } from '../components/GroupSearch'

interface Member {
  id: string
  displayName: string
  deviceId?: string
  operatingSystem?: string
  operatingSystemVersion?: string
  '@odata.type'?: string
}

export default function GroupMembersPage() {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function handleGroupSelect(g: Group) {
    setSelectedGroup(g)
    setMembers([])
    setError('')
    setSearch('')
    setLoading(true)
    try {
      const data = await getGroupMembers(g.id)
      setMembers(data.members || [])
      setCount(data.count || 0)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load members'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    if (!selectedGroup) return
    window.open(exportMembersUrl(selectedGroup.id), '_blank')
  }

  const filtered = members.filter(m =>
    !search || m.displayName?.toLowerCase().includes(search.toLowerCase())
  )

  const osCounts = members.reduce<Record<string, number>>((acc, m) => {
    const os = m.operatingSystem || 'Unknown'
    acc[os] = (acc[os] || 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Group Members</h1>
        <p className="text-sm text-gray-500 mt-1">
          List all device members of an Entra group.
        </p>
      </div>

      {/* Group search */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Select a group</label>
        <GroupSearch onSelect={handleGroupSelect} placeholder="Search group name..." />
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 shadow-sm flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading group members...</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && members.length > 0 && selectedGroup && (
        <>
          {/* Stats bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-gray-900">{selectedGroup.displayName}</h2>
                <p className="text-sm text-gray-500">{count} member{count !== 1 ? 's' : ''} total</p>
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
            </div>

            {/* OS breakdown */}
            {Object.keys(osCounts).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(osCounts).sort((a, b) => b[1] - a[1]).map(([os, n]) => (
                  <span key={os} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    <span>{os}</span>
                    <span className="bg-gray-300 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">{n}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Filter ${count} devices...`}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Device Name</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">OS</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Version</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Object ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{m.displayName || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{m.operatingSystem || '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{m.operatingSystemVersion || '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-400">{m.id}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">
                        No devices match "{search}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              Showing {filtered.length} of {count} members
            </div>
          </div>
        </>
      )}

      {!loading && !error && selectedGroup && members.length === 0 && count === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 shadow-sm text-center">
          <p className="text-gray-500 text-sm">This group has no device members.</p>
        </div>
      )}
    </div>
  )
}
