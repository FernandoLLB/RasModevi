const CONFIG = {
  pending:   { label: 'Pendiente', bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/25' },
  published: { label: 'Publicada', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' },
  rejected:  { label: 'Rechazada', bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/25' },
}

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'published' ? 'bg-emerald-400 animate-pulse' : status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} />
      {cfg.label}
    </span>
  )
}
