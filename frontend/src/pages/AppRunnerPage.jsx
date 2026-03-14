import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Maximize2 } from 'lucide-react'
import { deviceApi } from '../api/device'
import { DEVICE_BASE } from '../api/client'
import { useDevice } from '../context/DeviceContext'

export default function AppRunnerPage() {
  const { app_id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef()
  const cacheBust = useRef(Date.now()).current
  const hideTimerRef = useRef(null)
  const { installedApps } = useDevice()
  const [toast, setToast] = useState(null)
  const [showBack, setShowBack] = useState(true)

  const app = installedApps.find(a => a.id === parseInt(app_id))

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowBack(false), 4000)
  }, [])

  const revealBack = useCallback(() => {
    setShowBack(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    deviceApi.launch(parseInt(app_id)).catch(console.error)
    scheduleHide()

    const handleMessage = (e) => {
      if (e.data?.type === 'modevi-toast') {
        setToast({ message: e.data.message, kind: e.data.kind || 'info' })
        setTimeout(() => setToast(null), 3000)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => { clearTimeout(hideTimerRef.current); window.removeEventListener('message', handleMessage) }
  }, [app_id, scheduleHide])

  const handleMouseMove = (e) => {
    if (e.clientX < 80 || e.clientY < 60) revealBack()
  }

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
    <div className="fixed inset-0 bg-black z-50" onMouseMove={handleMouseMove}>
      <iframe
        ref={iframeRef}
        src={appUrl}
        className="w-full h-full border-0"
        title={app.store_app?.name || 'App'}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads"
      />

      {/* Transparent hit zone — larger on mobile for easier reveal */}
      <div
        className="fixed top-0 left-0 w-28 h-28 z-[60]"
        onTouchStart={revealBack}
        onMouseEnter={revealBack}
      />

      {/* Edge indicator — subtle pull-tab when buttons are hidden */}
      <div
        className={`fixed top-1/2 -translate-y-1/2 left-0 z-[59] transition-all duration-500 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onTouchStart={revealBack}
        onClick={revealBack}
      >
        <div className="bg-black/50 backdrop-blur-md rounded-r-2xl px-1.5 py-5 border-r border-t border-b border-white/10 flex flex-col items-center gap-1.5 cursor-pointer">
          <div className="w-1 h-6 rounded-full bg-white/50" />
          <div className="w-1 h-3 rounded-full bg-white/30" />
        </div>
      </div>

      {/* Back + fullscreen buttons overlay */}
      <div
        className={`fixed top-3 left-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 transition-all duration-400 z-[60] ${showBack ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}
      >
        <button
          onClick={() => navigate('/launcher')}
          className="flex items-center gap-2.5 pl-3.5 pr-5 py-3 rounded-2xl glass text-slate-200 hover:text-white transition-all cursor-pointer min-h-[52px] shadow-xl"
        >
          <ArrowLeft size={22} />
          <span className="text-sm font-medium">Launcher</span>
        </button>
        <a
          href={appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 pl-3.5 pr-5 py-3 rounded-2xl glass text-slate-200 hover:text-white transition-all cursor-pointer min-h-[52px] shadow-xl"
          title="Abrir en ventana completa"
        >
          <Maximize2 size={22} />
          <span className="text-sm font-medium">Nueva ventana</span>
        </a>
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
