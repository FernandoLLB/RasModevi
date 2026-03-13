import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sparkles, ChevronRight, Check, Loader2, AlertCircle,
  Code2, Package, Store, Zap, RotateCcw,
  MessageSquare, Wand2, ChevronDown, ChevronUp,
  WrenchIcon, ArrowRight, ArrowLeft, PenLine,
  Upload, Globe, ImageOff, Clock,
} from 'lucide-react'
import DeviceLayout from '../components/layout/DeviceLayout'
import { storeApi } from '../api/store'
import { deviceApi } from '../api/device'
import { STORE_BASE, DEVICE_BASE, refreshTokens } from '../api/client'
import { useAuth } from '../context/AuthContext'

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  { id: 'connecting',  label: 'Conectando',   Icon: Zap },
  { id: 'generating',  label: 'Generando',    Icon: Code2 },
  { id: 'describing',  label: 'Describiendo', Icon: MessageSquare },
  { id: 'packaging',   label: 'Empaquetando', Icon: Package },
  { id: 'registering', label: 'Registrando',  Icon: Store },
  { id: 'done',        label: 'Listo',        Icon: Check },
]

const DEBUG_STEPS = [
  { id: 'connecting',  label: 'Conectando',   Icon: Zap },
  { id: 'generating',  label: 'Mejorando',    Icon: WrenchIcon },
  { id: 'packaging',   label: 'Actualizando', Icon: Package },
  { id: 'done',        label: 'Listo',        Icon: Check },
]

const MODELS = [
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Haiku',
    tagline: 'Rápido y económico',
    detail: 'Prototipos y apps simples',
    intelligence: 1,
    cost: 1,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Sonnet',
    tagline: 'Equilibrado',
    detail: 'Recomendado',
    intelligence: 2,
    cost: 2,
    badge: 'Recomendado',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Opus',
    tagline: 'Máxima calidad',
    detail: 'Apps complejas',
    intelligence: 3,
    cost: 3,
  },
]

