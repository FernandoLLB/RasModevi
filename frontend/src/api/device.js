import { api } from './client'

export const deviceApi = {
  getInstalled: () => api.get('/api/device/apps'),
  getActive: () => api.get('/api/device/apps/active'),
  install: (storeAppId) => api.post(`/api/device/apps/${storeAppId}/install`),
  uninstall: (installedId) => api.post(`/api/device/apps/${installedId}/uninstall`),
  activate: (installedId) => api.post(`/api/device/apps/${installedId}/activate`),
  deactivate: (installedId) => api.post(`/api/device/apps/${installedId}/deactivate`),
  launch: (installedId) => api.post(`/api/device/apps/${installedId}/launch`),
}
