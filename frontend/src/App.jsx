import { useState, useEffect, useCallback } from 'react'
import { Clock, Image, Activity, StickyNote, Download, Trash2, Play, Square, Monitor, Info, ChevronRight, Cpu, HardDrive, Thermometer, MemoryStick, LayoutGrid, Zap } from 'lucide-react'

const ICONS = {
  clock: Clock,
  image: Image,
  activity: Activity,
  'sticky-note': StickyNote,
}

const API = ''

function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="url(#g)" />
      <path d="M12 28V14l8 7 8-7v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function AppCard({ app, onInstall, onUninstall, onActivate, onDeactivate }) {
  const Icon = ICONS[app.icon] || Monitor
  return (
    <div className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
      {app.active && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Activa
        </div>
      )}
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: app.color + '22' }}>
        <Icon size={24} style={{ color: app.color }} />
      </div>
      <h3 className="text-base font-medium mb-1">{app.name}</h3>
      <p className="text-sm text-white/40 mb-1">{app.category} · v{app.version}</p>
      <p className="text-sm text-white/50 mb-4 line-clamp-2">{app.description}</p>
      <div className="flex gap-2">
        {!app.installed ? (
          <button
            onClick={() => onInstall(app.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Download size={14} /> Instalar
          </button>
        ) : (
          <>
            {!app.active ? (
              <button
                onClick={() => onActivate(app.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <Play size={14} /> Activar
              </button>
            ) : (
              <button
                onClick={() => onDeactivate(app.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <Square size={14} /> Detener
              </button>
            )}
            <button
              onClick={() => onUninstall(app.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-red-500/20 hover:text-red-400 rounded-lg text-sm transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StatsBar({ stats, sysInfo }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        <div className="flex items-center gap-2 text-white/40 text-xs mb-1"><LayoutGrid size={12} /> Apps</div>
        <div className="text-lg font-light">{stats?.installed_apps || 0}<span className="text-white/30 text-sm">/{stats?.total_apps || 0}</span></div>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        <div className="flex items-center gap-2 text-white/40 text-xs mb-1"><Cpu size={12} /> CPU</div>
        <div className="text-lg font-light">{sysInfo?.cpu_percent ?? '--'}<span className="text-white/30 text-sm">%</span></div>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        <div className="flex items-center gap-2 text-white/40 text-xs mb-1"><MemoryStick size={12} /> RAM</div>
        <div className="text-lg font-light">{sysInfo?.memory_percent ?? '--'}<span className="text-white/30 text-sm">%</span></div>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        <div className="flex items-center gap-2 text-white/40 text-xs mb-1"><Thermometer size={12} /> Temp</div>
        <div className="text-lg font-light">{sysInfo?.cpu_temp ? sysInfo.cpu_temp.toFixed(0) : '--'}<span className="text-white/30 text-sm">°C</span></div>
      </div>
    </div>
  )
}

function ActiveAppBanner({ app, onOpen }) {
  if (!app) return null
  const Icon = ICONS[app.icon] || Monitor
  return (
    <div
      className="mb-6 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
      style={{ background: `linear-gradient(135deg, ${app.color}33, ${app.color}11)`, border: `1px solid ${app.color}33` }}
      onClick={onOpen}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: app.color + '33' }}>
          <Icon size={20} style={{ color: app.color }} />
        </div>
        <div>
          <div className="text-sm font-medium">{app.name} está activa</div>
          <div className="text-xs text-white/40">Toca para abrir en pantalla completa</div>
        </div>
      </div>
      <ChevronRight size={20} className="text-white/30" />
    </div>
  )
}

function App() {
  const [apps, setApps] = useState([])
  const [stats, setStats] = useState(null)
  const [sysInfo, setSysInfo] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/apps/`)
      setApps(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, sysRes] = await Promise.all([
        fetch(`${API}/api/system/stats`),
        fetch(`${API}/api/system/info`),
      ])
      setStats(await statsRes.json())
      setSysInfo(await sysRes.json())
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    fetchApps()
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [fetchApps, fetchStats])

  const action = async (appId, act) => {
    await fetch(`${API}/api/apps/${appId}/${act}`, { method: 'POST' })
    fetchApps()
    fetchStats()
  }

  const activeApp = apps.find(a => a.active)
  const categories = ['all', ...new Set(apps.map(a => a.category))]
  const filtered = filter === 'all' ? apps : apps.filter(a => a.category === filter)

  const openActiveApp = () => {
    if (activeApp) window.open(`/apps/${activeApp.id}/`, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-3">
          <Logo size={40} />
          <span className="text-white/50">Cargando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">ModevI</h1>
              <p className="text-[11px] text-white/30 -mt-0.5">Tu dispositivo, infinitas posibilidades</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Zap size={12} className="text-emerald-400" />
            <span>{sysInfo?.hostname || 'raspberrypi'}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <ActiveAppBanner app={activeApp} onOpen={openActiveApp} />
        <StatsBar stats={stats} sysInfo={sysInfo} />

        {/* Category filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors cursor-pointer ${
                filter === c
                  ? 'bg-indigo-500/20 text-indigo-400 font-medium'
                  : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08]'
              }`}
            >
              {c === 'all' ? 'Todas' : c}
            </button>
          ))}
        </div>

        {/* Apps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(app => (
            <AppCard
              key={app.id}
              app={app}
              onInstall={(id) => action(id, 'install')}
              onUninstall={(id) => action(id, 'uninstall')}
              onActivate={(id) => action(id, 'activate')}
              onDeactivate={(id) => action(id, 'deactivate')}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-white/20">
            No hay apps en esta categoría
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] mt-12">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-white/20">
          <span>ModevI v1.0.0</span>
          <span>Raspberry Pi 5 · {sysInfo?.os || ''}</span>
        </div>
      </footer>
    </div>
  )
}

export default App
