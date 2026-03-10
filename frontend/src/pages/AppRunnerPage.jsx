import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { deviceApi } from '../api/device'
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

    // Hide back button after 3s, show on touch near edge
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
          <button onClick={() => navigate('/launcher')} className="text-indigo-400 hover:text-indigo-300 cursor-pointer" style={{ background: 'none', border: 'none' }}>
            Volver al launcher
          </button>
        </div>
      </div>
    )
  }

  const isDemoApp = app.install_path?.startsWith('apps/')
  const appUrl = isDemoApp
    ? `/apps/${app.store_app?.slug}/`
    : `/installed/${app_id}/`

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

      {/* SDK injection script tag */}
      <script
        src={`/api/sdk/app/${app_id}/sdk.js`}
        onLoad={() => console.log('ModevI SDK loaded')}
      />

      {/* Back button overlay */}
      <div
        className={`fixed top-0 left-0 p-4 transition-opacity duration-500 ${showBack ? 'opacity-100' : 'opacity-0'}`}
      >
        <button
          onClick={() => navigate('/launcher')}
          className="flex items-center gap-2 px-3 py-2 rounded-xl glass text-sm text-slate-200 hover:text-white transition-all cursor-pointer"
          style={{ border: 'none' }}
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:block">Launcher</span>
        </button>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium animate-fade-up shadow-xl ${
          toast.kind === 'error' ? 'bg-red-500/90' : toast.kind === 'success' ? 'bg-emerald-500/90' : 'bg-indigo-500/90'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
