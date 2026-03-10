import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useDevice } from '../../context/DeviceContext'
import { deviceApi } from '../../api/device'

function AppIconVisual({ app, size }) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316']
  const color = colors[(app.store_app?.name?.charCodeAt(0) || 0) % colors.length]
  const name = app.store_app?.name || '?'

  if (app.store_app?.icon_path) {
    return (
      <img
        src={app.store_app.icon_path}
        alt={name}
        className="rounded-2xl object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="rounded-2xl flex items-center justify-center font-bold text-white shadow-lg"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
        fontSize: size * 0.4,
        boxShadow: `0 4px 20px ${color}40`,
      }}
    >
      {name[0].toUpperCase()}
    </div>
  )
}

export default function LauncherAppIcon({ app }) {
  const { activate, uninstall, activeApp } = useDevice()
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)
  const longPressTimer = useRef(null)
  const isActive = app.is_active

  const handlePressStart = () => {
    longPressTimer.current = setTimeout(() => setShowDelete(true), 600)
  }
  const handlePressEnd = () => {
    clearTimeout(longPressTimer.current)
  }

  const handleTap = async () => {
    if (showDelete) { setShowDelete(false); return }
    if (!app.is_active) await activate(app.id)
    await deviceApi.launch(app.id)
    navigate(`/running/${app.id}`)
  }

  const handleUninstall = async (e) => {
    e.stopPropagation()
    await uninstall(app.id)
    setShowDelete(false)
  }

  return (
    <div className="flex flex-col items-center gap-2 relative animate-fade-up">
      <button
        onClick={handleTap}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        className={`relative transition-all duration-200 cursor-pointer ${showDelete ? 'animate-[wiggle_0.3s_ease_infinite]' : 'active:scale-95'} ${isActive ? 'scale-105' : ''}`}
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        <AppIconVisual app={app} size={76} />
        {isActive && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-glow" />
        )}
        {showDelete && (
          <button
            onClick={handleUninstall}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors z-10"
          >
            <X size={12} />
          </button>
        )}
      </button>
      <span className="text-xs text-slate-300 font-medium text-center leading-tight max-w-[80px] line-clamp-1">
        {app.store_app?.name || 'App'}
      </span>
    </div>
  )
}
