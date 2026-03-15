import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { User } from '../App'
import { getPermissions, logout as apiLogout } from '../api/client'
import PermissionsPanel from './PermissionsPanel'

interface Permission {
  scope: string
  granted: boolean
  description: string
}

interface LayoutProps {
  user: User
  onLogout: () => void
  children: React.ReactNode
}

const navItems = [
  {
    to: '/bulk-add',
    label: 'Bulk Device Add',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    to: '/group-audit',
    label: 'Group Audit',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: '/group-members',
    label: 'Group Members',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
      </svg>
    ),
  },
]

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const [showPermissions, setShowPermissions] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [permError, setPermError] = useState('')

  async function handleShowPermissions() {
    setShowPermissions(true)
    setLoadingPerms(true)
    setPermError('')
    try {
      const data = await getPermissions()
      setPermissions(data)
    } catch (e: unknown) {
      setPermError(e instanceof Error ? e.message : 'Failed to load permissions')
    } finally {
      setLoadingPerms(false)
    }
  }

  async function handleLogout() {
    await apiLogout()
    onLogout()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-700">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Intune Toolbox</p>
            <p className="text-xs text-gray-400">Admin Tools</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-fuchsia-50 text-fuchsia-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 space-y-1">
          <button
            onClick={handleShowPermissions}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Check Permissions</span>
          </button>

          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-700 text-xs font-semibold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-400">{user.upn}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Permissions panel */}
      {showPermissions && (
        <PermissionsPanel
          permissions={permissions}
          loading={loadingPerms}
          error={permError}
          onClose={() => setShowPermissions(false)}
        />
      )}
    </div>
  )
}
