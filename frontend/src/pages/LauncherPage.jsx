import { Link } from 'react-router-dom'
import { Store, Settings } from 'lucide-react'
import LauncherGrid from '../components/launcher/LauncherGrid'
import Logo from '../components/Logo'
import { useDevice } from '../context/DeviceContext'
import { useState, useEffect } from 'react'

function Clock24() {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div className="text-right">
      <div className="mono text-2xl font-light text-slate-200">
        {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-xs text-slate-500">
        {time.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
    </div>
  )
}

export default function LauncherPage() {
  const { installedApps } = useDevice()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-5xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-sm font-bold gradient-text">ModevI</span>
        </Link>
        <Clock24 />
      </div>

      {/* App grid */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-5xl mx-auto">
          {installedApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
              <div className="text-5xl mb-4 opacity-20">📱</div>
              <p className="text-slate-400 text-sm mb-3">No hay apps instaladas</p>
              <Link
                to="/"
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-sm font-semibold hover:bg-indigo-500/25 transition-colors min-h-[48px]"
              >
                Explorar la tienda
              </Link>
            </div>
          ) : (
            <LauncherGrid />
          )}
        </div>
      </div>

      {/* Dock */}
      <div className="flex items-center justify-center gap-4 pb-6 px-4">
        <div className="flex items-center gap-3 glass rounded-2xl px-5 py-3">
          <Link to="/" className="flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors min-w-[68px] min-h-[56px] justify-center">
            <Store size={22} className="text-slate-300" />
            <span className="text-xs text-slate-400">Tienda</span>
          </Link>
          <div className="w-px h-8 bg-white/[0.08]" />
          <Link to="/settings" className="flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors min-w-[68px] min-h-[56px] justify-center">
            <Settings size={22} className="text-slate-300" />
            <span className="text-xs text-slate-400">Ajustes</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
