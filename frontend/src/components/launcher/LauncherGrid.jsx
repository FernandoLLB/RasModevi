import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import LauncherAppIcon from './LauncherAppIcon'
import { useDevice } from '../../context/DeviceContext'

export default function LauncherGrid() {
  const { installedApps, loading } = useDevice()

  // grid-cols-3 base (mobile portrait)
  // sm: 4 cols (640px+)
  // md: 5 cols (Pi 800px — md breakpoint 768px applies)
  // lg: 6 cols (desktop)
  const gridClass = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6 p-4 sm:p-6'

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="skeleton rounded-2xl" style={{ width: 76, height: 76 }} />
            <div className="skeleton h-3 w-14 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={gridClass}>
      {installedApps.map(app => (
        <LauncherAppIcon key={app.id} app={app} />
      ))}

      {/* Add more apps */}
      <div className="flex flex-col items-center gap-2">
        <Link
          to="/"
          className="w-[76px] h-[76px] rounded-2xl flex items-center justify-center bg-white/[0.04] border-2 border-dashed border-white/[0.1] hover:bg-white/[0.07] hover:border-white/[0.2] transition-all text-slate-500 hover:text-slate-300"
        >
          <Plus size={28} />
        </Link>
        <span className="text-xs text-slate-500">Más apps</span>
      </div>
    </div>
  )
}
