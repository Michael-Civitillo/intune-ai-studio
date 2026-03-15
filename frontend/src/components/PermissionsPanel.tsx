interface Permission {
  scope: string
  granted: boolean
  description: string
}

interface Props {
  permissions: Permission[]
  loading: boolean
  onClose: () => void
}

export default function PermissionsPanel({ permissions, loading, onClose }: Props) {
  const allGranted = permissions.length > 0 && permissions.every(p => p.granted)
  const missingCount = permissions.filter(p => !p.granted).length

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-96 bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="font-semibold text-gray-900">Permissions</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Summary banner */}
              {allGranted ? (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-green-800 font-medium">All required permissions granted</p>
                </div>
              ) : missingCount > 0 ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-sm text-amber-800 font-medium">{missingCount} permission{missingCount > 1 ? 's' : ''} missing</p>
                  <p className="text-xs text-amber-700 mt-0.5">Some features may not work. Re-authenticate after granting permissions in your Entra app registration.</p>
                </div>
              ) : null}

              <div className="space-y-2">
                {permissions.map(p => (
                  <div key={p.scope} className="flex items-start gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
                    {p.granted ? (
                      <svg className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <div>
                      <p className="text-xs font-mono text-gray-800">{p.scope}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500">
            To grant missing permissions: go to your Entra app registration → API permissions → add the required scopes → have an admin grant consent → re-authenticate here.
          </p>
        </div>
      </div>
    </div>
  )
}
