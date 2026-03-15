import { useEffect, useState } from 'react'
import { User } from '../App'
import { getDashboard } from '../api/client'

interface DashboardData {
  tenantName: string
  totalDevices: number
  osCounts: {
    windows: number
    macOS: number
    iOS: number
    android: number
    other: number
  }
  rawOsCounts: Record<string, number>
}

interface Props {
  user: User
}

const OS_CARDS = [
  {
    key: 'windows' as const,
    label: 'Windows',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 5.557L10.025 4.5v6.956H3V5.557zm0 12.886L10.025 19.5v-6.956H3v5.899zm7.975-13.015L21 3v8.456h-10.025V5.428zm0 13.143v-6.956H21V21l-10.025-1.414z" />
      </svg>
    ),
    color: 'from-blue-600 to-blue-800',
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    border: 'border-blue-200',
  },
  {
    key: 'macOS' as const,
    label: 'macOS',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
      </svg>
    ),
    color: 'from-gray-600 to-gray-800',
    bg: 'bg-gray-50',
    text: 'text-gray-900',
    border: 'border-gray-200',
  },
  {
    key: 'iOS' as const,
    label: 'iOS / iPadOS',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.44c1.39.07 2.35.74 3.15.77 1.2-.24 2.35-.93 3.62-.84 1.54.12 2.7.72 3.47 1.86-3.21 1.9-2.68 6.13.56 7.34-.57 1.48-1.3 2.93-2.8 4.71zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
    ),
    color: 'from-slate-600 to-slate-800',
    bg: 'bg-slate-50',
    text: 'text-slate-900',
    border: 'border-slate-200',
  },
  {
    key: 'android' as const,
    label: 'Android',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.523 15.341a1.004 1.004 0 01-1.005-1.002 1.004 1.004 0 011.005-1.002 1.003 1.003 0 011.004 1.002 1.003 1.003 0 01-1.004 1.002zm-11.047 0a1.003 1.003 0 01-1.004-1.002 1.003 1.003 0 011.004-1.002 1.004 1.004 0 011.005 1.002 1.004 1.004 0 01-1.005 1.002zm11.4-6.512l1.997-3.46a.418.418 0 00-.152-.571.418.418 0 00-.572.152L17.13 8.44A11.65 11.65 0 0012 7.342c-1.798 0-3.5.41-5.13 1.1L4.852 5.95a.418.418 0 00-.572-.152.418.418 0 00-.152.571l1.997 3.46C3.534 11.2 2 13.739 2 16.595h20c0-2.856-1.534-5.395-4.124-6.766z" />
      </svg>
    ),
    color: 'from-green-600 to-green-800',
    bg: 'bg-green-50',
    text: 'text-green-900',
    border: 'border-green-200',
  },
]

function StatCard({ label, value, icon, color, bg, text, border }: {
  label: string; value: number; icon: React.ReactNode
  color: string; bg: string; text: string; border: string
}) {
  return (
    <div className={`rounded-xl border ${border} ${bg} p-5 flex items-center gap-4`}>
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold ${text}`}>{value.toLocaleString()}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage({ user }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user.name.split(' ')[0]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here's a snapshot of your Intune environment.
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-violet-700 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading tenant data…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 mb-6">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Tenant + user info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-900 to-purple-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300 mb-1">Tenant</p>
              <p className="text-xl font-bold truncate">{data.tenantName}</p>
              <p className="text-sm text-violet-300 mt-1 truncate">{user.upn}</p>
            </div>
            <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-900 to-violet-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-300 mb-1">Managed Devices</p>
              <p className="text-4xl font-bold">{data.totalDevices.toLocaleString()}</p>
              <p className="text-sm text-purple-300 mt-1">enrolled in Intune</p>
            </div>
          </div>

          {/* Per-OS breakdown */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Device breakdown by OS</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {OS_CARDS.map(card => (
                <StatCard
                  key={card.key}
                  label={card.label}
                  value={data.osCounts[card.key]}
                  icon={card.icon}
                  color={card.color}
                  bg={card.bg}
                  text={card.text}
                  border={card.border}
                />
              ))}
            </div>
          </div>

          {/* Other / unknown if any */}
          {data.osCounts.other > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 flex items-center gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-500 to-gray-700 text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900">{data.osCounts.other.toLocaleString()} other / unknown</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {Object.entries(data.rawOsCounts)
                    .filter(([k]) => !['Windows', 'macOS', 'iOS', 'Android'].includes(k))
                    .map(([k, v]) => `${k} (${v})`)
                    .join(' · ') || 'Various platforms'}
                </p>
              </div>
            </div>
          )}

          {/* Quick links */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick actions</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { to: '/bulk-add', label: 'Bulk Device Add', desc: 'Add devices to a group', emoji: '➕' },
                { to: '/group-audit', label: 'Group Audit', desc: 'Check before deleting', emoji: '🔍' },
                { to: '/group-members', label: 'Group Members', desc: 'Browse group devices', emoji: '👥' },
                { to: '/group-sync', label: 'Force Sync', desc: 'Push Intune sync now', emoji: '🔄' },
              ].map(link => (
                <a
                  key={link.to}
                  href={link.to}
                  className="rounded-xl border border-gray-200 bg-white p-4 hover:border-violet-300 hover:bg-violet-50 transition-colors group"
                >
                  <span className="text-2xl mb-2 block">{link.emoji}</span>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-900">{link.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{link.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
