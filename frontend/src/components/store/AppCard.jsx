import { Link } from 'react-router-dom'
import { Star, Download } from 'lucide-react'
import HardwareBadge from './HardwareBadge'
import InstallButton from './InstallButton'

function AppIcon({ app, size = 52 }) {
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
      className="card group p-3 sm:p-4 flex flex-col gap-2.5 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <Link to={`/app/${app.slug}`} className="shrink-0">
          <AppIcon app={app} size={48} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/app/${app.slug}`} className="hover:text-indigo-300 transition-colors">
            <h3 className="font-semibold text-sm leading-tight line-clamp-1">{app.name}</h3>
          </Link>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{app.developer?.username || 'Community'}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <Star size={11} className="text-amber-400" fill="currentColor" />
              <span className="text-xs mono text-slate-400">{app.avg_rating?.toFixed(1) || '—'}</span>
            </div>
            <span className="text-slate-700 text-xs">·</span>
            <div className="flex items-center gap-1 text-slate-500 text-xs">
              <Download size={11} />
              <span className="mono">{app.downloads_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{app.description}</p>

      {/* Hardware badges — only on sm+ to avoid cramping on mobile 2-col grid */}
      {hardware.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-1">
          {hardware.slice(0, 3).map(h => <HardwareBadge key={h} tag={h} />)}
          {hardware.length > 3 && <span className="text-[10px] text-slate-500">+{hardware.length - 3}</span>}
        </div>
      )}

      {/* Footer: category label on sm+, install button always full-width */}
      <div className="mt-auto pt-1">
        <div className="hidden sm:block text-xs text-slate-600 font-medium mb-1.5">
          {app.category?.name || app.category}
        </div>
        <InstallButton storeApp={app} size="sm" fullWidth />
      </div>
    </div>
  )
}

export { AppIcon }
