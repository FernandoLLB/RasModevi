const BASE = ''

let _refreshPromise = null

async function refreshTokens() {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) throw new Error('No refresh token')
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })
  if (!res.ok) throw new Error('Refresh failed')
  const data = await res.json()
  localStorage.setItem('access_token', data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  return data.access_token
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('access_token')
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options.body instanceof FormData) delete headers['Content-Type']

  let res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401 && token) {
    if (!_refreshPromise) _refreshPromise = refreshTokens().finally(() => { _refreshPromise = null })
    try {
      const newToken = await _refreshPromise
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${BASE}${path}`, { ...options, headers })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.dispatchEvent(new Event('auth:logout'))
    }
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try { const err = await res.json(); detail = err.detail || detail } catch {}
    throw new Error(detail)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
}
