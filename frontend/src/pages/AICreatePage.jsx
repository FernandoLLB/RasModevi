import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, ChevronRight, Check, Loader2, AlertCircle,
  Code2, Package, Store, Zap, RotateCcw, Lightbulb,
  MessageSquare, Wand2, ChevronDown, ChevronUp,
  WrenchIcon, ArrowRight, ArrowLeft, PenLine,
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

// ─── Example prompts — ideas originales, no apps típicas de demo ──────────
const EXAMPLES = [
  {
    emoji: '🌱',
    tag: 'Hogar',
    color: 'emerald',
    name: 'Monitor de Plantas',
    description: 'App para llevar el registro de mis plantas de casa. Quiero añadir cada planta con su nombre y foto (emoji), marcar cuándo la riego, y que me muestre cuántos días han pasado desde el último riego con un indicador de colores (verde, amarillo, rojo). Los datos se guardan para no perderlos.',
  },
  {
    emoji: '🎲',
    tag: 'Diversión',
    color: 'violet',
    name: 'Ruleta de Decisiones',
    description: 'Una ruleta giratoria para tomar decisiones. El usuario puede añadir opciones de texto (qué comer, qué película ver, etc.), girar la ruleta con un botón y que se anime girando antes de mostrar el resultado. Las opciones se guardan entre sesiones.',
  },
  {
    emoji: '💧',
    tag: 'Salud',
    color: 'cyan',
    name: 'Contador de Agua',
    description: 'App para controlar cuánta agua bebo al día. Botón grande para sumar vasos, meta diaria configurable (por defecto 8 vasos), barra de progreso visual, historial de los últimos 7 días con gráfica de barras, y se reinicia automáticamente cada día a medianoche.',
  },
  {
    emoji: '📚',
    tag: 'Estudio',
    color: 'amber',
    name: 'Flashcards de Estudio',
    description: 'Tarjetas de memoria para estudiar. El usuario crea tarjetas con una pregunta por delante y la respuesta por detrás. Al estudiar, las tarjetas aparecen en orden aleatorio, se voltean con un click, y puede marcarlas como "sabida" o "repasar". El sistema guarda el progreso.',
  },
  {
    emoji: '🎨',
    tag: 'Creativo',
    color: 'rose',
    name: 'Generador de Paletas',
    description: 'Genera paletas de 5 colores armoniosas aleatoriamente. Muestra los colores como rectángulos grandes con su código HEX debajo. Botón "Copiar" en cada color, botón "Nueva paleta" para generar otra, y sección de favoritos donde guardar las paletas que más gusten.',
  },
  {
    emoji: '✏️',
    tag: 'Creativo',
    color: 'indigo',
    name: 'Pizarra Digital',
    description: 'Canvas de dibujo libre con colores seleccionables, varios grosores de trazo, goma de borrar, botón de limpiar todo y botón para descargar el dibujo como imagen PNG. El trazo debe ser suave y funcionar bien con el dedo en pantalla táctil.',
  },
  {
    emoji: '🌙',
    tag: 'Salud',
    color: 'indigo',
    name: 'Diario de Sueño',
    description: 'Registro de horas de sueño. Cada día puedo añadir a qué hora me acosté y me levanté, y la app calcula las horas dormidas. Muestra la semana actual con una gráfica de barras, el promedio semanal y si estoy por encima o debajo de 8 horas. Los registros se guardan.',
  },
  {
    emoji: '🔄',
    tag: 'Utilidad',
    color: 'teal',
    name: 'Conversor de Unidades',
    description: 'Conversor de unidades con varias categorías: temperatura (°C, °F, K), peso (kg, lb, oz), longitud (km, mi, m, ft) y volumen (L, gal, ml). Interfaz con dos campos: escribo el valor en uno y se actualiza el otro al instante. Cada categoría tiene su propio color.',
  },
]

