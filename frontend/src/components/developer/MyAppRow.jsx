import { Edit2, Trash2, Upload, Star, Download } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { AppIcon } from '../store/AppCard'

export default function MyAppRow({ app, onUpload, onDelete }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <AppIcon app={app} size={44} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{app.name}</span>
          <StatusBadge status={app.status} />
          <span className="text-xs mono text-slate-500">v{app.version}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{app.description}</p>
        {app.status === 'rejected' && app.rejection_reason && (
          <p className="text-xs text-red-400 mt-1">Motivo: {app.rejection_reason}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
        <div className="flex items-center gap-1 hidden sm:flex">
          <Star size={11} className="text-amber-400" fill="currentColor" />
          <span className="mono">{app.avg_rating?.toFixed(1) || '—'}</span>
        </div>
        <div className="flex items-center gap-1 hidden sm:flex">
          <Download size={11} />
          <span className="mono">{app.downloads_count || 0}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onUpload(app)}
          className="p-3 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Subir paquete"
        >
          <Upload size={18} />
        </button>
        <button
          onClick={() => onDelete(app)}
          className="p-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Eliminar"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}
