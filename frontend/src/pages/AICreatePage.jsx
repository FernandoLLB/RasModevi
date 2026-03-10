import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, ChevronRight, Check, Loader2, AlertCircle,
  Code2, Package, Store, Zap, RotateCcw
} from 'lucide-react'
import DeviceLayout from '../components/layout/DeviceLayout'
import { storeApi } from '../api/store'
import { useAuth } from '../context/AuthContext'

const STEPS = [
  { id: 'connecting',  label: 'Conectando',   Icon: Zap },
  { id: 'generating',  label: 'Generando',    Icon: Code2 },
  { id: 'packaging',   label: 'Empaquetando', Icon: Package },
  { id: 'registering', label: 'Registrando',  Icon: Store },
  { id: 'done',        label: '¡Listo!',      Icon: Check },
]

export default function AICreatePage() {
  const { isDeveloper } = useAuth()
  const [categories, setCategories]   = useState([])
  const [form, setForm]               = useState({ name: '', description: '', category_id: '' })
  const [phase, setPhase]             = useState('idle')   // idle | streaming | done | error
  const [currentStep, setCurrentStep] = useState(null)
  const [codeText, setCodeText]       = useState('')
  const [errorMsg, setErrorMsg]       = useState('')
  const [resultApp, setResultApp]     = useState(null)
  const codeRef    = useRef(null)
  const esRef      = useRef(null)

  useEffect(() => {
    storeApi.getCategories().then(setCategories).catch(console.error)
    return () => esRef.current?.close()
  }, [])

  // Auto-scroll code block as it streams
  useEffect(() => {
    if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight
  }, [codeText])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.description.trim()) return

    const token = localStorage.getItem('access_token')
    if (!token) { setErrorMsg('Debes iniciar sesión.'); setPhase('error'); return }

    setPhase('streaming')
    setCurrentStep('connecting')
    setCodeText('')
    setErrorMsg('')
    setResultApp(null)

    const qs = new URLSearchParams({
      name: form.name,
      description: form.description,
      token,
      ...(form.category_id ? { category_id: form.category_id } : {}),
    })

    const es = new EventSource(`/api/ai/create-app?${qs}`)
    esRef.current = es

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'status') {
        setCurrentStep(data.step)
      } else if (data.type === 'code_chunk') {
        setCodeText(prev => prev + data.text)
      } else if (data.type === 'done') {
        setCurrentStep('done')
        setPhase('done')
        setResultApp({ id: data.app_id, slug: data.app_slug, message: data.message })
        es.close()
      } else if (data.type === 'error') {
        setErrorMsg(data.message)
        setPhase('error')
        es.close()
      }
    }

    es.onerror = () => {
      if (phase !== 'done') {
        setErrorMsg('Error de conexión con el servidor. Comprueba que el backend está activo.')
        setPhase('error')
      }
      es.close()
    }
  }

  const reset = () => {
    esRef.current?.close()
    setPhase('idle')
    setCurrentStep(null)
    setCodeText('')
    setErrorMsg('')
    setResultApp(null)
  }

  const stepIdx = STEPS.findIndex(s => s.id === currentStep)

  return (
    <DeviceLayout hideSearch>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Crear App con IA</h1>
            <p className="text-sm text-slate-400">Describe tu idea y Claude generará la app automáticamente</p>
          </div>
        </div>

        {/* ── FORM ── */}
        {phase === 'idle' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="glass rounded-2xl p-5 border border-white/[0.06] space-y-4">

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nombre de la app
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Calculadora Científica"
                  required
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Descripción detallada
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe qué hace la app, sus funciones, botones, si guarda datos, si usa sensores… Cuanto más detallada, mejor resultado."
                  required
                  rows={5}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all text-sm resize-none"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Ejemplos: «Un cronómetro con vuelta de tiempos», «Un visor de temperatura del CPU con gráfica», «Un juego de memoria con cartas»
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Categoría <span className="text-slate-600">(opcional)</span>
                </label>
                <select
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all text-sm appearance-none cursor-pointer"
                >
                  <option value="" style={{ background: '#0f0f1a' }}>Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id} style={{ background: '#0f0f1a' }}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!isDeveloper && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-300">
                  Necesitas una cuenta <strong>developer</strong> para crear apps.{' '}
                  <Link to="/login" className="underline">Inicia sesión</Link> con una cuenta developer o admin.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!isDeveloper || !form.name.trim() || !form.description.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold text-sm hover:from-violet-400 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              <Sparkles size={16} />
              Generar con Claude
            </button>
          </form>
        )}

        {/* ── STREAMING / RESULT ── */}
        {phase !== 'idle' && (
          <div className="space-y-4">

            {/* Progress steps */}
            <div className="glass rounded-2xl p-4 border border-white/[0.06]">
              <div className="flex items-center gap-1 flex-wrap">
                {STEPS.map((step, idx) => {
                  const { Icon } = step
                  const isPast   = idx < stepIdx
                  const isActive = step.id === currentStep && phase === 'streaming'
                  const isDone   = step.id === 'done' && phase === 'done'

                  if (step.id === 'done' && phase !== 'done') return null

                  return (
                    <div key={step.id} className="flex items-center gap-1">
                      {idx > 0 && <ChevronRight size={11} className="text-slate-700" />}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isDone   ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        isPast   ? 'bg-white/[0.06] text-slate-500' :
                        isActive ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                                   'text-slate-700'
                      }`}>
                        {isActive
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Icon size={11} />
                        }
                        <span>{step.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Live code display */}
            {codeText && (
              <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                  </div>
                  <span className="text-xs text-slate-500 font-mono ml-1">index.html</span>
                  <span className="ml-auto text-xs text-slate-600 font-mono">
                    {codeText.length.toLocaleString()} chars
                  </span>
                </div>
                <pre
                  ref={codeRef}
                  className="text-xs text-emerald-300/75 font-mono p-4 overflow-auto max-h-72 leading-relaxed"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                >
                  {codeText}
                  {phase === 'streaming' && (
                    <span className="animate-pulse text-indigo-400">▋</span>
                  )}
                </pre>
              </div>
            )}

            {/* Error state */}
            {phase === 'error' && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-300">Error al generar la app</p>
                  <p className="text-xs text-red-400/70 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Success state */}
            {phase === 'done' && resultApp && (
              <div className="glass rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Check size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{resultApp.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pendiente de revisión antes de publicarse en la tienda.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link
                    to={`/app/${resultApp.slug}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                  >
                    Ver en tienda <ChevronRight size={14} />
                  </Link>
                  <Link
                    to="/developer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    Panel developer
                  </Link>
                </div>
              </div>
            )}

            {/* Reset button */}
            {(phase === 'done' || phase === 'error') && (
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <RotateCcw size={14} />
                Crear otra app
              </button>
            )}
          </div>
        )}
      </div>
    </DeviceLayout>
  )
}
