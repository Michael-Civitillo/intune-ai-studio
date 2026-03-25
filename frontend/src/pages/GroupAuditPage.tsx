import { useState } from 'react'
import { exportAuditUrl, getGroupAudit } from '../api/client'
import GroupSearch, { Group } from '../components/GroupSearch'

interface AuditItem {
  id: string
  displayName: string
  type: string
  lastModified: string
}

interface AuditData {
  configProfiles: AuditItem[]
  compliancePolicies: AuditItem[]
  apps: AuditItem[]
  totalAssignments: number
}

type Tab = 'configProfiles' | 'compliancePolicies' | 'apps'

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'configProfiles', label: 'Config Profiles', icon: '⚙️' },
  { key: 'compliancePolicies', label: 'Compliance Policies', icon: '✅' },
  { key: 'apps', label: 'Apps', icon: '📦' },
]

export default function GroupAuditPage() {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('configProfiles')

  async function handleGroupSelect(g: Group) {
    setSelectedGroup(g)
    setAudit(null)
    setError('')
    setLoading(true)
    try {
      const data = await getGroupAudit(g.id)
      setAudit(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load audit data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    if (!selectedGroup) return
    window.open(exportAuditUrl(selectedGroup.id), '_blank')
  }

  const activeItems = audit ? audit[activeTab] : []

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Group Audit</h1>
        <p className="text-sm text-gray-500 mt-1">
          See every config profile, compliance policy, and app assigned to a group — before deleting it.
        </p>
      </div>

      {/* Group search */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Select a group to audit</label>
        <GroupSearch onSelect={handleGroupSelect} placeholder="Search group name..." />
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 shadow-sm flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Scanning all policies and apps...</p>
          <p className="text-xs text-gray-400">This may take 10–30 seconds for large tenants</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {audit && selectedGroup && (
        <>
          {/* Summary banner */}
          <div className={`rounded-xl border p-5 mb-5 shadow-sm ${
            audit.totalAssignments === 0
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{audit.totalAssignments === 0 ? '✅' : '⚠️'}</span>
                  <h2 className="font-semibold text-gray-900">{selectedGroup.displayName}</h2>
                </div>
                {audit.totalAssignments === 0 ? (
                  <p className="text-sm text-green-800">
                    No assignments found — this group appears safe to delete.
                  </p>
                ) : (
                  <p className="text-sm text-amber-800">
                    <strong>{audit.totalAssignments} assignment{audit.totalAssignments !== 1 ? 's' : ''}</strong> found across policies and apps. Review before deleting.
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-gray-600">
                  <span>{audit.configProfiles.length} config profiles</span>
                  <span>{audit.compliancePolicies.length} compliance policies</span>
                  <span>{audit.apps.length} apps</span>
                </div>
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
          </div>

          {/* Tabs */}
          {audit.totalAssignments > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-200">
                {tabs.map(tab => {
                  const count = audit[tab.key].length
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === tab.key
                          ? 'border-violet-700 text-violet-900 bg-violet-100/50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        count > 0 ? 'bg-violet-200 text-violet-900' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="p-5">
                {activeItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No {tabs.find(t => t.key === activeTab)?.label.toLowerCase()} assigned to this group.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 text-left font-semibold text-gray-600">Name</th>
                        <th className="pb-3 text-left font-semibold text-gray-600 w-48">Last Modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map(item => (
                        <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 font-medium text-gray-900">{item.displayName}</td>
                          <td className="py-3 text-gray-500 text-xs">
                            {item.lastModified
                              ? new Date(item.lastModified).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
