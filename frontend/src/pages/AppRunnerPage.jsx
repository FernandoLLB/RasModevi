import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { deviceApi } from '../api/device'
import { DEVICE_BASE } from '../api/client'
import { useDevice } from '../context/DeviceContext'

export default function AppRunnerPage() {
  const { app_id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef()
  const { installedApps } = useDevice()
  const [toast, setToast] = useState(null)
  const [showBack, setShowBack] = useState(true)

  const app = installedApps.find(a => a.id === parseInt(app_id))

  useEffect(() => {
    deviceApi.launch(parseInt(app_id)).catch(console.error)

    const timer = setTimeout(() => setShowBack(false), 3000)

    const handleMessage = (e) => {
      if (e.data?.type === 'modevi-toast') {
        setToast({ message: e.data.message, kind: e.data.kind || 'info' })
        setTimeout(() => setToast(null), 3000)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => { clearTimeout(timer); window.removeEventListener('message', handleMessage) }
  }, [app_id])

  const handleMouseMove = (e) => {
    if (e.clientX < 80 || e.clientY < 60) setShowBack(true)
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
    ? `${DEVICE_BASE}/apps/${app.store_app?.slug}/`
    : `${DEVICE_BASE}/installed/${app_id}/`

  return (
    <div className="fixed inset-0 bg-black z-50" onMouseMove={handleMouseMove} onTouchStart={() => setShowBack(true)}>
      <iframe
        ref={iframeRef}
        src={appUrl}
        className="w-full h-full border-0"
        title={app.store_app?.name || 'App'}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />

      {/* Back button overlay — touch-friendly */}
      <div
        className={`fixed top-0 left-0 p-3 sm:p-4 transition-opacity duration-500 ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <button
          onClick={() => navigate('/launcher')}
          className="flex items-center gap-2 px-4 py-3 rounded-xl glass text-sm text-slate-200 hover:text-white transition-all cursor-pointer min-h-[48px] shadow-xl"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:block">Launcher</span>
        </button>
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
