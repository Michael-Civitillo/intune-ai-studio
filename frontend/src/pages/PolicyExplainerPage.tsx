import { useState } from 'react'
import AIKeyBanner from '../components/AIKeyBanner'
import AIStreamOutput from '../components/AIStreamOutput'

export default function PolicyExplainerPage() {
  const [policyJson, setPolicyJson] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submittedJson, setSubmittedJson] = useState('')

  function handleSubmit() {
    if (!policyJson.trim()) return
    setSubmittedJson(policyJson.trim())
    setSubmitted(true)
  }

  function handleReset() {
    setSubmitted(false)
    setSubmittedJson('')
    setPolicyJson('')
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 text-white text-xs">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">AI-Powered</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Policy Explainer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a config profile or policy JSON and get a plain-English explanation of every setting.
        </p>
      </div>

      <AIKeyBanner>
        {!submitted ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Paste your Intune policy JSON
            </label>
            <textarea
              value={policyJson}
              onChange={e => setPolicyJson(e.target.value)}
              placeholder='{"@odata.type": "#microsoft.graph.windows10GeneralConfiguration", ...}'
              rows={12}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y"
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">
                Tip: Export a config profile from Intune or grab it from Graph Explorer.
              </p>
              <button
                onClick={handleSubmit}
                disabled={!policyJson.trim()}
                className="rounded-lg bg-violet-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-900 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Explain
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">AI Explanation</h2>
              <button
                onClick={handleReset}
                className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                New analysis
              </button>
            </div>
            <AIStreamOutput
              url="/api/ai/policy-explain"
              body={{ policy_json: submittedJson }}
            />
          </div>
        )}
      </AIKeyBanner>
    </div>
  )
}
