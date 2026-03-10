import { api } from './client'

export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  me: () => api.get('/api/auth/me'),
}
