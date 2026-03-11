import AppCard from './AppCard'

function SkeletonCard() {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="skeleton rounded-xl shrink-0" style={{ width: 52, height: 52 }} />
        <div className="flex-1 flex flex-col gap-2">
          <div className="skeleton h-3.5 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
      <div className="flex gap-1">
        <div className="skeleton h-4 w-12 rounded" />
        <div className="skeleton h-4 w-10 rounded" />
      </div>
    </div>
  )
}

export default function AppGrid({ apps, loading }) {
  // grid-cols-2 base (mobile)
  // md: 3 cols (Pi 800px — md breakpoint 768px applies)
  // lg: 4 cols (desktop)
  // xl: 5 cols (large desktop)
  const gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3'

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (!apps?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-3 opacity-20">📦</div>
        <p className="text-slate-400 text-sm">No se encontraron apps</p>
        <p className="text-slate-600 text-xs mt-1">Prueba con otros filtros</p>
      </div>
    )
  }

  return (
    <div className={gridClass}>
      {apps.map((app, i) => (
        <AppCard key={app.id} app={app} index={i} />
      ))}
    </div>
  )
}
