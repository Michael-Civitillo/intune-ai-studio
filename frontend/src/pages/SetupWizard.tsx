import { useState } from 'react'
import { saveSetup, validateSetup } from '../api/client'

const REQUIRED_PERMISSIONS = [
  'DeviceManagementConfiguration.ReadWrite.All',
  'DeviceManagementApps.Read.All',
  'DeviceManagementManagedDevices.Read.All',
  'Group.ReadWrite.All',
  'Directory.Read.All',
  'User.Read',
]

interface Props {
  onComplete: () => void
}

type Step = 1 | 2 | 3

export default function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [clientId, setClientId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [validated, setValidated] = useState(false)

  async function handleValidate() {
    if (!clientId.trim() || !tenantId.trim()) {
      setValidationError('Both Client ID and Tenant ID are required.')
      return
    }
    setValidating(true)
    setValidationError('')
    try {
      const result = await validateSetup(clientId.trim(), tenantId.trim())
      if (result.valid) {
        await saveSetup(clientId.trim(), tenantId.trim())
        setValidated(true)
      } else {
        setValidationError(result.error || 'Validation failed. Check your Client ID and Tenant ID.')
      }
    } catch {
      setValidationError('Could not reach the backend. Make sure uvicorn is running on port 8000.')
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-blue-800 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {([1, 2, 3] as Step[]).map(s => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? 'w-6 bg-white' : s < step ? 'w-2 bg-white/60' : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="p-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
                <svg className="h-9 w-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Intune Admin Toolbox</h1>
              <p className="text-gray-500 mb-6">
                A local web app that makes day-to-day Intune admin tasks fast and visual — no CLI required.
              </p>
              <div className="space-y-3 text-left mb-8">
                {[
                  { icon: '⚡', title: 'Bulk Device Add', desc: 'Upload a CSV of device names and add them to any Entra group instantly.' },
                  { icon: '🔍', title: 'Group Audit', desc: 'See every config profile, compliance policy, and app assigned to a group.' },
                  { icon: '👥', title: 'Group Members', desc: 'List all devices in a group and export to CSV.' },
                ].map(f => (
                  <div key={f.title} className="flex gap-3 rounded-xl bg-gray-50 px-4 py-3">
                    <span className="text-xl">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                      <p className="text-xs text-gray-500">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Let's get you set up →
              </button>
            </div>
          )}

          {/* Step 2: Register Entra App */}
          {step === 2 && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Register an Entra App</h2>
              <p className="text-sm text-gray-500 mb-4">
                This app uses Microsoft Graph on your behalf. You need to register a small Entra application first (one-time setup).
              </p>

              {/* Critical callout */}
              <div className="mb-5 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 flex gap-3 items-start">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-amber-900">Don't skip step 2</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Enabling <strong>"Allow public client flows"</strong> is required for sign-in to work. It's the most commonly missed step and will cause an error if skipped.
                  </p>
                </div>
              </div>

              <ol className="space-y-4 mb-8">
                {[
                  {
                    n: 1,
                    title: 'Create a new App Registration',
                    body: <>Go to <a href="https://portal.azure.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">portal.azure.com</a> → Microsoft Entra ID → App registrations → <strong>New registration</strong>. Give it any name (e.g. "Intune Admin Toolbox"). Leave the redirect URI blank.</>,
                  },
                  {
                    n: 2,
                    title: '⚠️ Enable public client flows (required)',
                    body: <span className="font-medium text-amber-800">In the new app, go to <strong>Authentication</strong> → scroll to "Advanced settings" → set <strong>Allow public client flows</strong> to <strong>Yes</strong> → click <strong>Save</strong>. Sign-in will fail without this.</span>,
                  },
                  {
                    n: 3,
                    title: 'Add API permissions',
                    body: (
                      <>
                        Go to <strong>API permissions</strong> → Add a permission → Microsoft Graph → Delegated permissions. Add:
                        <ul className="mt-2 space-y-1">
                          {REQUIRED_PERMISSIONS.map(p => (
                            <li key={p} className="flex items-center gap-2 text-xs font-mono bg-gray-50 rounded px-2 py-1">
                              <span className="text-gray-400">•</span>{p}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-gray-500">Ask an admin to grant consent if required by your tenant.</p>
                      </>
                    ),
                  },
                  {
                    n: 4,
                    title: 'Copy your IDs',
                    body: <>On the <strong>Overview</strong> page, copy the <strong>Application (client) ID</strong> and the <strong>Directory (tenant) ID</strong>. You'll paste them in the next step.</>,
                  },
                ].map(step => (
                  <li key={step.n} className="flex gap-4">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold mt-0.5">
                      {step.n}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                      <div className="text-sm text-gray-600 mt-0.5">{step.body}</div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  I've done this →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Enter credentials */}
          {step === 3 && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Enter your app credentials</h2>
              <p className="text-sm text-gray-500 mb-6">
                Paste the IDs from your Entra app registration. They're saved locally and never sent anywhere except Microsoft's login servers.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Application (Client) ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={e => { setClientId(e.target.value); setValidated(false); setValidationError('') }}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Directory (Tenant) ID
                  </label>
                  <input
                    type="text"
                    value={tenantId}
                    onChange={e => { setTenantId(e.target.value); setValidated(false); setValidationError('') }}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {validationError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                  {validationError}
                </div>
              )}

              {validated && (
                <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2 text-sm text-green-800">
                  <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Credentials look good! Click below to sign in.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ← Back
                </button>
                {!validated ? (
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {validating ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Testing...
                      </span>
                    ) : 'Save & Test Connection'}
                  </button>
                ) : (
                  <button
                    onClick={onComplete}
                    className="flex-1 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                  >
                    Continue to Sign In →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-blue-200 mt-4">
          Your credentials are stored locally in backend/config.json and never leave your machine.
        </p>
      </div>
    </div>
  )
}
