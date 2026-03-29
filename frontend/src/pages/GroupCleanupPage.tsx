import { useState } from 'react'
import AIKeyBanner from '../components/AIKeyBanner'
import AIStreamOutput from '../components/AIStreamOutput'
import GroupSearch, { Group } from '../components/GroupSearch'

export default function GroupCleanupPage() {
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">AI-Powered</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Cleanup Advisor</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI analyzes a group's assignments, members, and type to tell you if it's safe to delete.
        </p>
      </div>

      <AIKeyBanner>
        {!analyzing ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select a group to evaluate
            </label>
            <GroupSearch onSelect={handleGroupSelect} placeholder="Search group name..." />
          </div>
        ) : selectedGroup && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Cleanup Recommendation</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedGroup.displayName}</p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Evaluate another group
              </button>
            </div>
            <AIStreamOutput
              url="/api/ai/group-cleanup"
              body={{ group_id: selectedGroup.id }}
            />
          </div>
        )}
      </AIKeyBanner>
    </div>
  )
}
