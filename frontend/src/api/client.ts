import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Surface FastAPI's `detail` field as the error message so all pages
// show the real reason instead of the generic "Request failed with status 500".
api.interceptors.response.use(
  r => r,
  err => {
    const detail = err.response?.data?.detail
    if (detail) {
      err.message = typeof detail === 'string' ? detail : JSON.stringify(detail)
    }
    return Promise.reject(err)
  }
)

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const getDashboard = () => api.get('/dashboard').then(r => r.data)
export const getServiceHealth = () => api.get('/health/services').then(r => r.data)

// ── Setup ─────────────────────────────────────────────────────────────────────

export const getSetupStatus = () => api.get('/setup/status').then(r => r.data)
export const validateSetup = (client_id: string, tenant_id: string) =>
  api.post('/setup/validate', { client_id, tenant_id }).then(r => r.data)
export const saveSetup = (client_id: string, tenant_id: string) =>
  api.post('/setup/save', { client_id, tenant_id }).then(r => r.data)

// ── Auth ──────────────────────────────────────────────────────────────────────

export const startAuth = () => api.post('/auth/start').then(r => r.data)
export const pollAuth = () => api.get('/auth/poll').then(r => r.data)
export const getMe = () => api.get('/auth/me').then(r => r.data)
export const getPermissions = () => api.get('/auth/permissions').then(r => r.data)
export const logout = () => api.post('/auth/logout').then(r => r.data)

// ── Groups ────────────────────────────────────────────────────────────────────

export const searchGroups = (q: string) =>
  api.get('/groups/search', { params: { q } }).then(r => r.data)
export const getGroup = (id: string) => api.get(`/groups/${id}`).then(r => r.data)
export const getGroupMembers = (id: string) =>
  api.get(`/groups/${id}/members`).then(r => r.data)
export const getGroupAudit = (id: string) =>
  api.get(`/groups/${id}/audit`).then(r => r.data)

export const exportMembersUrl = (id: string) => `/api/groups/${id}/members/export`
export const exportAuditUrl = (id: string) => `/api/groups/${id}/audit/export`

// ── Devices ───────────────────────────────────────────────────────────────────

export const bulkAddDevices = (group_id: string, device_names: string[]) =>
  api.post('/devices/bulk-add', { group_id, device_names }).then(r => r.data)

export const syncGroupDevices = (group_id: string) =>
  api.post(`/groups/${group_id}/sync`).then(r => r.data)

// ── AI Features ──────────────────────────────────────────────────────────────

export const getAIStatus = () => api.get('/ai/status').then(r => r.data)
export const saveAISetup = (api_key: string) =>
  api.post('/ai/setup', { api_key }).then(r => r.data)
export const deviceSearch = (query: string) =>
  api.post('/ai/device-search', { query }).then(r => r.data)
