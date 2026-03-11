import { Link } from 'react-router-dom'
import { Star, Download } from 'lucide-react'
import HardwareBadge from './HardwareBadge'
import InstallButton from './InstallButton'

function AppIcon({ app, size = 56 }) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316']
  const color = colors[(app.name?.charCodeAt(0) || 0) % colors.length]
  const fallback = (
    <div
      className="rounded-xl flex items-center justify-center font-bold text-white/90 shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}cc, ${color}88)`, fontSize: size * 0.4 }}
    >
      {app.name?.[0]?.toUpperCase() || '?'}
    </div>
  )
  if (!app.icon_path) return fallback
  return (
    <div style={{ width: size, height: size, position: 'relative' }} className="shrink-0">
      <img
        src={app.icon_path}
        alt={app.name}
        className="rounded-xl object-cover"
        style={{ width: size, height: size }}
        onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }}
      />
      <div
        className="rounded-xl items-center justify-center font-bold text-white/90"
        style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}cc, ${color}88)`, fontSize: size * 0.4, display: 'none', position: 'absolute', top: 0, left: 0 }}
      >
        {app.name?.[0]?.toUpperCase() || '?'}
      </div>
    </div>
  )
}

export default function AppCard({ app, index = 0 }) {
  const hardware = app.required_hardware || []

  return (
    <div
      className="card group p-4 flex flex-col gap-3 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to={`/app/${app.slug}`}>
          <AppIcon app={app} size={52} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/app/${app.slug}`} className="hover:text-indigo-300 transition-colors">
            <h3 className="font-semibold text-sm leading-tight line-clamp-1">{app.name}</h3>
          </Link>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{app.developer?.username || 'Community'}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-1">
              <Star size={12} className="text-amber-400" fill="currentColor" />
              <span className="text-xs mono text-slate-400">{app.avg_rating?.toFixed(1) || '—'}</span>
            </div>
            <span className="text-slate-700">·</span>
            <div className="flex items-center gap-1 text-slate-500 text-xs">
              <Download size={12} />
              <span className="mono">{app.downloads_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{app.description}</p>

      {/* Hardware badges */}
      {hardware.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {hardware.slice(0, 3).map(h => <HardwareBadge key={h} tag={h} />)}
          {hardware.length > 3 && <span className="text-[10px] text-slate-500">+{hardware.length - 3}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-xs text-slate-600 font-medium">{app.category?.name || app.category}</span>
        <InstallButton storeApp={app} size="sm" />
      </div>
    </div>
  )
}

export { AppIcon }
