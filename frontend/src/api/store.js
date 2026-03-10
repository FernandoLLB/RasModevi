import { api } from './client'

export const storeApi = {
  getApps: (filters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    const qs = params.toString()
    return api.get(`/api/store/apps${qs ? '?' + qs : ''}`)
  },
  getApp: (slug) => api.get(`/api/store/apps/${slug}`),
  getCategories: () => api.get('/api/store/categories'),
  getHardwareTags: () => api.get('/api/store/hardware-tags'),
  getRatings: (slug) => api.get(`/api/store/apps/${slug}/ratings`),
  createRating: (slug, data) => api.post(`/api/store/apps/${slug}/rate`, data),
  deleteRating: (slug) => api.delete(`/api/store/apps/${slug}/rate`),
}
