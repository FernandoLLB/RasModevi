import { useState, useRef } from 'react'
import { Upload, FileArchive, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'
import { developerApi } from '../../api/developer'
import { storeApi } from '../../api/store'

const STEPS = ['Metadatos', 'Paquete ZIP', 'Confirmar']

const CATEGORY_IDS = { 'Utilidades': 1, 'Multimedia': 2, 'Productividad': 3, 'Sistema': 4, 'Educación': 5, 'Juegos': 6, 'IoT': 7, 'Social': 8 }

export default function UploadWizard({ onSuccess }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: '', description: '', long_description: '', version: '1.0.0', category_id: 1 })
  const [createdApp, setCreatedApp] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.name || !form.description) { setError('Nombre y descripción son obligatorios'); return }
    setLoading(true); setError('')
    try {
      const app = await developerApi.createApp(form)
      setCreatedApp(app)
      setStep(1)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleUpload = async () => {
    if (!file || !createdApp) { setError('Selecciona un archivo ZIP'); return }
    setLoading(true); setError('')
    try {
      await developerApi.uploadPackage(createdApp.id, file)
      setStep(2)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-500 text-white' : 'bg-white/[0.07] text-slate-500'}`}>
              {i < step ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>{s}</span>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-slate-600 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 0: Metadata */}
      {step === 0 && (
        <div className="card p-6 flex flex-col gap-4 animate-fade-up">
          <h3 className="font-semibold">Información de la app</h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Nombre *</label>
            <input value={form.name} onChange={e => setField('name', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Descripción corta *</label>
            <input value={form.description} onChange={e => setField('description', e.target.value)}
              maxLength={500}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Descripción larga</label>
            <textarea value={form.long_description} onChange={e => setField('long_description', e.target.value)}
              rows={4}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Versión</label>
              <input value={form.version} onChange={e => setField('version', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Categoría</label>
              <select value={form.category_id} onChange={e => setField('category_id', parseInt(e.target.value))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none">
                {Object.entries(CATEGORY_IDS).map(([name, id]) => (
                  <option key={id} value={id} style={{ background: '#1a1a2e' }}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={14} />{error}</p>}
          <button onClick={handleCreate} disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-semibold transition-colors cursor-pointer">
            {loading ? 'Creando...' : 'Continuar →'}
          </button>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card p-6 flex flex-col gap-4 animate-fade-up">
          <h3 className="font-semibold">Subir paquete ZIP</h3>
          <p className="text-sm text-slate-400">El ZIP debe contener <code className="text-indigo-300">manifest.json</code> e <code className="text-indigo-300">index.html</code> en la raíz. Máx. 50 MB.</p>

          <div
            onClick={() => fileRef.current.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/[0.1] hover:border-indigo-500/40 hover:bg-white/[0.02]'}`}
          >
            {file ? <FileArchive size={36} className="text-emerald-400" /> : <Upload size={36} className="text-slate-500" />}
            <div className="text-center">
              {file ? (
                <><p className="font-medium text-emerald-400">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p></>
              ) : (
                <><p className="text-sm text-slate-300">Arrastra tu ZIP o toca para seleccionar</p>
                  <p className="text-xs text-slate-600 mt-1">Formato: .zip</p></>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".zip" className="hidden"
              onChange={e => setFile(e.target.files[0])} />
          </div>

          {error && <p className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={14} />{error}</p>}
          <button onClick={handleUpload} disabled={loading || !file}
            className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-semibold transition-colors cursor-pointer">
            {loading ? 'Subiendo...' : 'Subir paquete →'}
          </button>
        </div>
      )}

      {/* Step 2: Done */}
      {step === 2 && (
        <div className="card p-8 flex flex-col items-center gap-4 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 size={36} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold">¡App enviada con éxito!</h3>
          <p className="text-sm text-slate-400">Tu app está pendiente de revisión. Una vez aprobada aparecerá en la tienda.</p>
          <button onClick={onSuccess}
            className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-medium transition-colors cursor-pointer">
            Ver mis apps
          </button>
        </div>
      )}
    </div>
  )
}
