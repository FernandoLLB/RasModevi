import { api } from './client'

export const systemApi = {
  getInfo: () => api.get('/api/system/info'),
  getStats: () => api.get('/api/system/stats'),
}
