import { useEffect, useState } from 'react'
import { getAIStatus, saveAISetup } from '../api/client'

interface Props {
  children: React.ReactNode
}

const PROVIDER_INFO: Record<string, { label: string; placeholder: string; keyUrl: string; needsEndpoint?: boolean }> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    label: 'OpenAI (GPT-4o)',
    placeholder: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  azure: {
    label: 'Azure OpenAI (Copilot)',
    placeholder: 'your-azure-api-key',
    keyUrl: 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub',
    needsEndpoint: true,
  },
  gemini: {
    label: 'Google (Gemini)',
    placeholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
}

export default function AIKeyBanner({ children }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [activeProvider, setActiveProvider] = useState('')
  const [provider, setProvider] = useState('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAIStatus()
      .then(d => {
        setConfigured(d.configured)
        if (d.provider) setActiveProvider(d.provider)
      })
      .catch(() => setConfigured(false))
  }, [])

  async function handleSave() {
    if (!apiKey.trim()) return
    if (provider === 'azure' && !endpoint.trim()) return
    setSaving(true)
    setError('')
    try {
      await saveAISetup(provider, apiKey.trim(), endpoint.trim())
      setConfigured(true)
      setActiveProvider(provider)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (configured === null) return null

  if (configured) {
    return (
      <div>
        {activeProvider && (
          <div className="flex items-center justify-end mb-3">
            <button
              onClick={() => setConfigured(false)}
              className="text-xs text-gray-400 hover:text-violet-600 flex items-center gap-1 transition-colors"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              {PROVIDER_INFO[activeProvider]?.label || activeProvider}
              <span className="text-gray-300 mx-0.5">·</span>
              Change
            </button>
          </div>
        )}
        {children}
      </div>
    )
  }

  const info = PROVIDER_INFO[provider]

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3 mb-5">
        <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <div>
          <h3 className="text-sm font-semibold text-amber-900">Connect an AI provider</h3>
          <p className="text-sm text-amber-700 mt-1">
            Choose your preferred AI provider to power the AI features.
          </p>
        </div>
      </div>

      {/* Provider selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {Object.entries(PROVIDER_INFO).map(([key, p]) => (
          <button
            key={key}
            onClick={() => setProvider(key)}
            className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors text-left ${
              provider === key
                ? 'border-violet-400 bg-violet-100 text-violet-900'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* API key input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder={info.placeholder}
            className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim() || (provider === 'azure' && !endpoint.trim())}
            className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-medium text-white hover:bg-violet-900 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Azure endpoint field */}
        {info.needsEndpoint && (
          <input
            type="text"
            value={endpoint}
            onChange={e => setEndpoint(e.target.value)}
            placeholder="https://your-resource.openai.azure.com"
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-amber-600 mt-3">
        Get your key at{' '}
        <a href={info.keyUrl} target="_blank" rel="noreferrer" className="underline">
          {new URL(info.keyUrl).hostname}
        </a>
        . Your key is stored locally and never leaves this machine.
      </p>
    </div>
  )
}
