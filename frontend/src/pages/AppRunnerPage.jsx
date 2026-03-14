import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Maximize2, ChevronRight, ChevronLeft } from 'lucide-react'
import { deviceApi } from '../api/device'
import { DEVICE_BASE } from '../api/client'
import { useDevice } from '../context/DeviceContext'

export default function AppRunnerPage() {
  const { app_id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef()
  const cacheBust = useRef(Date.now()).current
  const { installedApps } = useDevice()
  const [toast, setToast] = useState(null)
  const [showControls, setShowControls] = useState(false)

  const app = installedApps.find(a => a.id === parseInt(app_id))

  useEffect(() => {
    deviceApi.launch(parseInt(app_id)).catch(console.error)

    const handleMessage = (e) => {
      if (e.data?.type === 'modevi-toast') {
        setToast({ message: e.data.message, kind: e.data.kind || 'info' })
        setTimeout(() => setToast(null), 3000)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [app_id])

  if (!app) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">App no encontrada</p>
          <button
            onClick={() => navigate('/launcher')}
            className="text-indigo-400 hover:text-indigo-300 cursor-pointer px-5 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm font-semibold transition-colors min-h-[48px]"
          >
            Volver al launcher
          </button>
        </div>
      </div>
    )
  }

  const isDemoApp = app.install_path?.startsWith('apps/')
  const appUrl = isDemoApp
    ? `${DEVICE_BASE}/apps/${app.store_app?.slug}/?v=${cacheBust}`
    : `${DEVICE_BASE}/installed/${app_id}/?v=${cacheBust}`

  return (
    <div className="fixed inset-0 bg-black z-50">
      <iframe
        ref={iframeRef}
        src={appUrl}
        className="w-full h-full border-0"
        title={app.store_app?.name || 'App'}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads"
      />

      {/* Pull-tab — full-height column so centering uses flexbox, not transform */}
      <div className="fixed inset-y-0 left-0 z-[61] flex items-center pointer-events-none">
        <button
          onClick={() => setShowControls(v => !v)}
          className="pointer-events-auto flex items-center justify-center cursor-pointer transition-all duration-300"
          style={{
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: 'none',
            borderRadius: '0 12px 12px 0',
            padding: '18px 8px',
          }}
          aria-label="Mostrar controles"
        >
          {showControls
            ? <ChevronLeft size={16} className="text-white/60" />
            : <ChevronRight size={16} className="text-white/60" />
          }
        </button>
      </div>

      {/* Controls panel — full-height column so centering uses flexbox, not transform */}
      <div className="fixed inset-y-0 left-0 z-[60] flex items-center pointer-events-none">
        <div
          className={`flex flex-col gap-2 transition-all duration-300 pointer-events-auto ${
            showControls ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
          }`}
          style={{ paddingLeft: '4px', paddingRight: '10px' }}
        >
        <button
          onClick={() => navigate('/launcher')}
          className="flex items-center gap-2.5 pl-4 pr-5 py-3.5 rounded-2xl text-slate-200 hover:text-white transition-colors cursor-pointer min-h-[52px] shadow-lg"
          style={{
            background: 'rgba(0,0,0,0.30)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Launcher</span>
        </button>

        <a
          href={appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 pl-4 pr-5 py-3.5 rounded-2xl text-slate-200 hover:text-white transition-colors cursor-pointer min-h-[52px] shadow-lg"
          style={{
            background: 'rgba(0,0,0,0.30)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          title="Abrir en ventana completa"
        >
          <Maximize2 size={20} />
          <span className="text-sm font-medium">Nueva ventana</span>
        </a>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium animate-fade-up shadow-xl min-h-[48px] ${
          toast.kind === 'error' ? 'bg-red-500/90' : toast.kind === 'success' ? 'bg-emerald-500/90' : 'bg-indigo-500/90'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
