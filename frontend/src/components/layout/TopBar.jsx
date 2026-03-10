import { Link, useNavigate } from 'react-router-dom'
import { Grid3x3, LogIn, LogOut, User, Code2, Zap, ChevronRight } from 'lucide-react'
import Logo from '../Logo'
import { useAuth } from '../../context/AuthContext'
import { useDevice } from '../../context/DeviceContext'

export default function TopBar({ onSearch, searchValue = '' }) {
  const { user, isAuthenticated, isDeveloper, logout } = useAuth()
  const { activeApp } = useDevice()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <Logo size={30} />
          <span className="text-base font-bold tracking-tight gradient-text hidden sm:block">ModevI</span>
        </Link>

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
          <div className="flex-1 max-w-md">
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

        {/* Nav icons */}
        <nav className="flex items-center gap-1">
          <Link to="/launcher" className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors" title="Launcher">
            <Grid3x3 size={18} />
          </Link>

          {isDeveloper && (
            <Link to="/developer" className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors" title="Portal Developer">
              <Code2 size={18} />
            </Link>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-1">
              <Link to="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-sm text-slate-300 hidden sm:block">{user.username}</span>
              </Link>
              <button
                onClick={logout}
                className="p-2.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/15 transition-colors">
              <LogIn size={15} />
              <span className="hidden sm:block">Entrar</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
