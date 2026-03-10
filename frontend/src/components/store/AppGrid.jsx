import AppCard from './AppCard'

function SkeletonCard() {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="skeleton w-13 h-13 rounded-xl" style={{ width: 52, height: 52 }} />
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
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {apps.map((app, i) => (
        <AppCard key={app.id} app={app} index={i} />
      ))}
    </div>
  )
}
