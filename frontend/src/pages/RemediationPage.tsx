import { useState } from 'react'
import AIKeyBanner from '../components/AIKeyBanner'
import AIStreamOutput from '../components/AIStreamOutput'

const EXAMPLES = [
  'Clear Teams cache to fix sign-in issues',
  'Ensure Windows Defender real-time protection is enabled',
  'Remove a specific registry key left by uninstalled software',
  'Reset Windows Update components to fix stuck updates',
  'Map a network drive for all users on the device',
]

export default function RemediationPage() {
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submittedDesc, setSubmittedDesc] = useState('')

  function handleSubmit(desc?: string) {
    const d = desc || description
    if (!d.trim()) return
    setSubmittedDesc(d.trim())
    setSubmitted(true)
  }

  function handleReset() {
    setSubmitted(false)
    setSubmittedDesc('')
    setDescription('')
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 text-white text-xs">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">AI-Powered</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Script Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Describe a problem and get a ready-to-deploy Intune remediation script (detection + remediation pair).
        </p>
      </div>

      <AIKeyBanner>
        {!submitted ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              What do you need to fix?
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the problem or desired outcome..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y"
            />

            {/* Examples */}
            <div className="mt-3 mb-4">
              <p className="text-xs text-gray-400 mb-2">Examples:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setDescription(ex); handleSubmit(ex) }}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => handleSubmit()}
                disabled={!description.trim()}
                className="rounded-lg bg-violet-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-900 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Script
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Remediation Script</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xl">{submittedDesc}</p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                New script
              </button>
            </div>
            <AIStreamOutput
              url="/api/ai/remediation-script"
              body={{ description: submittedDesc }}
            />
          </div>
        )}
      </AIKeyBanner>
    </div>
  )
}
