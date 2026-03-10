import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { deviceApi } from '../api/device'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const [installedApps, setInstalledApps] = useState([])
  const [activeApp, setActiveApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [installingIds, setInstallingIds] = useState(new Set())

  const refresh = useCallback(async () => {
    try {
      const apps = await deviceApi.getInstalled()
      setInstalledApps(apps)
      const active = apps.find(a => a.is_active) || null
      setActiveApp(active)
    } catch (e) {
      console.error('Device refresh error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const install = async (storeAppId) => {
    setInstallingIds(s => new Set(s).add(storeAppId))
    try {
      await deviceApi.install(storeAppId)
      await refresh()
    } finally {
      setInstallingIds(s => { const n = new Set(s); n.delete(storeAppId); return n })
    }
  }

  const uninstall = async (installedId) => {
    await deviceApi.uninstall(installedId)
    await refresh()
  }

  const activate = async (installedId) => {
    await deviceApi.activate(installedId)
    await refresh()
  }

  const deactivate = async (installedId) => {
    await deviceApi.deactivate(installedId)
    await refresh()
  }

  const getInstalledByStoreId = (storeAppId) =>
    installedApps.find(a => a.store_app_id === storeAppId)

  return (
    <DeviceContext.Provider value={{
      installedApps,
      activeApp,
      loading,
      installingIds,
      install,
      uninstall,
      activate,
      deactivate,
      getInstalledByStoreId,
      refresh,
    }}>
      {children}
    </DeviceContext.Provider>
  )
}

export const useDevice = () => useContext(DeviceContext)