const EXAMPLES = [
  { emoji: '🌱', name: 'Monitor de Plantas',     desc: 'Registro de riego con alertas por colores',
    full: 'App para llevar el registro de mis plantas de casa. Quiero añadir cada planta con su nombre y foto (emoji), marcar cuándo la riego, y que me muestre cuántos días han pasado desde el último riego con un indicador de colores (verde, amarillo, rojo). Los datos se guardan para no perderlos.' },
  { emoji: '🎲', name: 'Ruleta de Decisiones',   desc: 'Gira la ruleta para elegir opciones',
    full: 'Una ruleta giratoria para tomar decisiones. El usuario puede añadir opciones de texto (qué comer, qué película ver, etc.), girar la ruleta con un botón y que se anime girando antes de mostrar el resultado. Las opciones se guardan entre sesiones.' },
  { emoji: '💧', name: 'Contador de Agua',       desc: 'Controla tu hidratación diaria',
    full: 'App para controlar cuánta agua bebo al día. Botón grande para sumar vasos, meta diaria configurable (por defecto 8 vasos), barra de progreso visual, historial de los últimos 7 días con gráfica de barras, y se reinicia automáticamente cada día a medianoche.' },
  { emoji: '📚', name: 'Flashcards de Estudio',  desc: 'Tarjetas de memoria con repaso',
    full: 'Tarjetas de memoria para estudiar. El usuario crea tarjetas con una pregunta por delante y la respuesta por detrás. Al estudiar, las tarjetas aparecen en orden aleatorio, se voltean con un click, y puede marcarlas como "sabida" o "repasar". El sistema guarda el progreso.' },
  { emoji: '🎨', name: 'Generador de Paletas',   desc: 'Paletas de colores con código HEX',
    full: 'Genera paletas de 5 colores armoniosas aleatoriamente. Muestra los colores como rectángulos grandes con su código HEX debajo. Botón "Copiar" en cada color, botón "Nueva paleta" para generar otra, y sección de favoritos donde guardar las paletas que más gusten.' },
  { emoji: '✏️', name: 'Pizarra Digital',        desc: 'Dibujo libre con descarga PNG',
    full: 'Canvas de dibujo libre con colores seleccionables, varios grosores de trazo, goma de borrar, botón de limpiar todo y botón para descargar el dibujo como imagen PNG. El trazo debe ser suave y funcionar bien con el dedo en pantalla táctil.' },
  { emoji: '🌙', name: 'Diario de Sueño',       desc: 'Registro y gráfica de horas dormidas',
    full: 'Registro de horas de sueño. Cada día puedo añadir a qué hora me acosté y me levanté, y la app calcula las horas dormidas. Muestra la semana actual con una gráfica de barras, el promedio semanal y si estoy por encima o debajo de 8 horas. Los registros se guardan.' },
  { emoji: '🔄', name: 'Conversor de Unidades',  desc: 'Temperatura, peso, longitud y más',
    full: 'Conversor de unidades con varias categorías: temperatura (°C, °F, K), peso (kg, lb, oz), longitud (km, mi, m, ft) y volumen (L, gal, ml). Interfaz con dos campos: escribo el valor en uno y se actualiza el otro al instante. Cada categoría tiene su propio color.' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AICreatePage() {
  const { isDeveloper } = useAuth()
  const navigate = useNavigate()
  const [pendingNav, setPendingNav] = useState(null)
  const [categories, setCategories] = useState([])
  const [form, setForm]   = useState({ name: '', description: '', category_id: '' })
  const [mode, setMode]   = useState('libre')
  const [phase, setPhase] = useState('idle')

  const [currentStep, setCurrentStep] = useState(null)
  const [codeText, setCodeText]       = useState('')
  const [errorMsg, setErrorMsg]       = useState('')
  const [errorDetail, setErrorDetail] = useState('')
  const [errorOverloaded, setErrorOverloaded] = useState(false)
  const [resultApp, setResultApp]     = useState(null)
  const [isDebugMode, setIsDebugMode] = useState(false)

  const [guidedLoading, setGuidedLoading]     = useState(false)
  const [guidedQuestions, setGuidedQuestions] = useState([])
  const [guidedStep, setGuidedStep]           = useState(0)
  const [guidedAnswers, setGuidedAnswers]     = useState({})
  const [showCustom, setShowCustom]           = useState(false)
  const [customText, setCustomText]           = useState('')

  const [debugFeedback, setDebugFeedback] = useState('')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6')

  // ── Improve tab state ────────────────────────────────────────────────────
  const [mainTab, setMainTab]                   = useState('crear')
  const [improveApps, setImproveApps]           = useState([])
  const [improveAppsLoading, setImproveAppsLoading] = useState(false)
  const [improveAppsError, setImproveAppsError] = useState('')
  const [selectedImproveApp, setSelectedImproveApp] = useState(null)
  const [improveFeedback, setImproveFeedback]   = useState('')

  // ── Publish panel state ──────────────────────────────────────────────────
  const [showPublish, setShowPublish]       = useState(false)
  const [publishForm, setPublishForm]       = useState({ name: '', description: '', category_id: '' })
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishResult, setPublishResult]   = useState(null)

  const codeRef = useRef(null)
  const esRef   = useRef(null)

  const isStreaming = phase === 'streaming' || phase === 'debug_streaming'

  useEffect(() => {
    storeApi.getCategories().then(setCategories).catch(console.error)
    return () => esRef.current?.close()
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (!isStreaming) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isStreaming])

  useEffect(() => {
    if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight
  }, [codeText])

  // Intercept internal link clicks while streaming
  useEffect(() => {
    if (!isStreaming) return
    const handleClick = (e) => {
      const anchor = e.target.closest('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto')) return
      e.preventDefault()
      e.stopPropagation()
      setPendingNav(href)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isStreaming])

  /* ── helpers ─────────────────────────────────────────────────────────── */
  const getToken = async () => {
    try { return await refreshTokens() } catch { return localStorage.getItem('access_token') }
  }

  const startSSE = (url, onDone) => {
    const controller = new AbortController()
    esRef.current = { close: () => controller.abort() }

    fetch(url, { signal: controller.signal, headers: { Accept: 'text/event-stream' } })
      .then(async (res) => {
        if (!res.ok) {
          let msg = `Error del servidor (${res.status})`
          try { const b = await res.json(); msg = b.detail || msg } catch {}
          setErrorMsg(msg); setPhase('error')
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let nlnl = buffer.indexOf('\n\n')
          while (nlnl !== -1) {
            const event = buffer.slice(0, nlnl)
            buffer = buffer.slice(nlnl + 2)
            for (const line of event.split('\n')) {
              if (!line.startsWith('data: ')) continue
              try {
                const d = JSON.parse(line.slice(6))
                if (d.type === 'status') setCurrentStep(d.step)
                else if (d.type === 'code_chunk') setCodeText(p => p + d.text)
                else if (d.type === 'done') {
                  setCurrentStep('done'); setPhase('done'); onDone(d)
                } else if (d.type === 'error') {
                  setErrorMsg(d.message)
                  setErrorDetail(d.detail || '')
                  setErrorOverloaded(d.overloaded || false)
                  setPhase('error')
                }
              } catch {}
            }
            nlnl = buffer.indexOf('\n\n')
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setErrorMsg(`Error de conexión: ${err.message}`)
          setPhase('error')
        }
      })
  }

  /* ── generate ────────────────────────────────────────────────────────── */
  const doGenerate = async (name, description, category_id) => {
    const token = await getToken()
    if (!token) { setErrorMsg('Debes iniciar sesión.'); setPhase('error'); return }
    setPhase('streaming'); setCurrentStep('connecting'); setCodeText(''); setErrorMsg(''); setErrorDetail(''); setErrorOverloaded(false); setResultApp(null); setIsDebugMode(false)
    const qs = new URLSearchParams({ name, description, token, model: selectedModel, ...(category_id ? { category_id } : {}) })
    startSSE(`${DEVICE_BASE}/api/ai/create-app?${qs}`, (d) => {
      setResultApp({ id: d.app_id, slug: d.app_slug, installed_id: d.installed_id, message: d.message })
      setPublishForm({ name, description, category_id: category_id ? String(category_id) : '' })
      setPublishResult(null)
    })
  }

  const handleLibreSubmit = async (e) => {
    e?.preventDefault()
    if (!form.name.trim() || !form.description.trim()) return
    await doGenerate(form.name, form.description, form.category_id)
  }

  /* ── guided ──────────────────────────────────────────────────────────── */
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
      setGuidedQuestions((await res.json()).questions || [])
    } catch {
      setGuidedQuestions([
        { id: 'q1', text: '¿Para qué lo usarías principalmente?', options: ['Para uso personal del día a día', 'Para compartir con otras personas', 'Como entretenimiento o juego'] },
        { id: 'q2', text: '¿Debe recordar lo que haces entre sesiones?', options: ['Sí, quiero que guarde todo', 'Solo lo más importante', 'No hace falta'] },
        { id: 'q3', text: '¿Qué aspecto visual prefieres?', options: ['Sencillo y limpio', 'Colorido y llamativo', 'Como una app profesional'] },
      ])
    } finally {
      setGuidedLoading(false); setGuidedStep(0); setGuidedAnswers({}); setShowCustom(false); setCustomText('')
      setPhase('guided_questions')
    }
  }

  const handleGuidedNext = () => {
    const q = guidedQuestions[guidedStep]
    const answer = showCustom ? customText.trim() : (guidedAnswers[q.id] || '')
    const newAnswers = { ...guidedAnswers, [q.id]: answer }
    setGuidedAnswers(newAnswers)
    if (guidedStep < guidedQuestions.length - 1) {
      setGuidedStep(s => s + 1); setShowCustom(false); setCustomText('')
    } else {
      const parts = guidedQuestions.map(gq => ({ text: gq.text, answer: newAnswers[gq.id] })).filter(p => p.answer).map(p => `- ${p.text}: ${p.answer}`)
      const base = form.description.trim() || form.name
      doGenerate(form.name, parts.length ? `${base}\n\nDetalles adicionales:\n${parts.join('\n')}` : base, form.category_id)
    }
  }

  const handleGuidedBack = () => {
    if (guidedStep === 0) setPhase('idle')
    else { setGuidedStep(s => s - 1); setShowCustom(false); setCustomText('') }
  }

  const selectChip = (qId, opt) => { setGuidedAnswers(a => ({ ...a, [qId]: opt })); setShowCustom(false); setCustomText('') }

  const currentGuidedAnswer = () => {
    if (!guidedQuestions.length) return ''
    const q = guidedQuestions[guidedStep]
    return showCustom ? customText.trim() : (guidedAnswers[q?.id] || '')
  }

  /* ── debug (from post-create panel) ──────────────────────────────────── */
  const handleDebugSubmit = async (e) => {
    e.preventDefault()
    if (!debugFeedback.trim() || !resultApp?.installed_id) return
    const token = await getToken()
    if (!token) { setErrorMsg('Debes iniciar sesión.'); setPhase('error'); return }
    setPhase('debug_streaming'); setCurrentStep('connecting'); setCodeText(''); setErrorMsg(''); setErrorDetail(''); setErrorOverloaded(false); setIsDebugMode(true)
    const qs = new URLSearchParams({ installed_id: resultApp.installed_id, feedback: debugFeedback, token, model: selectedModel })
    startSSE(`${DEVICE_BASE}/api/ai/debug-app?${qs}`, (d) => {
      setResultApp(prev => ({ ...prev, id: d.app_id ?? prev.id, slug: d.app_slug ?? prev.slug, installed_id: d.installed_id ?? prev.installed_id, message: d.message }))
      setDebugFeedback('')
    })
  }

  /* ── improve tab ──────────────────────────────────────────────────────── */
  const fetchImproveApps = async () => {
    setImproveAppsLoading(true)
    setImproveAppsError('')
    try {
      const data = await deviceApi.getInstalled()
      setImproveApps(Array.isArray(data) ? data : [])
    } catch {
      setImproveAppsError('No se pudieron cargar las apps instaladas. ¿Está la Pi conectada?')
    } finally {
      setImproveAppsLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setMainTab(tab)
    if (tab === 'mejorar' && improveApps.length === 0 && !improveAppsLoading) {
      fetchImproveApps()
    }
  }

  const handleImproveAppSelect = (app) => {
    setSelectedImproveApp(app)
    setShowPublish(false); setPublishResult(null); setPublishLoading(false)
    if (app) {
      setPublishForm({
        name: app.store_app?.name ?? `App #${app.id}`,
        description: app.store_app?.description ?? '',
        category_id: String(app.store_app?.category_id ?? ''),
      })
    } else {
      setPublishForm({ name: '', description: '', category_id: '' })
    }
  }

  const handleImproveSubmit = async (e) => {
    e.preventDefault()
    if (!improveFeedback.trim() || !selectedImproveApp) return
    const token = await getToken()
    if (!token) { setErrorMsg('Debes iniciar sesión.'); setPhase('error'); return }
    setPhase('debug_streaming'); setCurrentStep('connecting'); setCodeText(''); setErrorMsg(''); setErrorDetail(''); setErrorOverloaded(false)
    setIsDebugMode(true); setShowPublish(false); setPublishResult(null)
    const installedId = selectedImproveApp.id
    const appName = selectedImproveApp.store_app?.name ?? `App #${installedId}`
    const qs = new URLSearchParams({ installed_id: installedId, feedback: improveFeedback, token, model: selectedModel })
    startSSE(`${DEVICE_BASE}/api/ai/debug-app?${qs}`, (d) => {
      setResultApp({
        id: d.app_id ?? selectedImproveApp.store_app?.id,
        slug: d.app_slug ?? selectedImproveApp.store_app?.slug,
        installed_id: installedId,
        name: appName,
        message: d.message,
      })
      setImproveFeedback('')
    })
  }

  /* ── publish ──────────────────────────────────────────────────────────── */
  const handlePublish = async (e) => {
    e.preventDefault()
    const installedId = selectedImproveApp?.id ?? resultApp?.installed_id
    if (!publishForm.name.trim() || !installedId) return
    setPublishLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${DEVICE_BASE}/api/ai/publish-improved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          installed_id: installedId,
          name: publishForm.name,
          description: publishForm.description,
          category_id: publishForm.category_id ? parseInt(publishForm.category_id) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Error al publicar')
      }
      const data = await res.json()
      setPublishResult(data)
    } catch (err) {
      setPublishResult({ error: err.message })
    } finally {
      setPublishLoading(false)
    }
  }

  /* ── reset ───────────────────────────────────────────────────────────── */
  const reset = () => {
    esRef.current?.close()
    setPhase('idle'); setCurrentStep(null); setCodeText(''); setErrorMsg(''); setErrorDetail(''); setErrorOverloaded(false); setResultApp(null); setIsDebugMode(false)
    setGuidedQuestions([]); setGuidedStep(0); setGuidedAnswers({}); setShowCustom(false); setCustomText('')
    setDebugFeedback(''); setForm({ name: '', description: '', category_id: '' })
    setSelectedImproveApp(null); setImproveFeedback('')
    setShowPublish(false); setPublishResult(null); setPublishLoading(false)
    setPublishForm({ name: '', description: '', category_id: '' })
  }

  /* ── derived ─────────────────────────────────────────────────────────── */
  const activeSteps = (phase === 'debug_streaming' || (phase === 'done' && isDebugMode)) ? DEBUG_STEPS : STEPS
  const stepIdx = activeSteps.findIndex(s => s.id === currentStep)

  const showResult = isStreaming || phase === 'done' || phase === 'error'
  const showForm   = phase === 'idle' || phase === 'guided_questions'

  /* ── result panel (shared between create and improve) ─────────────────── */
  const resultPanel = showResult && (
    <div className="space-y-4 animate-fade-up">
      {(isStreaming || phase === 'done') && (
        <PipelineSteps steps={activeSteps} currentStep={currentStep} stepIdx={stepIdx} isStreaming={isStreaming} isDone={phase === 'done'} />
      )}
      {codeText && <CodeViewer codeRef={codeRef} code={codeText} streaming={isStreaming} />}
      {phase === 'error' && (
        <div className={`flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl border ${errorOverloaded ? 'bg-amber-500/8 border-amber-500/15' : 'bg-red-500/8 border-red-500/15'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${errorOverloaded ? 'bg-amber-500/15' : 'bg-red-500/15'}`}>
            {errorOverloaded
              ? <Clock size={16} className="text-amber-400" />
              : <AlertCircle size={16} className="text-red-400" />
            }
          </div>
          <div className="pt-1 min-w-0">
            <p className={`text-sm font-semibold ${errorOverloaded ? 'text-amber-300' : 'text-red-300'}`}>
              {errorOverloaded ? 'Modelo saturado' : 'Error al generar'}
            </p>
            <p className={`text-[13px] mt-1 leading-relaxed ${errorOverloaded ? 'text-amber-400/80' : 'text-red-400/70'}`}>
              {errorMsg}
            </p>
            {errorDetail && (
              <p className="text-[11px] text-[var(--text-muted)] mt-2 font-mono break-all opacity-60">
                {errorDetail}
              </p>
            )}
          </div>
        </div>
      )}
      {phase === 'done' && resultApp && (
        <div className="rounded-2xl bg-emerald-500/6 border border-emerald-500/15 p-4 sm:p-5">
          <div className="flex items-start gap-3.5 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Check size={18} className="text-emerald-400" strokeWidth={2.5} />
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-semibold text-white leading-snug">{resultApp.message}</p>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1">App lista en el dispositivo.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {resultApp.installed_id && (
              <Link
                to={`/running/${resultApp.installed_id}`}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/25 active:scale-[0.97] transition-all min-h-[52px] touch-manipulation"
              >
                Abrir app <ChevronRight size={15} />
              </Link>
            )}
            <Link
              to="/launcher"
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:text-white hover:border-[var(--border-hover)] active:scale-[0.97] transition-all min-h-[52px] touch-manipulation"
            >
              Mis apps
            </Link>
          </div>
        </div>
      )}

      {/* ── Improve panel (only for create-mode result) ──────────────────── */}
      {phase === 'done' && resultApp?.installed_id && mainTab === 'crear' && (
        <DebugPanel feedback={debugFeedback} onFeedbackChange={setDebugFeedback} onSubmit={handleDebugSubmit} />
      )}

      {phase === 'done' && resultApp?.installed_id && mainTab === 'crear' && (
        <PublishPanel
          open={showPublish}
          onToggle={() => setShowPublish(v => !v)}
          form={publishForm}
          onFormChange={setPublishForm}
          categories={categories}
          onSubmit={handlePublish}
          loading={publishLoading}
          result={publishResult}
        />
      )}

      {(phase === 'done' || phase === 'error') && (
        <button
          onClick={reset}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:text-white hover:border-[var(--border-hover)] active:scale-[0.97] transition-all min-h-[52px] touch-manipulation"
        >
          <RotateCcw size={15} />
          {mainTab === 'mejorar' ? 'Mejorar otra app' : 'Crear otra app'}
        </button>
      )}
    </div>
  )

  return (
    <DeviceLayout hideSearch>
      {/* Navigation confirmation modal */}
      {pendingNav && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] p-6 space-y-5 shadow-2xl animate-fade-up">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertCircle size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-snug">¿Cancelar la generación?</p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  La IA está generando la app. Si sales ahora el proceso se cancelará y no se creará nada.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingNav(null)}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-hover)] active:scale-[0.97] transition-all min-h-[48px] touch-manipulation"
              >
                Seguir esperando
              </button>
              <button
                onClick={() => { esRef.current?.close(); navigate(pendingNav) }}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-sm font-semibold text-red-300 hover:bg-red-500/25 active:scale-[0.97] transition-all min-h-[48px] touch-manipulation"
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative min-h-[calc(100vh-64px)]">

        {/* ambient glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-[0.06]"
               style={{ background: 'radial-gradient(ellipse, #6366f1 0%, transparent 70%)' }} />
        </div>

        <div className="relative px-4 sm:px-6 xl:px-8 pt-6 pb-10 lg:flex lg:justify-center">
          <div className={showResult ? 'w-full max-w-6xl' : 'w-full max-w-2xl'}>

          {/* ── HEADER ────────────────────────────────────────────────── */}
          <header className="mb-5 animate-fade-in">
            <div className="flex items-center gap-3.5">
              <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
                <Sparkles size={20} className="text-white" />
                <div className="absolute inset-0 rounded-2xl bg-white/10 animate-pulse" style={{ animationDuration: '3s' }} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-tight tracking-tight">
                  IA para apps
                </h1>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                  {mainTab === 'crear' ? 'Describe tu idea — Claude genera la app' : 'Selecciona una app y dile qué cambiar'}
                </p>
              </div>
            </div>
          </header>

          {/* ── MAIN TABS ─────────────────────────────────────────────── */}
          {showForm && (
            <div className="relative flex p-1.5 gap-1.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] mb-5">
              <div
                className="absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/20 transition-all duration-300 ease-out"
                style={{ width: 'calc(50% - 8px)', left: mainTab === 'crear' ? '6px' : 'calc(50% + 2px)' }}
              />
              {[
                { key: 'crear',  label: 'Crear app',    icon: Sparkles,    sub: 'Nueva desde cero' },
                { key: 'mejorar', label: 'Mejorar app', icon: WrenchIcon,  sub: 'Modifica existente' },
              ].map(({ key, label, icon: Icon, sub }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTabChange(key)}
                  className={`relative z-10 flex-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl text-center transition-colors touch-manipulation min-h-[64px]
                    ${mainTab === key ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={15} />
                    <span className="text-sm font-semibold">{label}</span>
                  </span>
                  <span className="text-[11px] opacity-60">{sub}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── TWO-COLUMN only when result is active ── */}
          <div className={showResult
            ? 'lg:grid lg:grid-cols-[420px_1fr] lg:gap-8 xl:grid-cols-[460px_1fr] xl:gap-10'
            : ''
          }>

            {/* ══ LEFT COLUMN: Form / Questions ══ */}
            <div className={showResult ? 'hidden lg:block' : ''}>

              {/* ── CREAR TAB ── */}
              {phase === 'idle' && mainTab === 'crear' && (
                <div className="space-y-5 animate-fade-up">
                  {/* Mode segmented control */}
                  <div className="relative flex p-1.5 gap-1.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)]">
                    <div
                      className="absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/20 transition-all duration-300 ease-out"
                      style={{ width: 'calc(50% - 8px)', left: mode === 'libre' ? '6px' : 'calc(50% + 2px)' }}
                    />
                    {[
                      { key: 'libre',  label: 'Modo libre',  icon: PenLine, sub: 'Tú describes' },
                      { key: 'guiado', label: 'Modo guiado', icon: Wand2,   sub: 'Te guiamos' },
                    ].map(({ key, label, icon: Icon, sub }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMode(key)}
                        className={`relative z-10 flex-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl text-center transition-colors touch-manipulation min-h-[64px]
                          ${mode === key ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={15} />
                          <span className="text-sm font-semibold">{label}</span>
                        </span>
                        <span className="text-[11px] opacity-60">{sub}</span>
                      </button>
                    ))}
                  </div>

                  <ExampleStrip
                    examples={EXAMPLES}
                    onSelect={(ex) => setForm(f => ({ ...f, name: ex.name, description: ex.full }))}
                  />

                  {mode === 'libre' && (
                    <form onSubmit={handleLibreSubmit} className="space-y-4">
                      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-5 space-y-4">
                        <InputField label="Nombre de la app" value={form.name}
                          onChange={v => setForm(f => ({ ...f, name: v }))}
                          placeholder="Ej: Monitor de Plantas" required />
                        <div>
                          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Descripción detallada</label>
                          <textarea
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Describe qué hace la app, sus funciones, botones, si guarda datos… Cuanto más detallada, mejor resultado."
                            required rows={5}
                            className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-sm resize-none leading-relaxed"
                          />
                        </div>
                        <CategorySelect value={form.category_id}
                          onChange={v => setForm(f => ({ ...f, category_id: v }))} categories={categories} />
                        <ModelSelector value={selectedModel} onChange={setSelectedModel} />
                      </div>
                      {!isDeveloper && <DeveloperWarning />}
                      <PrimaryButton type="submit"
                        disabled={!isDeveloper || !form.name.trim() || !form.description.trim()}
                        icon={Sparkles} label="Generar con Claude" />
                    </form>
                  )}

                  {mode === 'guiado' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-5 space-y-4">
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          La IA te hará <strong className="text-violet-400 font-semibold">3 preguntas</strong> con opciones para concretar tu idea antes de generar.
                        </p>
                        <InputField label="Nombre de la app" value={form.name}
                          onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Ej: Diario de Sueño" />
                        <InputField label="¿Alguna idea inicial?" optional value={form.description}
                          onChange={v => setForm(f => ({ ...f, description: v }))}
                          placeholder="Ej: quiero registrar mis horas de sueño cada día…" />
                        <CategorySelect value={form.category_id}
                          onChange={v => setForm(f => ({ ...f, category_id: v }))} categories={categories} />
                        <ModelSelector value={selectedModel} onChange={setSelectedModel} />
                      </div>
                      {!isDeveloper && <DeveloperWarning />}
                      <PrimaryButton onClick={handleStartGuided}
                        disabled={!isDeveloper || !form.name.trim() || guidedLoading}
                        icon={guidedLoading ? Loader2 : Wand2} iconSpin={guidedLoading}
                        label={guidedLoading ? 'Preparando preguntas…' : 'Empezar modo guiado'} />
                    </div>
                  )}
                </div>
              )}

              {/* ── GUIDED QUESTIONS ── */}
              {phase === 'guided_questions' && guidedQuestions.length > 0 && (
                <GuidedQuestionView
                  questions={guidedQuestions} step={guidedStep} answers={guidedAnswers}
                  showCustom={showCustom} customText={customText}
                  onSelectChip={selectChip}
                  onToggleCustom={() => {
                    setShowCustom(v => !v)
                    if (!showCustom) setGuidedAnswers(a => ({ ...a, [guidedQuestions[guidedStep].id]: '' }))
                    setCustomText('')
                  }}
                  onCustomTextChange={setCustomText}
                  onNext={handleGuidedNext} onBack={handleGuidedBack}
                  hasAnswer={!!currentGuidedAnswer()}
                />
              )}

              {/* ── MEJORAR TAB ── */}
              {phase === 'idle' && mainTab === 'mejorar' && (
                <ImproveTab
                  apps={improveApps}
                  loading={improveAppsLoading}
                  error={improveAppsError}
                  selected={selectedImproveApp}
                  onSelect={handleImproveAppSelect}
                  feedback={improveFeedback}
                  onFeedbackChange={setImproveFeedback}
                  onSubmit={handleImproveSubmit}
                  onRefresh={fetchImproveApps}
                  isDeveloper={isDeveloper}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                  publishProps={{
                    open: showPublish,
                    onToggle: () => setShowPublish(v => !v),
                    form: publishForm,
                    onFormChange: setPublishForm,
                    categories,
                    onSubmit: handlePublish,
                    loading: publishLoading,
                    result: publishResult,
                  }}
                />
              )}

              {/* On desktop: show summary of submitted form while result is loading/done */}
              {showResult && (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] p-5 space-y-3 animate-fade-in">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                    {mainTab === 'mejorar' ? 'App mejorada' : 'Solicitud enviada'}
                  </p>
                  <p className="text-base font-bold text-[var(--text-primary)]">
                    {mainTab === 'mejorar'
                      ? (selectedImproveApp?.store_app?.name ?? resultApp?.name ?? '—')
                      : (form.name || '—')}
                  </p>
                  {mainTab === 'mejorar' && improveFeedback && (
                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-4 italic">"{improveFeedback}"</p>
                  )}
                  {mainTab === 'crear' && form.description && (
                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-6">{form.description}</p>
                  )}
                  <button
                    onClick={reset}
                    className="flex items-center gap-2 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors pt-1 touch-manipulation"
                  >
                    <RotateCcw size={13} /> {mainTab === 'mejorar' ? 'Mejorar otra' : 'Nueva app'}
                  </button>
                </div>
              )}
            </div>

            {/* ══ RIGHT COLUMN: Result (always on desktop, mobile only when active) ══ */}
            <div className={showForm ? 'hidden' : 'block lg:flex lg:flex-col lg:justify-center'}>
              {showForm && (
                /* Desktop idle placeholder */
                <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[400px] rounded-2xl border border-dashed border-white/[0.06] p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                    {mainTab === 'crear'
                      ? <Sparkles size={28} className="text-violet-400/60" />
                      : <WrenchIcon size={28} className="text-indigo-400/60" />
                    }
                  </div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">
                    {mainTab === 'crear' ? 'El código generado aparecerá aquí' : 'El código mejorado aparecerá aquí'}
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)]/60 mt-1.5 leading-relaxed max-w-[220px]">
                    {mainTab === 'crear' ? 'Rellena el formulario y pulsa Generar' : 'Selecciona una app y describe los cambios'}
                  </p>
                </div>
              )}
              {showResult && resultPanel}
            </div>

          </div>
          </div>
        </div>
      </div>
    </DeviceLayout>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Improve tab ───────────────────────────────────────────────────────── */
