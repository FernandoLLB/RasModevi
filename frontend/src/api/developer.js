import { api, apiFetch } from './client'

export const developerApi = {
  getMyApps: () => api.get('/api/developer/apps'),
  createApp: (data) => api.post('/api/developer/apps', data),
  updateApp: (id, data) => api.put(`/api/developer/apps/${id}`, data),
  deleteApp: (id) => api.delete(`/api/developer/apps/${id}`),
  uploadPackage: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return apiFetch(`/api/developer/apps/${id}/upload`, { method: 'POST', body: form })
  },
}
