import { Link } from 'react-router-dom'
import { ArrowRight, Star } from 'lucide-react'
import { AppIcon } from './AppCard'
import HardwareBadge from './HardwareBadge'
import InstallButton from './InstallButton'

export default function FeaturedBanner({ app }) {
  if (!app) return null

  return (
    <div className="relative overflow-hidden rounded-2xl mb-6 p-4 sm:p-6 animate-fade-up">
      {/* Gradient background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.15) 50%, rgba(16,185,129,0.1) 100%)',
        borderTop: '1px solid rgba(99,102,241,0.2)',
        borderBottom: '1px solid rgba(139,92,246,0.1)',
      }} />
      <div className="absolute inset-0 opacity-30" style={{
        background: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.3) 0%, transparent 60%)',
      }} />

      {/* Content — stacks on mobile, row on md+ */}
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">

        {/* Icon + info row (always horizontal) */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <AppIcon app={app} size={64} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/15 px-2 py-0.5 rounded">Destacada</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-1 truncate">{app.name}</h2>
            <p className="text-sm text-slate-400 line-clamp-2 mb-2">{app.description}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <Star size={12} className="text-amber-400" fill="currentColor" />
                <span className="text-xs mono text-slate-300">{app.avg_rating?.toFixed(1) || '—'}</span>
              </div>
              {(app.required_hardware || []).slice(0, 2).map(h => <HardwareBadge key={h} tag={h} />)}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0">
          <InstallButton storeApp={app} size="md" fullWidth />
          <Link
            to={`/app/${app.slug}`}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] transition-colors min-h-[48px]"
          >
            Ver más <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
