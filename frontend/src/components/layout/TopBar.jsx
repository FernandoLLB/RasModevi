import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, LogOut, Code2, Zap, ChevronRight, Store, LayoutGrid, Sparkles } from 'lucide-react'
import Logo from '../Logo'
import { useAuth } from '../../context/AuthContext'
import { useDevice } from '../../context/DeviceContext'

export default function TopBar({ onSearch, searchValue = '' }) {
  const { user, isAuthenticated, isDeveloper, logout } = useAuth()
  const { activeApp, installedApps } = useDevice()
  const location = useLocation()

  const isStore = location.pathname === '/' || location.pathname.startsWith('/app/')
  const isLauncher = location.pathname === '/launcher'
  const isAI = location.pathname.startsWith('/ai/')

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <Logo size={28} />
          <span className="text-base font-bold tracking-tight gradient-text hidden sm:block">ModevI</span>
        </Link>

        {/* Main nav tabs */}
        <div className="flex items-center bg-white/[0.04] rounded-xl p-1 gap-0.5">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isStore
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Store size={14} />
            <span>Tienda</span>
          </Link>
          <Link
            to="/launcher"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all relative ${
              isLauncher
                ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <LayoutGrid size={14} />
            <span>Mis Apps</span>
            {installedApps.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isLauncher ? 'bg-white/20 text-white' : 'bg-violet-500/20 text-violet-400'
              }`}>
                {installedApps.length}
              </span>
            )}
          </Link>
        </div>

        {/* Active app indicator */}
        {activeApp && (
          <Link
            to={`/running/${activeApp.id}`}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-colors"
          >
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {activeApp.store_app?.name || 'App activa'}
            <ChevronRight size={12} />
          </Link>
        )}

        {/* Search */}
        {onSearch && (
          <div className="flex-1 max-w-xs">
            <input
              value={searchValue}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar apps..."
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
            />
          </div>
        )}

        <div className="flex-1" />

        {/* System indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <Zap size={11} className="text-emerald-500" />
          <span className="mono">Pi 5</span>
        </div>

        {/* User / dev nav */}
        <nav className="flex items-center gap-1">
          {isDeveloper && (
            <>
              <Link
                to="/ai/create"
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isAI
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`}
                title="Crear app con IA"
              >
                <Sparkles size={14} />
                <span>Crear con IA</span>
              </Link>
              <Link
                to="/developer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Portal Developer"
              >
                <Code2 size={14} />
                <span>Developer</span>
              </Link>
            </>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-1">
              <Link to="/settings" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-sm text-slate-300 hidden sm:block">{user.username}</span>
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/15 transition-colors">
              <LogIn size={15} />
              <span className="hidden sm:block">Entrar</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
