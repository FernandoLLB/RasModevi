import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogIn, LogOut, Code2, Zap, ChevronRight, Store, LayoutGrid, Sparkles, Menu, X, Search, Settings } from 'lucide-react'
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

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Breakpoint strategy:
  // < md  (< 768px): phones + Pi 720px portrait → hamburger menu
  // ≥ md  (≥ 768px): tablets / desktop           → full inline nav

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 xl:px-8 py-2.5 flex items-center gap-2 md:gap-3">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo size={26} />
          <span className="text-sm font-bold tracking-tight gradient-text">ModevI</span>
        </Link>

        {/* Main nav tabs — always visible */}
        <div className="flex items-center bg-white/[0.04] rounded-2xl p-1 gap-0.5">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
              isStore
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Store size={15} />
            <span>Tienda</span>
          </Link>
          <Link
            to="/launcher"
            className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all relative min-h-[44px] ${
              isLauncher
                ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <LayoutGrid size={15} />
            <span>Mis Apps</span>
            {installedApps.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none ${
                isLauncher ? 'bg-white/20 text-white' : 'bg-violet-500/20 text-violet-400'
              }`}>
                {installedApps.length}
              </span>
            )}
          </Link>
        </div>

        {/* Active app indicator — desktop only */}
        {activeApp && (
          <Link
            to={`/running/${activeApp.id}`}
            className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/15 transition-colors min-h-[44px]"
          >
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
            <span className="max-w-[120px] truncate">{activeApp.store_app?.name || 'App activa'}</span>
            <ChevronRight size={12} />
          </Link>
        )}

        {/* Search — md+ only */}
        {onSearch && (
          <div className="hidden md:flex flex-1 max-w-sm">
            <input
              value={searchValue}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar apps..."
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all min-h-[44px]"
            />
          </div>
        )}

        <div className="flex-1" />

        {/* System indicator — lg+ only */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
          <Zap size={11} className="text-emerald-500" />
          <span className="mono">Pi 5</span>
        </div>

        {/* Developer links — md+ only */}
        {isDeveloper && (
          <>
            <Link
              to="/ai/create"
              className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
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
              className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors min-h-[44px]"
            >
              <Code2 size={16} />
              <span className="hidden lg:inline">Developer</span>
            </Link>
          </>
        )}

        {/* User — md+ only */}
        {isAuthenticated ? (
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/settings"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors min-h-[44px]"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold shrink-0">
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-sm text-slate-300 hidden lg:block">{user.username}</span>
            </Link>
            <button
              onClick={logout}
              className="flex p-2.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors min-h-[44px] min-w-[44px] items-center justify-center"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-300 hover:text-white hover:bg-indigo-500/15 transition-colors min-h-[44px]"
          >
            <LogIn size={16} />
            Entrar
          </Link>
        )}

        {/* Hamburger — phones + Pi (< md = < 768px) */}
        <button
          className="md:hidden p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menú"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Dropdown menu (phones + Pi 720px) ── */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] px-4 py-3 flex flex-col gap-2 animate-fade-in">

          {/* User profile */}
          {isAuthenticated ? (
            <Link
              to="/settings"
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-slate-200"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-base font-bold shrink-0">
                {user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{user.username}</div>
                <div className="text-xs text-slate-500">Ajustes del dispositivo</div>
              </div>
              <Settings size={15} className="text-slate-500 shrink-0" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 font-semibold text-sm"
            >
              <LogIn size={18} />
              Iniciar sesión
            </Link>
          )}

          {/* Search */}
          {onSearch && (
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 min-h-[52px]">
              <Search size={16} className="text-slate-500 shrink-0" />
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold min-h-[52px]"
            >
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
              {activeApp.store_app?.name || 'App activa'}
              <ChevronRight size={12} className="ml-auto" />
            </Link>
          )}

          {/* Developer links */}
          {isDeveloper && (
            <>
              <Link
                to="/ai/create"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[52px] ${
                  isAI ? 'bg-violet-500/20 text-violet-300' : 'text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <Sparkles size={18} />
                Crear app con IA
              </Link>
              <Link
                to="/developer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/[0.06] transition-colors min-h-[52px]"
              >
                <Code2 size={18} />
                Portal Developer
              </Link>
            </>
          )}

          {/* Logout */}
          {isAuthenticated && (
            <button
              onClick={() => { logout(); setMenuOpen(false) }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors w-full text-left min-h-[52px]"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          )}

          <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-600">
            <Zap size={11} className="text-emerald-500" />
            <span className="mono">ModevI Pi 5</span>
          </div>
        </div>
      )}
    </header>
  )
}
