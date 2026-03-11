import { Star, Download, Tag } from 'lucide-react'
import { AppIcon } from '../store/AppCard'
import HardwareBadge from '../store/HardwareBadge'
import InstallButton from '../store/InstallButton'
import RatingStars from '../store/RatingStars'

export default function AppDetailHeader({ app }) {
  const hardware = app.required_hardware || []

  return (
    <div className="mb-8 animate-fade-up">
      {/* Icon + title: stacked on mobile, row on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <AppIcon app={app} size={72} />

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1">{app.name}</h1>
          <p className="text-slate-400 text-sm mb-3">por {app.developer?.username || 'Community'} · v{app.version}</p>

          <div className="flex items-center gap-3 sm:gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <RatingStars rating={app.avg_rating} size={15} />
              <span className="mono text-sm text-slate-300">{app.avg_rating?.toFixed(1) || '—'}</span>
              <span className="text-slate-500 text-sm">({app.ratings_count || 0})</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-sm">
              <Download size={13} />
              <span className="mono">{app.downloads_count || 0}</span> descargas
            </div>
            {app.category && (
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Tag size={13} />
                {app.category?.name || app.category}
              </div>
            )}
          </div>

          {hardware.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {hardware.map(h => <HardwareBadge key={h} tag={h} size="md" />)}
            </div>
          )}

          <InstallButton storeApp={app} size="md" fullWidth className="sm:w-auto" />
        </div>
      </div>
    </div>
  )
}
