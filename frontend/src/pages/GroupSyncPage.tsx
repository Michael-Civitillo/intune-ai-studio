import { useEffect, useRef, useState } from 'react'
import GroupSearch from '../components/GroupSearch'

interface Group {
  id: string
  displayName: string
}

type DeviceStatus = 'pending' | 'resolving' | 'syncing' | 'synced' | 'not_managed' | 'error'
type SyncPhase = 'idle' | 'discovering' | 'resolving' | 'syncing' | 'done' | 'error'

interface DeviceState {
  entraId: string
  name: string
  os: string
  status: DeviceStatus
  message?: string
}

interface SyncSummary {
  total: number
  synced: number
  not_managed: number
  errors: number
}

// ── Animated device circle ──────────────────────────────────────────────────

function DeviceCircle({ device }: { device: DeviceState }) {
  const statusConfig: Record<DeviceStatus, { bg: string; border: string; icon: JSX.Element; spin?: boolean }> = {
    pending: {
      bg: 'bg-gray-50',
      border: 'border-dashed border-gray-300',
      icon: <span className="text-gray-300 text-xs">·</span>,
    },
    resolving: {
      bg: 'bg-violet-50',
      border: 'border-violet-300',
      icon: (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      ),
    },
    syncing: {
      bg: 'bg-violet-100',
      border: 'border-violet-500',
      icon: (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-700 border-t-transparent" />
      ),
    },
    synced: {
      bg: 'bg-green-100',
      border: 'border-green-500',
      icon: (
        <svg className="h-3 w-3 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    not_managed: {
      bg: 'bg-gray-100',
      border: 'border-gray-300',
      icon: <span className="text-gray-400 font-bold text-xs">—</span>,
    },
    error: {
      bg: 'bg-red-100',
      border: 'border-red-400',
      icon: (
        <svg className="h-3 w-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  }

  const cfg = statusConfig[device.status]
  const title = `${device.name}${device.os ? ` (${device.os})` : ''}${device.message ? ` — ${device.message}` : ''}`

  return (
    <div
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500 ${cfg.bg} ${cfg.border} cursor-default`}
    >
      {cfg.icon}
    </div>
  )
}

// ── Phase stepper ────────────────────────────────────────────────────────────

const PHASES: { key: SyncPhase; label: string }[] = [
  { key: 'discovering', label: 'Discovering' },
  { key: 'resolving', label: 'Resolving' },
  { key: 'syncing', label: 'Syncing' },
  { key: 'done', label: 'Done' },
]

function PhaseStepper({ phase }: { phase: SyncPhase }) {
  const activeIdx = PHASES.findIndex(p => p.key === phase)

  return (
    <div className="flex items-center gap-0 mb-5">
      {PHASES.map((p, i) => {
        const isDone = i < activeIdx || phase === 'done'
        const isActive = i === activeIdx && phase !== 'done'
        return (
          <div key={p.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-violet-800 text-white ring-2 ring-violet-300'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isDone ? (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-1 text-xs whitespace-nowrap ${
                  isDone ? 'text-green-600' : isActive ? 'text-violet-800 font-medium' : 'text-gray-400'
                }`}
              >
                {p.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`h-0.5 w-10 mx-1 mb-4 transition-all duration-500 ${i < activeIdx || phase === 'done' ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────

function SyncModal({
  groupName,
  devices,
  phase,
  summary,
  errorMsg,
  onClose,
}: {
  groupName: string
  devices: DeviceState[]
  phase: SyncPhase
  summary: SyncSummary | null
  errorMsg: string
  onClose: () => void
}) {
  const isDone = phase === 'done' || phase === 'error'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-800 to-purple-900 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Force Sync — {groupName}</h2>
            <p className="text-xs text-violet-200 mt-0.5">Triggering immediate Intune check-in</p>
          </div>
          {isDone && (
            <button
              onClick={onClose}
              className="rounded-lg bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          <PhaseStepper phase={phase} />

          {/* Error state */}
          {phase === 'error' && errorMsg && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          {/* Device grid */}
          {devices.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-gray-500 mb-2 font-medium">
                {devices.length} device{devices.length !== 1 ? 's' : ''} — hover for details
              </p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                {devices.map(d => (
                  <DeviceCircle key={d.entraId} device={d} />
                ))}
              </div>
            </div>
          )}

          {/* Discovering spinner */}
          {phase === 'discovering' && devices.length === 0 && (
            <div className="flex items-center gap-3 text-sm text-gray-500 py-4">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent flex-shrink-0" />
              Discovering devices in group…
            </div>
          )}

          {/* Summary cards */}
          {summary && phase === 'done' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-3 text-center">
                <p className="text-2xl font-bold text-green-700">{summary.synced}</p>
                <p className="text-xs text-green-600 mt-0.5">Synced ✓</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 text-center">
                <p className="text-2xl font-bold text-gray-500">{summary.not_managed}</p>
                <p className="text-xs text-gray-400 mt-0.5">Not in Intune</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-center">
                <p className="text-2xl font-bold text-red-700">{summary.errors}</p>
                <p className="text-xs text-red-600 mt-0.5">Errors</p>
              </div>
            </div>
          )}

          {/* All synced celebration */}
          {summary && phase === 'done' && summary.synced === summary.total && summary.total > 0 && (
            <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800 text-center">
              🎉 All {summary.total} devices synced successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GroupSyncPage() {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Modal state
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle')
  const [devices, setDevices] = useState<DeviceState[]>([])
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [syncError, setSyncError] = useState('')

  const abortRef = useRef<AbortController | null>(null)

  function handleGroupSelect(group: Group) {
    setSelectedGroup(group)
    setConfirmed(false)
  }

  async function handleSync() {
    if (!selectedGroup || !confirmed) return

    // Reset modal state
    setDevices([])
    setSummary(null)
    setSyncError('')
    setSyncPhase('discovering')
    setShowModal(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const response = await fetch(`/api/groups/${selectedGroup.id}/sync/stream`, {
        signal: ctrl.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }))
        setSyncError(err.detail ?? `HTTP ${response.status}`)
        setSyncPhase('error')
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // Track live counts for summary
      let liveTotal = 0
      let liveSynced = 0
      let liveNotManaged = 0
      let liveErrors = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))

          if (payload.type === 'phase') {
            setSyncPhase(payload.phase as SyncPhase)
          } else if (payload.type === 'devices_found') {
            liveTotal = payload.total
            const initialDevices: DeviceState[] = payload.devices.map((d: { entraId: string; name: string; os: string }) => ({
              entraId: d.entraId,
              name: d.name,
              os: d.os,
              status: 'pending' as DeviceStatus,
            }))
            setDevices(initialDevices)
          } else if (payload.type === 'device_result') {
            if (payload.status === 'synced') liveSynced++
            else if (payload.status === 'not_managed') liveNotManaged++
            else if (payload.status === 'error') liveErrors++

            setDevices(prev =>
              prev.map(d =>
                d.entraId === payload.entraId
                  ? { ...d, status: payload.status as DeviceStatus, message: payload.message }
                  : d
              )
            )
          } else if (payload.type === 'complete') {
            setSummary({
              total: liveTotal,
              synced: liveSynced,
              not_managed: liveNotManaged,
              errors: liveErrors,
            })
            setSyncPhase('done')
          } else if (payload.type === 'error') {
            setSyncError(payload.message)
            setSyncPhase('error')
          }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setSyncError(e instanceof Error ? e.message : 'Sync failed')
        setSyncPhase('error')
      }
    } finally {
      setConfirmed(false)
    }
  }

  function handleModalClose() {
    abortRef.current?.abort()
    setShowModal(false)
    setSyncPhase('idle')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Force Sync Devices</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Trigger an immediate Intune sync for all managed devices in a group — no more waiting for the scheduled check-in window.
        </p>
      </div>

      {/* Step 1: Select group */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-800 to-purple-900 text-white text-xs">
            1
          </span>
          Select target group
        </h2>
        <GroupSearch onSelect={handleGroupSelect} />
      </div>

      {/* Step 2: Confirm & trigger */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-800 to-purple-900 text-white text-xs">
            2
          </span>
          Confirm & sync
        </h2>

        {!selectedGroup && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
            Select a target group above
          </div>
        )}

        {selectedGroup && (
          <>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm">
              <p className="font-medium text-amber-800">
                ⚠️ This will trigger an immediate sync on <strong>all Intune-managed devices</strong> in{' '}
                <strong>{selectedGroup.displayName}</strong>.
              </p>
              <p className="mt-1 text-amber-700">
                Entra devices not enrolled in Intune will be skipped automatically.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              I understand — sync all managed devices in <strong className="ml-1">{selectedGroup.displayName}</strong>
            </label>
          </>
        )}

        <button
          onClick={handleSync}
          disabled={!selectedGroup || !confirmed}
          className="w-full rounded-lg bg-violet-800 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {selectedGroup ? `Sync All Devices in ${selectedGroup.displayName}` : 'Sync All Devices'}
          </span>
        </button>
      </div>

      {/* Live sync modal */}
      {showModal && selectedGroup && (
        <SyncModal
          groupName={selectedGroup.displayName}
          devices={devices}
          phase={syncPhase}
          summary={summary}
          errorMsg={syncError}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
