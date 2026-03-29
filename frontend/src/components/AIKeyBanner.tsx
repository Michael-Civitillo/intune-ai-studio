import { useEffect, useState } from 'react'
import { getAIStatus, saveAISetup } from '../api/client'

interface Props {
  children: React.ReactNode
}

export default function AIKeyBanner({ children }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAIStatus().then(d => setConfigured(d.configured)).catch(() => setConfigured(false))
  }, [])

  async function handleSave() {
    if (!apiKey.trim()) return
    setSaving(true)
    setError('')
    try {
      await saveAISetup(apiKey.trim())
      setConfigured(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  if (configured === null) return null
  if (configured) return <>{children}</>

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3 mb-4">
        <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <div>
          <h3 className="text-sm font-semibold text-amber-900">API key required</h3>
          <p className="text-sm text-amber-700 mt-1">
            AI features are powered by Claude. Enter your Anthropic API key to get started.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="sk-ant-..."
          className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-medium text-white hover:bg-violet-900 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-amber-600 mt-3">
        Get your key at{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline">
          console.anthropic.com
        </a>
        . Your key is stored locally and never leaves this machine.
      </p>
    </div>
  )
}
