import { useEffect, useRef, useState } from 'react'
import { User } from '../App'
import { getMe, getPermissions, pollAuth, startAuth } from '../api/client'

interface Permission {
  scope: string
  granted: boolean
  description: string
}

// Per-permission display state during the checking phase
type PermState = 'pending' | 'checking' | 'done'

interface PermRow {
  scope: string
  description: string
  state: PermState
  granted?: boolean
}

interface Props {
  onAuthenticated: (user: User) => void
}

type AuthStep = 'idle' | 'device_code' | 'polling' | 'checking_perms' | 'done'

const SCOPE_LABELS: Record<string, string> = {
  'DeviceManagementConfiguration.ReadWrite.All': 'Config profiles & device add',
  'DeviceManagementApps.Read.All': 'App assignments',
  'DeviceManagementManagedDevices.Read.All': 'Resolve device names',
  'Group.ReadWrite.All': 'Search & manage groups',
  'Directory.Read.All': 'Entra device objects',
  'User.Read': 'Signed-in account info',
}

function isPublicClientError(msg: string) {
  return msg.toLowerCase().includes('public client') || msg.includes('AADSTS7000218') || msg.includes('client_assertion')
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

export default function AuthPage({ onAuthenticated }: Props) {
  const [authStep, setAuthStep] = useState<AuthStep>('idle')
  const [deviceCode, setDeviceCode] = useState<{ user_code: string; verification_uri: string; expires_in: number } | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [permRows, setPermRows] = useState<PermRow[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [user, setUser] = useState<User | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  // Animate permission rows one by one after data is available
  async function animatePermissions(perms: Permission[]) {
    const scopes = Object.keys(SCOPE_LABELS)

    // Initialise all as pending
    const initial: PermRow[] = scopes.map(s => ({
      scope: s,
      description: SCOPE_LABELS[s] ?? '',
      state: 'pending',
    }))
    setPermRows(initial)

    // Stagger: mark each as 'checking' then immediately 'done'
    for (let i = 0; i < scopes.length; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? 200 : 130))
      const matched = perms.find(p => p.scope === scopes[i])
      setPermRows(prev =>
        prev.map((row, idx) =>
          idx === i ? { ...row, state: 'done', granted: matched?.granted ?? false } : row
        )
      )
    }
  }

  async function handleSignIn() {
    setError('')
    setAuthStep('device_code')
    try {
      const flow = await startAuth()
      setDeviceCode(flow)
      setCountdown(flow.expires_in)
      setAuthStep('polling')

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(countdownRef.current!)
            setAuthStep('idle')
            setError('Sign-in timed out. Please try again.')
            return 0
          }
          return c - 1
        })
      }, 1000)

      // Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const result = await pollAuth()
          if (result.status === 'authenticated') {
            clearInterval(pollRef.current!)
            clearInterval(countdownRef.current!)
            setAuthStep('checking_perms')

            try {
              const [me, perms] = await Promise.all([
                withTimeout(getMe(), 10000, 'User lookup'),
                withTimeout(getPermissions(), 10000, 'Permission check'),
              ])
              setUser(me)
              setPermissions(perms)
              await animatePermissions(perms)
              setAuthStep('done')
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Failed to verify account'
              setError(msg)
              setAuthStep('idle')
            }
          } else if (result.status === 'error') {
            clearInterval(pollRef.current!)
            clearInterval(countdownRef.current!)
            setError(result.message || 'Authentication failed.')
            setAuthStep('idle')
          }
        } catch {
          // network hiccup — keep polling
        }
      }, 3000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start sign-in. Is the backend running?'
      setError(msg)
      setAuthStep('idle')
    }
  }

  function handleContinue() {
    if (user) onAuthenticated(user)
  }

  const missingPerms = permissions.filter(p => !p.granted)
  const allGranted = permissions.length > 0 && missingPerms.length === 0

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60
  const countdownStr = `${minutes}:${seconds.toString().padStart(2, '0')}`

  const allRowsDone = permRows.length > 0 && permRows.every(r => r.state === 'done')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-blue-800 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-7">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Sign in to Intune Toolbox</h1>
            <p className="text-sm text-gray-500 mt-1">Authenticate with your Microsoft account</p>
          </div>

          {/* ── Idle / error ───────────────────────────────────────── */}
          {(authStep === 'idle' || authStep === 'device_code') && (
            <>
              {error && (
                isPublicClientError(error) ? (
                  <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm">
                    <p className="font-semibold text-amber-900 flex items-center gap-2 mb-2">
                      <span>⚠️</span> Public client flows not enabled
                    </p>
                    <p className="text-amber-800 mb-3">Your Entra app registration needs one setting changed:</p>
                    <ol className="space-y-1.5 text-amber-800 list-none">
                      {[
                        <>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noreferrer" className="underline font-medium">App registrations</a></>,
                        <>Open your app → click <strong>Authentication</strong></>,
                        <>Scroll to <strong>Advanced settings</strong></>,
                        <>Set <strong>"Allow public client flows"</strong> to <strong>Yes</strong></>,
                        <>Click <strong>Save</strong>, then try again</>,
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800 text-xs font-bold">{i + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                    {error}
                  </div>
                )
              )}
              <button
                onClick={handleSignIn}
                disabled={authStep === 'device_code'}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {authStep === 'device_code' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Starting sign-in...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign in with Microsoft
                  </>
                )}
              </button>
            </>
          )}

          {/* ── Device code display ────────────────────────────────── */}
          {authStep === 'polling' && deviceCode && (
            <div className="text-center space-y-5">
              <div>
                <p className="text-sm text-gray-600 mb-3">Open the link below and enter the code:</p>
                <a href={deviceCode.verification_uri} target="_blank" rel="noreferrer"
                  className="inline-block text-blue-600 underline text-sm font-medium mb-4">
                  {deviceCode.verification_uri}
                </a>
                <div className="rounded-xl bg-blue-50 border-2 border-blue-200 px-6 py-4">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">Your code</p>
                  <p className="text-3xl font-bold font-mono tracking-widest text-blue-900">{deviceCode.user_code}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span>Waiting for sign-in… expires in {countdownStr}</span>
              </div>
              <button
                onClick={() => { clearInterval(pollRef.current!); clearInterval(countdownRef.current!); setAuthStep('idle') }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Checking permissions (live list) ──────────────────── */}
          {authStep === 'checking_perms' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent flex-shrink-0" />
                Checking your permissions…
              </div>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                {permRows.map(row => (
                  <div key={row.scope} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {row.state === 'pending' && (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-200" />
                      )}
                      {row.state === 'checking' && (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      )}
                      {row.state === 'done' && row.granted && (
                        <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      {row.state === 'done' && !row.granted && (
                        <svg className="h-4 w-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-mono truncate transition-colors ${
                        row.state === 'pending' ? 'text-gray-300' :
                        row.state === 'checking' ? 'text-gray-500' :
                        row.granted ? 'text-gray-800' : 'text-red-600'
                      }`}>
                        {row.scope}
                      </p>
                      {row.state === 'done' && (
                        <p className="text-xs text-gray-400 mt-0.5">{row.description}</p>
                      )}
                    </div>
                    {/* Status label */}
                    {row.state === 'done' && (
                      <span className={`text-xs font-medium flex-shrink-0 ${row.granted ? 'text-green-600' : 'text-red-500'}`}>
                        {row.granted ? 'Granted' : 'Missing'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Done ──────────────────────────────────────────────── */}
          {authStep === 'done' && user && (
            <div className="space-y-4">
              {/* Signed-in banner */}
              <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-800">Signed in successfully</p>
                  <p className="text-xs text-green-700">{user.name} · {user.upn}</p>
                </div>
              </div>

              {/* Settled permission list */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permission Check</p>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {permissions.map(p => (
                    <div key={p.scope} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                      {p.granted ? (
                        <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-gray-800 truncate">{p.scope}</p>
                        <p className="text-xs text-gray-400">{SCOPE_LABELS[p.scope] ?? p.description}</p>
                      </div>
                      <span className={`text-xs font-medium flex-shrink-0 ${p.granted ? 'text-green-600' : 'text-red-500'}`}>
                        {p.granted ? 'Granted' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {missingPerms.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                  <p className="font-semibold mb-1">⚠ {missingPerms.length} permission{missingPerms.length > 1 ? 's' : ''} missing</p>
                  <p>Some features may not work. Add the missing permissions to your Entra app registration, then re-sign in.</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                {missingPerms.length > 0 && (
                  <button
                    onClick={() => setAuthStep('idle')}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Re-sign in
                  </button>
                )}
                <button
                  onClick={handleContinue}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors flex-1 ${
                    allGranted ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {allGranted ? "You're all set — Enter app →" : 'Continue anyway →'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-blue-200 mt-4">
          Authentication uses Microsoft's device code flow — your password is never sent to this app.
        </p>
      </div>
    </div>
  )
}
