import { Download, Play, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDevice } from '../../context/DeviceContext'

export default function InstallButton({ storeApp, size = 'sm', fullWidth = false }) {
  const { installedApps, installingIds, install, activate } = useDevice()
  const navigate = useNavigate()
  const installed = installedApps.find(a => a.store_app_id === storeApp.id)
  const isInstalling = installingIds.has(storeApp.id)

  const cls = [
    size === 'sm'
      ? 'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap'
      : 'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap',
    fullWidth ? 'w-full justify-center' : '',
  ].join(' ')

  if (isInstalling) {
    return (
      <button disabled className={`${cls} bg-white/[0.06] text-slate-400`}>
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
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
        <Download size={size === 'sm' ? 14 : 16} />
        Instalar
      </button>
    )
  }

  const handleOpen = async () => {
    if (!installed.is_active) await activate(installed.id)
    navigate(`/running/${installed.id}`)
  }

  return (
    <button
      onClick={handleOpen}
      className={`${cls} ${
        installed.is_active
          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
          : 'bg-violet-500 hover:bg-violet-600 text-white shadow-lg shadow-violet-500/20'
      }`}
    >
      {installed.is_active && (
        <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-pulse" />
      )}
      <Play size={size === 'sm' ? 14 : 16} fill="currentColor" />
      Abrir
    </button>
  )
}
