import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getMe, getSetupStatus } from './api/client'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import BulkAddPage from './pages/BulkAddPage'
import GroupAuditPage from './pages/GroupAuditPage'
import GroupMembersPage from './pages/GroupMembersPage'
import GroupSyncPage from './pages/GroupSyncPage'
import SetupWizard from './pages/SetupWizard'

type AppState = 'loading' | 'setup' | 'auth' | 'ready'

export interface User {
  name: string
  upn: string
}

export default function App() {
  const [state, setState] = useState<AppState>('loading')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    bootstrap()
  }, [])

  async function bootstrap() {
    try {
      const setup = await getSetupStatus()
      if (!setup.configured) {
        setState('setup')
        return
      }
      const me = await getMe()
      setUser(me)
      setState('ready')
    } catch {
      setState('auth')
    }
  }

  function handleSetupComplete() {
    setState('auth')
  }

  function handleAuthComplete(u: User) {
    setUser(u)
    setState('ready')
  }

  function handleLogout() {
    setUser(null)
    setState('auth')
  }

  if (state === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (state === 'setup') {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  if (state === 'auth') {
    return <AuthPage onAuthenticated={handleAuthComplete} />
  }

  return (
    <BrowserRouter>
      <Layout user={user!} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/bulk-add" replace />} />
          <Route path="/bulk-add" element={<BulkAddPage />} />
          <Route path="/group-audit" element={<GroupAuditPage />} />
          <Route path="/group-members" element={<GroupMembersPage />} />
          <Route path="/group-sync" element={<GroupSyncPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
