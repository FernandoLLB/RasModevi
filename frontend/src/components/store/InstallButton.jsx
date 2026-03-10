import { Download, Play, Square, Loader2 } from 'lucide-react'
import { useDevice } from '../../context/DeviceContext'

export default function InstallButton({ storeApp, size = 'sm' }) {
  const { installedApps, installingIds, install, uninstall, activate, deactivate } = useDevice()
  const installed = installedApps.find(a => a.store_app_id === storeApp.id)
  const isInstalling = installingIds.has(storeApp.id)

  const cls = size === 'sm'
    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap'
    : 'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap'

  if (isInstalling) {
    return (
      <button disabled className={`${cls} bg-white/[0.06] text-slate-400`}>
        <Loader2 size={size === 'sm' ? 12 : 16} className="animate-spin" />
        Instalando...
      </button>
    )
  }

  if (!installed) {
    return (
      <button
        onClick={() => install(storeApp.id)}
        className={`${cls} bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20`}
      >
        <Download size={size === 'sm' ? 12 : 16} />
        Instalar
      </button>
    )
  }

  if (installed.is_active) {
    return (
      <button
        onClick={() => deactivate(installed.id)}
        className={`${cls} bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25`}
      >
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        Activa
      </button>
    )
  }

  return (
    <button
      onClick={() => activate(installed.id)}
      className={`${cls} bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25`}
    >
      <Play size={size === 'sm' ? 12 : 16} />
      Activar
    </button>
  )
}
