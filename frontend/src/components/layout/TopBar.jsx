import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogIn, LogOut, Code2, Zap, ChevronRight, Store, LayoutGrid, Sparkles, Menu, X, Search } from 'lucide-react'
import Logo from '../Logo'
import { useAuth } from '../../context/AuthContext'
import { useDevice } from '../../context/DeviceContext'

export default function TopBar({ onSearch, searchValue = '' }) {
  const { user, isAuthenticated, isDeveloper, logout } = useAuth()
  const { activeApp, installedApps } = useDevice()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isStore = location.pathname === '/' || location.pathname.startsWith('/app/')
  const isLauncher = location.pathname === '/launcher'
  const isAI = location.pathname.startsWith('/ai/')

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 sm:gap-3">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo size={28} />
          <span className="text-base font-bold tracking-tight gradient-text hidden sm:block">ModevI</span>
        </Link>

        {/* Main nav tabs */}
        <div className="flex items-center bg-white/[0.04] rounded-2xl p-1 sm:p-1.5 gap-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[38px] sm:min-h-[40px] ${
              isStore
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Store size={15} />
            <span className="hidden sm:inline">Tienda</span>
          </Link>
          <Link
            to="/launcher"
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-all relative min-h-[38px] sm:min-h-[40px] ${
              isLauncher
                ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <LayoutGrid size={15} />
            <span className="hidden sm:inline">Mis Apps</span>
            {installedApps.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
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
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/15 transition-colors min-h-[38px]"
          >
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
            <span className="max-w-[120px] truncate">{activeApp.store_app?.name || 'App activa'}</span>
            <ChevronRight size={12} />
          </Link>
        )}

        {/* Search — hidden on mobile (shown in dropdown) */}
        {onSearch && (
          <div className="hidden sm:flex flex-1 max-w-xs">
            <input
              value={searchValue}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar apps..."
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
            />
          </div>
        )}

        <div className="flex-1" />

        {/* System indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <Zap size={11} className="text-emerald-500" />
          <span className="mono">Pi 5</span>
        </div>

        {/* Developer links — hidden on mobile */}
        {isDeveloper && (
          <>
            <Link
              to="/ai/create"
              className={`hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[40px] ${
                isAI
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Sparkles size={16} />
              <span className="hidden lg:inline">Crear con IA</span>
            </Link>
            <Link
              to="/developer"
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors min-h-[40px]"
            >
              <Code2 size={16} />
              <span className="hidden lg:inline">Developer</span>
            </Link>
          </>
        )}

        {/* User */}
        {isAuthenticated ? (
          <div className="flex items-center gap-1">
            <Link to="/settings" className="flex items-center gap-2 px-2 sm:px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors min-h-[40px]">
              <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold shrink-0">
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-sm text-slate-300 hidden sm:block">{user.username}</span>
            </Link>
            <button
              onClick={logout}
              className="hidden sm:flex p-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors min-h-[40px] min-w-[40px] items-center justify-center"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link to="/login" className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-300 hover:text-white hover:bg-indigo-500/15 transition-colors min-h-[40px]">
            <LogIn size={16} />
            <span className="hidden sm:block">Entrar</span>
          </Link>
        )}

        {/* Hamburger — mobile only */}
        <button
          className="sm:hidden p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menú"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-white/[0.06] px-4 py-3 flex flex-col gap-2 animate-fade-in">

          {/* Search */}
          {onSearch && (
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5">
              <Search size={15} className="text-slate-500 shrink-0" />
              <input
                value={searchValue}
                onChange={e => onSearch(e.target.value)}
                placeholder="Buscar apps..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
                autoFocus
              />
            </div>
          )}

          {/* Active app */}
          {activeApp && (
            <Link
              to={`/running/${activeApp.id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold"
            >
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              {activeApp.store_app?.name || 'App activa'}
              <ChevronRight size={12} className="ml-auto" />
            </Link>
          )}

          {/* Developer links */}
          {isDeveloper && (
            <>
              <Link
                to="/ai/create"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  isAI ? 'bg-violet-500/20 text-violet-300' : 'text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <Sparkles size={16} />
                Crear app con IA
              </Link>
              <Link
                to="/developer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <Code2 size={16} />
                Portal Developer
              </Link>
            </>
          )}

          {/* Logout */}
          {isAuthenticated && (
            <button
              onClick={() => { logout(); setMenuOpen(false) }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          )}

          {/* System */}
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-600">
            <Zap size={11} className="text-emerald-500" />
            <span className="mono">ModevI Pi 5</span>
          </div>
        </div>
      )}
    </header>
  )
}
