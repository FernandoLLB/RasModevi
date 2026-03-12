import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, ChevronRight, Check, Loader2, AlertCircle,
  Code2, Package, Store, Zap, RotateCcw, Lightbulb,
  MessageSquare, Wand2, ChevronDown, ChevronUp, Play,
  WrenchIcon, ArrowRight,
} from 'lucide-react'
import DeviceLayout from '../components/layout/DeviceLayout'
import { storeApi } from '../api/store'
import { STORE_BASE, DEVICE_BASE, refreshTokens } from '../api/client'
import { useAuth } from '../context/AuthContext'

// ─── SSE Pipeline steps ───────────────────────────────────────────────────
const STEPS = [
  { id: 'connecting',  label: 'Conectando',   Icon: Zap },
  { id: 'generating',  label: 'Generando',    Icon: Code2 },
  { id: 'describing',  label: 'Describiendo', Icon: MessageSquare },
  { id: 'packaging',   label: 'Empaquetando', Icon: Package },
  { id: 'registering', label: 'Registrando',  Icon: Store },
  { id: 'done',        label: '¡Listo!',      Icon: Check },
]

const DEBUG_STEPS = [
  { id: 'connecting',  label: 'Conectando',   Icon: Zap },
  { id: 'generating',  label: 'Mejorando',    Icon: WrenchIcon },
  { id: 'packaging',   label: 'Actualizando', Icon: Package },
  { id: 'done',        label: '¡Listo!',      Icon: Check },
]

// ─── Example prompts ──────────────────────────────────────────────────────
const EXAMPLES = [
  {
    category: 'Juego',
    color: 'violet',
    icon: '🎮',
    name: 'Snake Clásico',
    description: 'El juego snake clásico donde la serpiente crece al comer manzanas. Incluye marcador de puntos, pantalla de game over con mejor puntuación guardada, y control con teclado y swipe táctil.',
  },
  {
    category: 'Juego',
    color: 'violet',
    icon: '🃏',
    name: 'Memoria de Cartas',
    description: 'Juego de memoria con cartas de emoji. Tablero de 4×4, animación de volteo, contador de intentos, tiempo transcurrido, y tabla de records guardada.',
  },
  {
    category: 'Herramienta',
    color: 'cyan',
    icon: '⏱',
    name: 'Cronómetro Pro',
    description: 'Cronómetro con vuelta de tiempos, historial de las últimas 10 vueltas, botón reset, y guardado de la mejor vuelta en memoria persistente.',
  },
  {
    category: 'Herramienta',
    color: 'cyan',
    icon: '📝',
    name: 'Bloc de Notas',
    description: 'Bloc de notas con búsqueda en tiempo real, guardado automático en base de datos local, lista de notas con fecha y hora, y botón de borrar por nota.',
  },
  {
    category: 'Datos',
    color: 'emerald',
    icon: '📊',
    name: 'Monitor del Sistema',
    description: 'Dashboard en tiempo real con CPU, RAM y temperatura del sistema usando gráficas de línea con Chart.js. Se actualiza cada 2 segundos y muestra histórico de los últimos 60 puntos.',
  },
  {
    category: 'Datos',
    color: 'emerald',
    icon: '🌤',
    name: 'Widget del Tiempo',
    description: 'App de clima que detecta la ubicación por IP y muestra temperatura actual, descripción del tiempo, humedad y viento usando la API de Open-Meteo. Diseño tipo widget moderno.',
  },
  {
    category: 'Creativo',
    color: 'amber',
    icon: '🎹',
    name: 'Piano Virtual',
    description: 'Piano virtual con 2 octavas tocable con teclado del ordenador y click/touch en las teclas. Síntesis de sonido con Web Audio API. Muestra qué tecla del teclado corresponde a cada nota.',
  },
  {
    category: 'Productividad',
    color: 'rose',
    icon: '🍅',
    name: 'Timer Pomodoro',
    description: 'Timer pomodoro con ciclos configurables (trabajo 25 min / descanso 5 min), sonido de campana al terminar con Web Audio, contador de sesiones completadas y estadísticas del día guardadas.',
  },
]

