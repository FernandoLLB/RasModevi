import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Globe, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DEVICE_BASE, STORE_BASE } from '../api/client'

async function getCategories() {
  const res = await fetch(`${STORE_BASE}/api/store/categories`)
  if (!res.ok) return []
  return res.json()
}

export default function PublishModal({ app, onClose }) {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    name: app.store_app?.name || '',
    description: app.store_app?.description || '',
    category_id: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${DEVICE_BASE}/api/ai/publish-improved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          installed_id: app.id,
          name: form.name,
          description: form.description,
          category_id: form.category_id ? parseInt(form.category_id) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al publicar')
      setResult({ success: true, ...data })
    } catch (err) {
      setResult({ success: false, error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <Upload size={16} className="text-violet-400" />
            <span className="text-sm font-semibold text-violet-300">Publicar en la tienda</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/[0.06] transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {result?.success ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                  <Globe size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">¡Publicada en la tienda!</p>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{result.message}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {result.slug && (
                  <Link
                    to={`/app/${result.slug}`}
                    onClick={onClose}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-300 text-sm font-semibold hover:bg-violet-500/25 transition-colors min-h-[52px]"
                  >
                    Ver en tienda <ChevronRight size={14} />
                  </Link>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:text-white transition-colors min-h-[52px]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                Publica <span className="text-white font-medium">{app.store_app?.name}</span> como una nueva entrada en la tienda comunitaria.
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
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre de la app"
                  required
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-sm min-h-[52px]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Breve descripción para la tienda"
                  rows={3}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-sm resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Categoría <span className="text-[var(--text-muted)] font-normal ml-1 text-[12px]">(opcional)</span>
                </label>
                <select
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-[var(--text-secondary)] focus:outline-none focus:border-violet-500/50 transition-all text-sm appearance-none cursor-pointer min-h-[52px]"
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
      </div>
    </div>,
    document.body
  )
}