function ImproveTab({ apps, loading, error, selected, onSelect, feedback, onFeedbackChange, onSubmit, onRefresh, isDeveloper, selectedModel, onModelChange, publishProps }) {
  return (
    <div className="space-y-5 animate-fade-up">
      {/* App selector */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-[var(--text-primary)]">Selecciona una app</label>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors touch-manipulation disabled:opacity-40"
          >
            <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
            Recargar
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8 gap-3 text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Cargando apps instaladas…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/8 border border-red-500/15">
            <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-[13px] text-red-300/90 leading-relaxed">{error}</p>
          </div>
        )}

        {!loading && !error && apps.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-muted)]">No hay apps instaladas en el dispositivo.</p>
          </div>
        )}

        {!loading && apps.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {apps.map(app => {
              const isSelected = selected?.id === app.id
              const name = app.store_app?.name ?? `App #${app.id}`
              const desc = app.store_app?.description
              const iconPath = app.store_app?.icon_path
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : app)}
                  className={`flex items-center gap-3 w-full px-3.5 py-3 rounded-xl border text-left transition-all touch-manipulation
                    ${isSelected
                      ? 'bg-violet-500/12 border-violet-500/40 ring-1 ring-violet-500/25'
                      : 'bg-[var(--bg-base)] border-[var(--border)] hover:border-[var(--border-hover)] active:bg-white/[0.03]'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden
                    ${isSelected ? 'bg-violet-500/20' : 'bg-white/[0.04]'}`}>
                    {iconPath
                      ? <img src={iconPath} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display='none' }} />
                      : <Sparkles size={16} className={isSelected ? 'text-violet-400' : 'text-[var(--text-muted)]'} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight truncate ${isSelected ? 'text-violet-200' : 'text-[var(--text-primary)]'}`}>
                      {name}
                    </p>
                    {desc && (
                      <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">{desc}</p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Actions (only when app selected) ── */}
      {selected && (
        <>
          {/* Improve with AI */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-5 space-y-3">
              <label className="block text-sm font-semibold text-[var(--text-primary)]">
                Mejorar con IA
              </label>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed -mt-1">
                Describe los bugs, mejoras o cambios visuales. Claude regenerará la app completa aplicando tus indicaciones.
              </p>
              <textarea
                value={feedback}
                onChange={e => onFeedbackChange(e.target.value)}
                placeholder={'Ej: "El botón de guardar no funciona. Quiero que los colores sean más vibrantes y que se muestre un contador total arriba."'}
                rows={4}
                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm resize-none leading-relaxed"
              />
              <ModelSelector value={selectedModel} onChange={onModelChange} />
            </div>

            {!isDeveloper && <DeveloperWarning />}

            <PrimaryButton
              type="submit"
              disabled={!isDeveloper || !feedback.trim()}
              icon={WrenchIcon}
              label={`Mejorar «${selected.store_app?.name ?? `App #${selected.id}`}»`}
            />
          </form>

          {/* Publish to store */}
          <PublishPanel {...publishProps} />
        </>
      )}

      {!selected && !loading && apps.length > 0 && (
        <p className="text-center text-sm text-[var(--text-muted)] py-2">
          Selecciona una app para mejorarla o publicarla
        </p>
      )}
    </div>
  )
}

/* ── Publish panel ─────────────────────────────────────────────────────── */
function PublishPanel({ open, onToggle, form, onFormChange, categories, onSubmit, loading, result }) {
  if (result?.slug) {
    return (
      <div className="rounded-2xl bg-violet-500/6 border border-violet-500/15 p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
            <Globe size={18} className="text-violet-400" />
          </div>
          <div className="pt-0.5">
            <p className="text-sm font-semibold text-violet-200">¡Publicada en la tienda!</p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">{result.message}</p>
          </div>
        </div>
        <Link
          to={`/app/${result.slug}`}
          className="mt-4 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-300 text-sm font-semibold hover:bg-violet-500/25 active:scale-[0.97] transition-all min-h-[52px] touch-manipulation"
        >
          Ver en la tienda <ChevronRight size={15} />
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-violet-500/12 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.015] active:bg-white/[0.03] transition-colors min-h-[56px] touch-manipulation"
      >
        <span className="flex items-center gap-2.5">
          <Upload size={16} className="text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">Publicar en la tienda</span>
          <span className="text-[11px] text-violet-400/50 font-normal">como nueva app</span>
        </span>
        {open ? <ChevronUp size={15} className="text-[var(--text-muted)]" /> : <ChevronDown size={15} className="text-[var(--text-muted)]" />}
      </button>

      {open && (
        <form onSubmit={onSubmit} className="px-5 pb-5 space-y-4 border-t border-[var(--border)]">
          <p className="text-[13px] text-[var(--text-secondary)] pt-4 leading-relaxed">
            Publica la versión mejorada como una nueva entrada en la tienda con el nombre que elijas.
          </p>

          {result?.error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/8 border border-red-500/15">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-[13px] text-red-300/90">{result.error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Nombre</label>
            <input
              value={form.name}
              onChange={e => onFormChange(f => ({ ...f, name: e.target.value }))}
              placeholder="Nombre de la nueva app"
              required
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-sm min-h-[52px]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => onFormChange(f => ({ ...f, description: e.target.value }))}
              placeholder="Breve descripción de la app para la tienda"
              rows={3}
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-sm resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              Categoría <span className="text-[var(--text-muted)] font-normal ml-1.5 text-[12px]">(opcional)</span>
            </label>
            <select
              value={form.category_id}
              onChange={e => onFormChange(f => ({ ...f, category_id: e.target.value }))}
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-secondary)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-sm appearance-none cursor-pointer min-h-[52px]"
            >
              <option value="" style={{ background: 'var(--bg-base)' }}>Sin categoría</option>
              {categories.map(c => (
                <option key={c.id} value={c.id} style={{ background: 'var(--bg-base)' }}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!form.name.trim() || loading}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm hover:from-violet-500 hover:to-indigo-500 active:scale-[0.97] disabled:opacity-35 disabled:pointer-events-none shadow-lg shadow-violet-500/20 transition-all min-h-[52px] touch-manipulation"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {loading ? 'Publicando…' : 'Publicar en la tienda'}
          </button>
        </form>
      )}
    </div>
  )
}

/* ── Example strip ─────────────────────────────────────────────────────── */
function ExampleStrip({ examples, onSelect }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 mb-3 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors touch-manipulation"
      >
        <span className="text-amber-400/80 text-base">✦</span>
        <span>Ideas de ejemplo</span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {!expanded && (
        /* Horizontal scroll strip */
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          {examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(ex)}
              className="flex items-center gap-2.5 shrink-0 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--border-hover)] active:scale-[0.97] transition-all touch-manipulation min-h-[52px]"
            >
              <span className="text-lg">{ex.emoji}</span>
              <div className="text-left">
                <p className="text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">{ex.name}</p>
                <p className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">{ex.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onSelect(ex); setExpanded(false) }}
              className="flex items-start gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-left hover:border-[var(--border-hover)] active:scale-[0.98] transition-all touch-manipulation min-h-[52px]"
            >
              <span className="text-2xl shrink-0 mt-0.5">{ex.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{ex.name}</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1 leading-relaxed line-clamp-2">{ex.full}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Input field ───────────────────────────────────────────────────────── */
function InputField({ label, optional, value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
        {label}
        {optional && <span className="text-[var(--text-muted)] font-normal ml-1.5 text-[12px]">(opcional)</span>}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-sm min-h-[52px]"
      />
    </div>
  )
}

/* ── Category select ───────────────────────────────────────────────────── */
function CategorySelect({ value, onChange, categories }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
        Categoría <span className="text-[var(--text-muted)] font-normal ml-1.5 text-[12px]">(opcional)</span>
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-sm appearance-none cursor-pointer min-h-[52px]"
      >
        <option value="" style={{ background: 'var(--bg-base)' }}>Sin categoría</option>
        {categories.map(c => (
          <option key={c.id} value={c.id} style={{ background: 'var(--bg-base)' }}>{c.name}</option>
        ))}
      </select>
    </div>
  )
}

/* ── Primary button ────────────────────────────────────────────────────── */
function PrimaryButton({ onClick, type = 'button', disabled, icon: Icon, iconSpin, label }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl
        bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-[15px]
        hover:from-violet-500 hover:to-indigo-500
        active:scale-[0.97]
        disabled:opacity-35 disabled:pointer-events-none
        shadow-lg shadow-indigo-500/20
        transition-all min-h-[56px] touch-manipulation"
    >
      <Icon size={18} className={iconSpin ? 'animate-spin' : ''} />
      {label}
    </button>
  )
}

/* ── Developer warning ─────────────────────────────────────────────────── */
function DeveloperWarning() {
  return (
    <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/15">
      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
        <AlertCircle size={16} className="text-amber-400" />
      </div>
      <p className="text-sm text-amber-300/90 pt-1.5 leading-relaxed">
        Necesitas una cuenta <strong className="font-semibold text-amber-300">developer</strong> para crear apps.{' '}
        <Link to="/login" className="underline underline-offset-2 hover:text-amber-200 transition-colors">Inicia sesión</Link>.
      </p>
    </div>
  )
}

/* ── Model selector ────────────────────────────────────────────────────── */
function ModelSelector({ value, onChange }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--text-primary)] mb-2.5">Modelo IA</p>
      <div className="grid grid-cols-3 gap-2">
        {MODELS.map(m => {
          const active = value === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={`relative flex flex-col items-center gap-1.5 pt-5 pb-3 px-2 rounded-xl border text-center transition-all touch-manipulation
                ${active
                  ? 'bg-violet-500/12 border-violet-500/40 ring-1 ring-violet-500/25'
                  : 'bg-[var(--bg-base)] border-[var(--border)] hover:border-[var(--border-hover)]'
                }`}
            >
              {m.badge && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-violet-500 text-[9px] font-bold text-white whitespace-nowrap leading-tight">
                  {m.badge}
                </span>
              )}
              <span className={`text-sm font-bold leading-tight ${active ? 'text-violet-200' : 'text-[var(--text-primary)]'}`}>
                {m.name}
              </span>
              <span className={`text-[10px] leading-tight ${active ? 'text-violet-300/80' : 'text-[var(--text-muted)]'}`}>
                {m.tagline}
              </span>
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1 justify-center">
                  <span className="text-[10px]">🧠</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map(i => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= m.intelligence ? (active ? 'bg-violet-400' : 'bg-violet-500/60') : 'bg-white/12'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 justify-center">
                  <span className="text-[10px]">💰</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map(i => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= m.cost ? (active ? 'bg-amber-400' : 'bg-amber-500/60') : 'bg-white/12'}`} />
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Guided questions (one at a time) ──────────────────────────────────── */
function GuidedQuestionView({
  questions, step, answers, showCustom, customText,
  onSelectChip, onToggleCustom, onCustomTextChange, onNext, onBack, hasAnswer,
}) {
  const q = questions[step]
  if (!q) return null
  const isLast = step === questions.length - 1

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {questions.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i < step ? 'bg-violet-500' : i === step ? 'bg-violet-400' : 'bg-white/[0.08]'
          }`} />
        ))}
      </div>

      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[12px] font-bold text-violet-400">{step + 1}</span>
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug pt-0.5">{q.text}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelectChip(q.id, opt)}
              className={`px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all touch-manipulation min-h-[44px] text-left leading-snug
                ${answers[q.id] === opt && !showCustom
                  ? 'bg-violet-500/20 border border-violet-500/40 text-violet-200'
                  : 'bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                }`}
            >
              {opt}
            </button>
          ))}

          <button
            type="button"
            onClick={onToggleCustom}
            className={`px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all touch-manipulation min-h-[44px]
              ${showCustom
                ? 'bg-violet-500/20 border border-violet-500/40 text-violet-200'
                : 'bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
              }`}
          >
            Otra respuesta…
          </button>
        </div>

        {showCustom && (
          <textarea
            autoFocus
            value={customText}
            onChange={e => onCustomTextChange(e.target.value)}
            placeholder="Escribe tu respuesta…"
            rows={2}
            className="w-full bg-[var(--bg-base)] border border-violet-500/30 rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-all text-sm resize-none"
          />
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:text-white hover:border-[var(--border-hover)] active:scale-[0.97] transition-all min-h-[52px] touch-manipulation"
        >
          <ArrowLeft size={15} /> Atrás
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasAnswer}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-indigo-500 active:scale-[0.97] disabled:opacity-35 disabled:pointer-events-none shadow-lg shadow-indigo-500/20 transition-all min-h-[52px] touch-manipulation"
        >
          {isLast ? <><Sparkles size={15} /> Generar app</> : <>Siguiente <ArrowRight size={15} /></>}
        </button>
      </div>

      {/* Skip */}
      {!hasAnswer && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onNext}
            className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-2 px-4 touch-manipulation"
          >
            Saltar esta pregunta
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Pipeline steps ────────────────────────────────────────────────────── */
function PipelineSteps({ steps, currentStep, stepIdx, isStreaming, isDone }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] p-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {steps.map((step, idx) => {
          const { Icon } = step
          const isPast   = idx < stepIdx
          const isActive = step.id === currentStep && isStreaming
          const done     = step.id === 'done' && isDone
          if (step.id === 'done' && !isDone) return null
          return (
            <div key={step.id} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight size={11} className="text-[var(--text-muted)]/30" />}
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                done     ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                isPast   ? 'bg-white/[0.04] text-[var(--text-muted)]' :
                isActive ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25' :
                           'text-[var(--text-muted)]/40'
              }`}>
                {isActive ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Code viewer ───────────────────────────────────────────────────────── */
function CodeViewer({ codeRef, code, streaming }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
      {/* Top bar with animated gradient when streaming */}
      <div className="relative">
        {streaming && (
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-500 animate-pulse" />
        )}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-white/[0.01]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]/20" />
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono ml-1">index.html</span>
          <span className="ml-auto text-[11px] text-[var(--text-muted)]/60 font-mono tabular-nums">
            {code.length.toLocaleString()} chars
          </span>
        </div>
      </div>
      <pre
        ref={codeRef}
        className="text-[12px] text-emerald-400/60 font-mono p-4 overflow-auto max-h-64 sm:max-h-80 leading-relaxed"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
        {code}
        {streaming && <span className="animate-pulse text-indigo-400">▋</span>}
      </pre>
    </div>
  )
}

/* ── Debug / improve panel (post-create) ───────────────────────────────── */
function DebugPanel({ feedback, onFeedbackChange, onSubmit }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-indigo-500/12 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.015] active:bg-white/[0.03] transition-colors min-h-[56px] touch-manipulation"
      >
        <span className="flex items-center gap-2.5">
          <WrenchIcon size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-300">Mejorar esta app</span>
        </span>
        {open ? <ChevronUp size={15} className="text-[var(--text-muted)]" /> : <ChevronDown size={15} className="text-[var(--text-muted)]" />}
      </button>

      {open && (
        <form onSubmit={onSubmit} className="px-5 pb-5 space-y-4 border-t border-[var(--border)]">
          <p className="text-[13px] text-[var(--text-secondary)] pt-4 leading-relaxed">
            Describe qué funciona, qué falla y qué quieres cambiar. Claude regenerará la app aplicando tus mejoras.
          </p>
          <textarea
            value={feedback}
            onChange={e => onFeedbackChange(e.target.value)}
            placeholder={'Ej: "El botón de reset no hace nada. Quiero que también guarde el historial y que los colores sean más vibrantes."'}
            required
            rows={4}
            className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm resize-none leading-relaxed"
          />
          <button
            type="submit"
            disabled={!feedback.trim()}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 active:scale-[0.97] disabled:opacity-35 disabled:pointer-events-none shadow-lg shadow-indigo-500/20 transition-all min-h-[52px] touch-manipulation"
          >
            <ArrowRight size={15} />
            Regenerar con mejoras
          </button>
        </form>
      )}
    </div>
  )
}