const colorMap = {
  violet: 'bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/20',
  cyan:   'bg-cyan-500/10 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20',
  emerald:'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20',
  amber:  'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20',
  rose:   'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20',
}

// ─── Main component ───────────────────────────────────────────────────────
export default function AICreatePage() {
  const { isDeveloper } = useAuth()
  const [categories, setCategories]     = useState([])
  const [form, setForm]                 = useState({ name: '', description: '', category_id: '' })
  const [phase, setPhase]               = useState('idle')   // idle | guided | streaming | done | error | debug_form | debug_streaming
  const [currentStep, setCurrentStep]   = useState(null)
  const [codeText, setCodeText]         = useState('')
  const [errorMsg, setErrorMsg]         = useState('')
  const [resultApp, setResultApp]       = useState(null)
  const [showExamples, setShowExamples] = useState(false)
  const [isDebugMode, setIsDebugMode]   = useState(false)

  // Guided mode
  const [guidedLoading, setGuidedLoading] = useState(false)
  const [guidedQuestions, setGuidedQuestions] = useState([])
  const [guidedAnswers, setGuidedAnswers]     = useState({})

  // Debug mode
  const [debugFeedback, setDebugFeedback] = useState('')

  const codeRef = useRef(null)
  const esRef   = useRef(null)

  useEffect(() => {
    storeApi.getCategories().then(setCategories).catch(console.error)
    return () => esRef.current?.close()
  }, [])

  useEffect(() => {
    if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight
  }, [codeText])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getToken = async () => {
    try { return await refreshTokens() } catch { return localStorage.getItem('access_token') }
  }

  const startSSE = (url, onDone) => {
    const es = new EventSource(url)
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
        setIsDebugMode(false)
        onDone(data)
        es.close()
      } else if (data.type === 'error') {
        setErrorMsg(data.message)
        setPhase('error')
        es.close()
      }
    }
    es.onerror = () => {
      setErrorMsg('Error de conexión con el servidor.')
      setPhase('error')
      es.close()
    }
  }

  // ── Standard generation ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!form.name.trim() || !form.description.trim()) return

    const token = await getToken()
    if (!token) { setErrorMsg('Debes iniciar sesión.'); setPhase('error'); return }

    setPhase('streaming')
    setCurrentStep('connecting')
    setCodeText('')
    setErrorMsg('')
    setResultApp(null)
    setIsDebugMode(false)

    const qs = new URLSearchParams({
      name: form.name,
      description: form.description,
      token,
      ...(form.category_id ? { category_id: form.category_id } : {}),
    })

    startSSE(`${STORE_BASE}/api/ai/create-app?${qs}`, (data) => {
      setResultApp({ id: data.app_id, slug: data.app_slug, installed_id: data.installed_id, message: data.message })
    })
  }

  // ── Guided mode ──────────────────────────────────────────────────────────
  const handleFetchQuestions = async () => {
    if (!form.name.trim()) return
    setGuidedLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${STORE_BASE}/api/ai/suggest-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, description: form.description }),
      })
      const data = await res.json()
      setGuidedQuestions(data.questions || [])
      setGuidedAnswers({})
      setPhase('guided')
    } catch {
      // Fall back to generic questions
      setGuidedQuestions([
        { id: 'q1', text: '¿Debe guardar datos entre sesiones?' },
        { id: 'q2', text: '¿Qué botones o controles principales necesita?' },
        { id: 'q3', text: '¿Usa alguna API externa o datos en tiempo real?' },
      ])
      setGuidedAnswers({})
      setPhase('guided')
    } finally {
      setGuidedLoading(false)
    }
  }

  const handleGuidedSubmit = (e) => {
    e.preventDefault()
    const answeredParts = guidedQuestions
      .filter(q => guidedAnswers[q.id]?.trim())
      .map(q => `- ${q.text}: ${guidedAnswers[q.id].trim()}`)
    const extra = answeredParts.length ? `\n\nDetalles adicionales:\n${answeredParts.join('\n')}` : ''
    const fullDescription = (form.description.trim() || form.name) + extra
    setForm(f => ({ ...f, description: fullDescription }))
    // Trigger generation on next render tick
    setTimeout(() => {
      handleSubmitWithDescription(form.name, fullDescription, form.category_id)
    }, 0)
  }

  const handleSubmitWithDescription = async (name, description, category_id) => {
    const token = await getToken()
    if (!token) { setErrorMsg('Debes iniciar sesión.'); setPhase('error'); return }

    setPhase('streaming')
    setCurrentStep('connecting')
    setCodeText('')
    setErrorMsg('')
    setResultApp(null)

    const qs = new URLSearchParams({
      name,
      description,
      token,
      ...(category_id ? { category_id } : {}),
    })

    startSSE(`${STORE_BASE}/api/ai/create-app?${qs}`, (data) => {
      setResultApp({ id: data.app_id, slug: data.app_slug, installed_id: data.installed_id, message: data.message })
    })
  }

  // ── Debug mode ───────────────────────────────────────────────────────────
  const handleDebugSubmit = async (e) => {
    e.preventDefault()
    if (!debugFeedback.trim() || !resultApp?.installed_id) return

    const token = await getToken()
    if (!token) { setErrorMsg('Debes iniciar sesión.'); setPhase('error'); return }

    setPhase('debug_streaming')
    setCurrentStep('connecting')
    setCodeText('')
    setErrorMsg('')
    setIsDebugMode(true)

    const qs = new URLSearchParams({
      installed_id: resultApp.installed_id,
      feedback: debugFeedback,
      token,
    })

    startSSE(`${DEVICE_BASE}/api/ai/debug-app?${qs}`, (data) => {
      setResultApp(prev => ({
        ...prev,
        id: data.app_id ?? prev.id,
        slug: data.app_slug ?? prev.slug,
        installed_id: data.installed_id ?? prev.installed_id,
        message: data.message,
      }))
      setDebugFeedback('')
    })
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = () => {
    esRef.current?.close()
    setPhase('idle')
    setCurrentStep(null)
    setCodeText('')
    setErrorMsg('')
    setResultApp(null)
    setIsDebugMode(false)
    setGuidedQuestions([])
    setGuidedAnswers({})
    setDebugFeedback('')
    setForm({ name: '', description: '', category_id: '' })
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const activeSteps = (phase === 'debug_streaming' || (phase === 'done' && isDebugMode)) ? DEBUG_STEPS : STEPS
  const stepIdx = activeSteps.findIndex(s => s.id === currentStep)
  const isStreaming = phase === 'streaming' || phase === 'debug_streaming'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <DeviceLayout hideSearch>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

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

        {/* ════════════════════════ IDLE FORM ════════════════════════ */}
        {phase === 'idle' && (
          <div className="space-y-4">

            {/* Example prompts toggle */}
            <button
              onClick={() => setShowExamples(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-400 text-sm hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lightbulb size={14} className="text-amber-400" />
                <span>Ver ejemplos de apps que puedes crear</span>
              </div>
              {showExamples ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showExamples && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setForm(f => ({ ...f, name: ex.name, description: ex.description }))
                      setShowExamples(false)
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${colorMap[ex.color]}`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{ex.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium opacity-60">{ex.category}</span>
                      </div>
                      <p className="text-sm font-medium leading-snug">{ex.name}</p>
                      <p className="text-xs opacity-60 mt-0.5 line-clamp-2">{ex.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Main form */}
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-slate-300">
                      Descripción detallada
                    </label>
                    {form.name.trim() && isDeveloper && (
                      <button
                        type="button"
                        onClick={handleFetchQuestions}
                        disabled={guidedLoading}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                      >
                        {guidedLoading
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Wand2 size={11} />
                        }
                        Modo guiado
                      </button>
                    )}
                  </div>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe qué hace la app, sus funciones, botones, si guarda datos, si usa sensores… Cuanto más detallada, mejor resultado."
                    required
                    rows={5}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all text-sm resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Cuanto más detallada la descripción, mejor resultado. Puedes usar el <strong className="text-slate-400">Modo guiado</strong> para que la IA te haga preguntas relevantes.
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
          </div>
        )}

        {/* ════════════════════════ GUIDED MODE ════════════════════════ */}
        {phase === 'guided' && (
          <form onSubmit={handleGuidedSubmit} className="space-y-4">
            <div className="glass rounded-2xl p-5 border border-violet-500/20 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Wand2 size={15} className="text-violet-400" />
                <span className="text-sm font-medium text-violet-300">Modo guiado — {form.name}</span>
              </div>
              <p className="text-xs text-slate-400">
                Responde estas preguntas para que Claude entienda mejor tu idea. Puedes dejar en blanco las que no apliquen.
              </p>

              {form.description.trim() && (
                <div className="bg-white/[0.03] rounded-xl px-4 py-3 border border-white/[0.06]">
                  <p className="text-xs text-slate-500 mb-1">Descripción inicial</p>
                  <p className="text-sm text-slate-300">{form.description}</p>
                </div>
              )}

              {guidedQuestions.map((q, i) => (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    <span className="text-slate-500 mr-2">{i + 1}.</span>{q.text}
                  </label>
                  <input
                    value={guidedAnswers[q.id] || ''}
                    onChange={e => setGuidedAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Tu respuesta aquí (opcional)..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-all text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPhase('idle')}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-sm hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Volver
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold text-sm hover:from-violet-400 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Play size={14} />
                Generar con estas respuestas
              </button>
            </div>
          </form>
        )}

        {/* ════════════════ STREAMING / RESULT / DEBUG ════════════════ */}
        {(isStreaming || phase === 'done' || phase === 'error' || phase === 'debug_form') && (
          <div className="space-y-4">

            {/* Progress steps */}
            {(isStreaming || phase === 'done') && (
              <div className="glass rounded-2xl p-4 border border-white/[0.06]">
                <div className="flex items-center gap-1 flex-wrap">
                  {activeSteps.map((step, idx) => {
                    const { Icon } = step
                    const isPast   = idx < stepIdx
                    const isActive = step.id === currentStep && isStreaming
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
            )}

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
                  {isStreaming && (
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
                      App generada e instalada en el dispositivo.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {resultApp.slug && (
                    <Link
                      to={`/app/${resultApp.slug}`}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors min-h-[48px]"
                    >
                      Ver en tienda <ChevronRight size={14} />
                    </Link>
                  )}
                  <Link
                    to="/developer"
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.06] transition-colors min-h-[48px]"
                  >
                    Panel developer
                  </Link>
                </div>
              </div>
            )}

            {/* ── Debug/improve form (shown after done) ── */}
            {phase === 'done' && resultApp?.installed_id && (
              <DebugForm
                feedback={debugFeedback}
                onFeedbackChange={setDebugFeedback}
                onSubmit={handleDebugSubmit}
              />
            )}

            {/* Reset button */}
            {(phase === 'done' || phase === 'error') && (
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.06] transition-colors min-h-[48px]"
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

// ─── Debug/improve sub-component ─────────────────────────────────────────
function DebugForm({ feedback, onFeedbackChange, onSubmit }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="glass rounded-2xl border border-indigo-500/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <WrenchIcon size={15} className="text-indigo-400" />
          <span className="text-sm font-medium text-indigo-300">Mejorar o corregir esta app</span>
          <span className="text-xs text-slate-500 hidden sm:inline">— dile a Claude qué cambiar</span>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {open && (
        <form onSubmit={onSubmit} className="px-5 pb-5 space-y-3 border-t border-white/[0.04]">
          <p className="text-xs text-slate-400 pt-3">
            Describe qué funciona, qué no funciona y qué quieres añadir o cambiar. Claude regenerará la app completa aplicando tus cambios.
          </p>
          <textarea
            value={feedback}
            onChange={e => onFeedbackChange(e.target.value)}
            placeholder={`Ej: "El botón de reset no hace nada. Quiero que también muestre la mejor puntuación de todas las partidas y que los colores sean más vibrantes."`}
            required
            rows={4}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all text-sm resize-none"
          />
          <button
            type="submit"
            disabled={!feedback.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm hover:from-indigo-400 hover:to-violet-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 min-h-[48px]"
          >
            <ArrowRight size={14} />
            Regenerar con mejoras
          </button>
        </form>
      )}
    </div>
  )
}