const colorMap = {
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20',
  violet:  'bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/20',
  cyan:    'bg-cyan-500/10 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20',
  amber:   'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20',
  rose:    'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20',
  indigo:  'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20',
  teal:    'bg-teal-500/10 border-teal-500/20 text-teal-300 hover:bg-teal-500/20',
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AICreatePage() {
  const { isDeveloper } = useAuth()
  const [categories, setCategories] = useState([])

  // Form data
  const [form, setForm] = useState({ name: '', description: '', category_id: '' })

  // UI mode: 'libre' | 'guiado'
  const [mode, setMode] = useState('libre')

  // Global phase: 'idle' | 'guided_questions' | 'streaming' | 'done' | 'error' | 'debug_streaming'
  const [phase, setPhase] = useState('idle')

  // Generation/streaming state
  const [currentStep, setCurrentStep]   = useState(null)
  const [codeText, setCodeText]         = useState('')
  const [errorMsg, setErrorMsg]         = useState('')
  const [resultApp, setResultApp]       = useState(null)
  const [isDebugMode, setIsDebugMode]   = useState(false)

  // Examples
  const [showExamples, setShowExamples] = useState(false)

  // Guided mode state
  const [guidedLoading, setGuidedLoading]       = useState(false)
  const [guidedQuestions, setGuidedQuestions]   = useState([])  // [{id, text, options}]
  const [guidedStep, setGuidedStep]             = useState(0)
  const [guidedAnswers, setGuidedAnswers]        = useState({}) // {id: answer_string}
  const [showCustom, setShowCustom]             = useState(false)
  const [customText, setCustomText]             = useState('')

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

  // ── Token helper ──────────────────────────────────────────────────────────
  const getToken = async () => {
    try { return await refreshTokens() } catch { return localStorage.getItem('access_token') }
  }

  // ── SSE helper ────────────────────────────────────────────────────────────
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

  // ── Libre: standard generation ────────────────────────────────────────────
  const handleLibreSubmit = async (e) => {
    e?.preventDefault()
    if (!form.name.trim() || !form.description.trim()) return
    await doGenerate(form.name, form.description, form.category_id)
  }

  const doGenerate = async (name, description, category_id) => {
    const token = await getToken()
    if (!token) { setErrorMsg('Debes iniciar sesión.'); setPhase('error'); return }

    setPhase('streaming')
    setCurrentStep('connecting')
    setCodeText('')
    setErrorMsg('')
    setResultApp(null)
    setIsDebugMode(false)

    const qs = new URLSearchParams({
      name, description, token,
      ...(category_id ? { category_id } : {}),
    })
    startSSE(`${STORE_BASE}/api/ai/create-app?${qs}`, (data) => {
      setResultApp({ id: data.app_id, slug: data.app_slug, installed_id: data.installed_id, message: data.message })
    })
  }

  // ── Guided: fetch questions ───────────────────────────────────────────────
  const handleStartGuided = async () => {
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
    } catch {
      setGuidedQuestions([
        { id: 'q1', text: '¿Para qué lo usarías principalmente?',
          options: ['Para uso personal del día a día', 'Para compartir con otras personas', 'Como entretenimiento o juego'] },
        { id: 'q2', text: '¿Debe recordar lo que haces entre sesiones?',
          options: ['Sí, quiero que guarde todo', 'Solo lo más importante', 'No hace falta'] },
        { id: 'q3', text: '¿Qué aspecto visual prefieres?',
          options: ['Sencillo y limpio', 'Colorido y llamativo', 'Como una app profesional'] },
      ])
    } finally {
      setGuidedLoading(false)
      setGuidedStep(0)
      setGuidedAnswers({})
      setShowCustom(false)
      setCustomText('')
      setPhase('guided_questions')
    }
  }

  // ── Guided: advance to next question ─────────────────────────────────────
  const handleGuidedNext = () => {
    const q = guidedQuestions[guidedStep]
    // Save current answer (chip or custom text)
    const answer = showCustom ? customText.trim() : (guidedAnswers[q.id] || '')
    const newAnswers = { ...guidedAnswers, [q.id]: answer }
    setGuidedAnswers(newAnswers)

    if (guidedStep < guidedQuestions.length - 1) {
      setGuidedStep(s => s + 1)
      setShowCustom(false)
      setCustomText('')
    } else {
      // All questions done → compose description and generate
      const parts = guidedQuestions
        .map(gq => ({ text: gq.text, answer: newAnswers[gq.id] }))
        .filter(p => p.answer)
        .map(p => `- ${p.text}: ${p.answer}`)
      const base = form.description.trim() || form.name
      const fullDescription = parts.length
        ? `${base}\n\nDetalles adicionales:\n${parts.join('\n')}`
        : base
      doGenerate(form.name, fullDescription, form.category_id)
    }
  }

  const handleGuidedBack = () => {
    if (guidedStep === 0) {
      setPhase('idle')
    } else {
      setGuidedStep(s => s - 1)
      setShowCustom(false)
      setCustomText('')
    }
  }

  const selectChip = (qId, option) => {
    setGuidedAnswers(a => ({ ...a, [qId]: option }))
    setShowCustom(false)
    setCustomText('')
  }

  const currentGuidedAnswer = () => {
    if (guidedQuestions.length === 0) return ''
    const q = guidedQuestions[guidedStep]
    return showCustom ? customText.trim() : (guidedAnswers[q?.id] || '')
  }

  // ── Debug ─────────────────────────────────────────────────────────────────
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

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    esRef.current?.close()
    setPhase('idle')
    setCurrentStep(null)
    setCodeText('')
    setErrorMsg('')
    setResultApp(null)
    setIsDebugMode(false)
    setGuidedQuestions([])
    setGuidedStep(0)
    setGuidedAnswers({})
    setShowCustom(false)
    setCustomText('')
    setDebugFeedback('')
    setForm({ name: '', description: '', category_id: '' })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeSteps = (phase === 'debug_streaming' || (phase === 'done' && isDebugMode))
    ? DEBUG_STEPS : STEPS
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

        {/* ══════════════════════════ IDLE PHASE ══════════════════════════ */}
        {phase === 'idle' && (
          <div className="space-y-4">

            {/* Mode toggle */}
            <div className="flex rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
              {[
                { key: 'libre',  label: 'Modo libre',   icon: <PenLine size={13} /> },
                { key: 'guiado', label: 'Modo guiado',  icon: <Wand2 size={13} /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
                    mode === key
                      ? 'bg-gradient-to-r from-violet-500/20 to-indigo-500/20 text-white border-b-2 border-indigo-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Examples toggle */}
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
                    <span className="text-xl shrink-0 mt-0.5">{ex.emoji}</span>
                    <div className="min-w-0">
                      <span className="text-xs opacity-50 block mb-0.5">{ex.tag}</span>
                      <p className="text-sm font-medium leading-snug">{ex.name}</p>
                      <p className="text-xs opacity-55 mt-0.5 line-clamp-2">{ex.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── Libre form ── */}
            {mode === 'libre' && (
              <form onSubmit={handleLibreSubmit} className="space-y-4">
                <div className="glass rounded-2xl p-5 border border-white/[0.06] space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre de la app</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Monitor de Plantas"
                      required
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción detallada</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Describe qué hace la app, sus funciones, botones, si guarda datos… Cuanto más detallada, mejor resultado."
                      required
                      rows={5}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all text-sm resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Si prefieres que la IA te haga preguntas para ayudarte, usa el <strong className="text-slate-400">Modo guiado</strong>.
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
                        <option key={cat.id} value={cat.id} style={{ background: '#0f0f1a' }}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isDeveloper && <DeveloperWarning />}

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

            {/* ── Guided form (start) ── */}
            {mode === 'guiado' && (
              <div className="space-y-4">
                <div className="glass rounded-2xl p-5 border border-violet-500/15 space-y-4">
                  <p className="text-sm text-slate-400">
                    La IA te hará <strong className="text-violet-300">3 preguntas</strong> con opciones para concretar tu idea antes de generar la app.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre de la app</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Diario de Sueño"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      ¿Alguna idea inicial? <span className="text-slate-600">(opcional)</span>
                    </label>
                    <input
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Ej: quiero registrar mis horas de sueño cada día…"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Categoría <span className="text-slate-600">(opcional)</span>
                    </label>
                    <select
                      value={form.category_id}
                      onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-violet-500/50 transition-all text-sm appearance-none cursor-pointer"
                    >
                      <option value="" style={{ background: '#0f0f1a' }}>Sin categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id} style={{ background: '#0f0f1a' }}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isDeveloper && <DeveloperWarning />}

                <button
                  onClick={handleStartGuided}
                  disabled={!isDeveloper || !form.name.trim() || guidedLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold text-sm hover:from-violet-400 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  {guidedLoading
                    ? <><Loader2 size={16} className="animate-spin" /> Preparando preguntas…</>
                    : <><Wand2 size={16} /> Empezar modo guiado</>
                  }
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ GUIDED QUESTIONS ══════════════════════ */}
        {phase === 'guided_questions' && guidedQuestions.length > 0 && (
          <GuidedQuestion
            questions={guidedQuestions}
            step={guidedStep}
            answers={guidedAnswers}
            showCustom={showCustom}
            customText={customText}
            onSelectChip={selectChip}
            onToggleCustom={() => {
              setShowCustom(v => !v)
              if (!showCustom) {
                const q = guidedQuestions[guidedStep]
                setGuidedAnswers(a => ({ ...a, [q.id]: '' }))
              }
              setCustomText('')
            }}
            onCustomTextChange={setCustomText}
            onNext={handleGuidedNext}
            onBack={handleGuidedBack}
            hasAnswer={!!currentGuidedAnswer()}
          />
        )}

        {/* ════════════════════ STREAMING / RESULT ════════════════════ */}
        {(isStreaming || phase === 'done' || phase === 'error') && (
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
                          {isActive ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} />}
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
                  <span className="ml-auto text-xs text-slate-600 font-mono">{codeText.length.toLocaleString()} chars</span>
                </div>
                <pre
                  ref={codeRef}
                  className="text-xs text-emerald-300/75 font-mono p-4 overflow-auto max-h-72 leading-relaxed"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                >
                  {codeText}
                  {isStreaming && <span className="animate-pulse text-indigo-400">▋</span>}
                </pre>
              </div>
            )}

            {/* Error */}
            {phase === 'error' && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-300">Error al generar la app</p>
                  <p className="text-xs text-red-400/70 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Success */}
            {phase === 'done' && resultApp && (
              <div className="glass rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Check size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{resultApp.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">App generada e instalada en el dispositivo.</p>
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

            {/* Debug/improve panel */}
            {phase === 'done' && resultApp?.installed_id && (
              <DebugPanel
                feedback={debugFeedback}
                onFeedbackChange={setDebugFeedback}
                onSubmit={handleDebugSubmit}
              />
            )}

            {/* Reset */}
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

// ─── Guided question card (one at a time) ────────────────────────────────────
function GuidedQuestion({
  questions, step, answers, showCustom, customText,
  onSelectChip, onToggleCustom, onCustomTextChange, onNext, onBack, hasAnswer,
}) {
  const q = questions[step]
  const isLast = step === questions.length - 1
  const selectedChip = !showCustom ? (answers[q.id] || null) : null

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 shrink-0">
          {step + 1} / {questions.length}
        </span>
      </div>

      {/* Question card */}
      <div className="glass rounded-2xl p-5 border border-violet-500/15 space-y-4">
        <p className="text-base font-semibold text-white leading-snug">{q.text}</p>

        {/* Option chips */}
        <div className="flex flex-col gap-2">
          {q.options?.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelectChip(q.id, opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all min-h-[48px] ${
                selectedChip === opt
                  ? 'bg-violet-500/20 border-violet-500/40 text-white font-medium'
                  : 'bg-white/[0.03] border-white/[0.07] text-slate-300 hover:bg-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              {selectedChip === opt && <span className="mr-2 text-violet-400">✓</span>}
              {opt}
            </button>
          ))}

          {/* Custom option */}
          <button
            type="button"
            onClick={onToggleCustom}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-all min-h-[48px] ${
              showCustom
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            <PenLine size={14} />
            <span>Escribir mi propia respuesta…</span>
          </button>
          {showCustom && (
            <textarea
              autoFocus
              value={customText}
              onChange={e => onCustomTextChange(e.target.value)}
              placeholder="Escribe aquí tu respuesta personalizada…"
              rows={2}
              className="w-full bg-white/[0.04] border border-indigo-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all text-sm resize-none"
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 text-sm hover:text-white hover:bg-white/[0.06] transition-colors min-h-[48px]"
        >
          <ArrowLeft size={14} />
          {step === 0 ? 'Volver' : 'Anterior'}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold text-sm hover:from-violet-400 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-500/20 min-h-[48px]"
        >
          {isLast
            ? <><Sparkles size={14} /> Generar app</>
            : <>Siguiente <ArrowRight size={14} /></>
          }
        </button>
      </div>

      {/* Skip link */}
      {!hasAnswer && (
        <p className="text-center">
          <button
            type="button"
            onClick={onNext}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Saltar esta pregunta
          </button>
        </p>
      )}
    </div>
  )
}

// ─── Debug / improve panel ────────────────────────────────────────────────────
function DebugPanel({ feedback, onFeedbackChange, onSubmit }) {
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
            Describe qué funciona bien, qué falla y qué quieres añadir o cambiar. Claude regenerará la app completa aplicando tus cambios.
          </p>
          <textarea
            value={feedback}
            onChange={e => onFeedbackChange(e.target.value)}
            placeholder={`Ej: "El botón de reset no hace nada. Quiero que también guarde el historial de las últimas 10 partidas y que los colores sean más vibrantes."`}
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

// ─── Developer warning ────────────────────────────────────────────────────────
function DeveloperWarning() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
      <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-300">
        Necesitas una cuenta <strong>developer</strong> para crear apps.{' '}
        <Link to="/login" className="underline">Inicia sesión</Link> con una cuenta developer o admin.
      </p>
    </div>
  )
}
