import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Upload } from 'lucide-react'
import { useDevice } from '../../context/DeviceContext'
import { deviceApi } from '../../api/device'
import PublishModal from '../PublishModal'

function AppIconVisual({ app, size }) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316']
  const color = colors[(app.store_app?.name?.charCodeAt(0) || 0) % colors.length]
  const name = app.store_app?.name || '?'

  const fallbackStyle = {
    width: size, height: size,
    background: `linear-gradient(135deg, ${color}, ${color}aa)`,
    fontSize: size * 0.4,
    boxShadow: `0 4px 20px ${color}40`,
  }

  if (app.store_app?.icon_path) {
    return (
      <div style={{ width: size, height: size, position: 'relative' }}>
        <img
          src={app.store_app.icon_path}
          alt={name}
          className="rounded-2xl object-cover"
          style={{ width: size, height: size }}
          onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }}
        />
        <div
          className="rounded-2xl items-center justify-center font-bold text-white shadow-lg"
          style={{ ...fallbackStyle, display: 'none', position: 'absolute', top: 0, left: 0 }}
        >
          {name[0].toUpperCase()}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl flex items-center justify-center font-bold text-white shadow-lg"
      style={fallbackStyle}
    >
      {name[0].toUpperCase()}
    </div>
  )
}

export default function LauncherAppIcon({ app }) {
  const { activate, uninstall, activeApp } = useDevice()
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const isLocal = app.store_app?.status === 'local'
  const longPressTimer = useRef(null)
  const longPressTriggered = useRef(false)
  const isActive = app.is_active

  const handlePressStart = () => {
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setShowDelete(true)
    }, 600)
  }
  const handlePressEnd = () => {
    clearTimeout(longPressTimer.current)
  }

  const handleTap = async () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
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
            className="absolute -top-3 -right-3 w-11 h-11 bg-red-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors z-10 shadow-lg shadow-red-500/40 min-w-[44px] min-h-[44px]"
          >
            <X size={18} />
          </button>
        )}
        {showDelete && isLocal && (
          <button
            onClick={e => { e.stopPropagation(); setShowDelete(false); setShowPublish(true) }}
            className="absolute -top-3 -left-3 w-11 h-11 bg-violet-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-violet-500 transition-colors z-10 shadow-lg shadow-violet-500/40 min-w-[44px] min-h-[44px]"
          >
            <Upload size={16} />
          </button>
        )}
      </button>
      <span className="text-xs text-slate-300 font-medium text-center leading-tight max-w-[88px] line-clamp-2">
        {app.store_app?.name || 'App'}
      </span>
      {showPublish && <PublishModal app={app} onClose={() => setShowPublish(false)} />}
    </div>
  )
}
