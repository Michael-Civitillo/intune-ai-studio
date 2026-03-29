import { useState } from 'react'
import AIKeyBanner from '../components/AIKeyBanner'
import AIStreamOutput from '../components/AIStreamOutput'
import GroupSearch, { Group } from '../components/GroupSearch'

export default function ComplianceGapPage() {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  function handleGroupSelect(g: Group) {
    setSelectedGroup(g)
    setAnalyzing(true)
  }

  function handleReset() {
    setSelectedGroup(null)
    setAnalyzing(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 text-white text-xs">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">AI-Powered</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance Gaps</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI reviews your group's assigned policies against Microsoft security baselines and identifies what's missing.
        </p>
      </div>

      <AIKeyBanner>
        {!analyzing ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select a group to analyze
            </label>
            <GroupSearch onSelect={handleGroupSelect} placeholder="Search group name..." />
          </div>
        ) : selectedGroup && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Compliance Gap Analysis</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedGroup.displayName}</p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Analyze another group
              </button>
            </div>
            <AIStreamOutput
              url="/api/ai/compliance-gap"
              body={{ group_id: selectedGroup.id }}
            />
          </div>
        )}
      </AIKeyBanner>
    </div>
  )
}
