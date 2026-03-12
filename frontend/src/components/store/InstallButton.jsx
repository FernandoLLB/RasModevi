import { useState } from 'react'
import { Download, Play, Loader2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDevice } from '../../context/DeviceContext'

export default function InstallButton({ storeApp, size = 'sm', fullWidth = false }) {
  const { installedApps, installingIds, install, activate } = useDevice()
  const navigate = useNavigate()
  const [installError, setInstallError] = useState(null)
  const installed = installedApps.find(a => a.store_app_id === storeApp.id)
  const isInstalling = installingIds.has(storeApp.id)

  const cls = [
    size === 'sm'
      ? 'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap min-h-[44px]'
      : 'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap min-h-[48px]',
    fullWidth ? 'w-full justify-center' : '',
  ].join(' ')

  if (isInstalling) {
    return (
      <button disabled className={`${cls} bg-white/[0.06] text-slate-400`}>
        <Loader2 size={size === 'sm' ? 15 : 16} className="animate-spin" />
        Instalando...
      </button>
    )
  }

  if (!installed) {
    const handleInstall = async () => {
      setInstallError(null)
      try {
        await install(storeApp.id)
      } catch (e) {
        setInstallError(String(e?.message || 'Error al instalar'))
      }
    }
    return (
      <div className={fullWidth ? 'w-full' : ''}>
        <button
          onClick={handleInstall}
          className={`${cls} ${installError
            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
            : 'bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          {installError
            ? <><AlertCircle size={size === 'sm' ? 15 : 16} /> Error — reintentar</>
            : <><Download size={size === 'sm' ? 15 : 16} /> Instalar</>
          }
        </button>
        {installError && (
          <p className="text-[11px] text-red-400/80 mt-1 leading-snug">{installError}</p>
        )}
      </div>
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
          ? 'bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-lg shadow-emerald-500/20'
          : 'bg-violet-500 hover:bg-violet-600 active:scale-95 text-white shadow-lg shadow-violet-500/20'
      }`}
    >
      {installed.is_active && (
        <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-pulse" />
      )}
      <Play size={size === 'sm' ? 15 : 16} fill="currentColor" />
      Abrir
    </button>
  )
}
