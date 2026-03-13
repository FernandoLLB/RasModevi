import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
    const handler = () => setUser(null)
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [loadUser])

  const login = async (username, password) => {
    const data = await authApi.login(username, password)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const me = await authApi.me()
    setUser(me)
    return me
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  const register = async (formData) => {
    const newUser = await authApi.register(formData)
    return newUser
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      role: user?.role,
      isDeveloper: !!user,
      isAdmin: user?.role === 'admin',
      login,
      logout,
      register,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
