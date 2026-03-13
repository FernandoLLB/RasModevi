import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Code2, Plus, Star, Download, Clock, Upload } from 'lucide-react'
import DeviceLayout from '../components/layout/DeviceLayout'
import MyAppRow from '../components/developer/MyAppRow'
import { developerApi } from '../api/developer'
import { useAuth } from '../context/AuthContext'

export default function DeveloperDashboard() {
  const { user, isDeveloper } = useAuth()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const data = await developerApi.getMyApps()
      setApps(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const stats = {
    total: apps.length,
    published: apps.filter(a => a.status === 'published').length,
    downloads: apps.reduce((s, a) => s + (a.downloads_count || 0), 0),
    avgRating: apps.filter(a => a.avg_rating > 0).reduce((s, a, _, arr) => s + a.avg_rating / arr.length, 0),
  }

  const handleDelete = async (app) => {
    if (!confirm(`¿Eliminar "${app.name}"?`)) return
    await developerApi.deleteApp(app.id)
    load()
  }

  if (!isDeveloper) {
    return (
      <DeviceLayout hideSearch>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <Code2 size={40} className="text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Portal Developer</h2>
          <p className="text-slate-400 text-sm mb-6">Inicia sesión para acceder al portal de creación de apps.</p>
          <Link to="/login" className="px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-sm transition-colors inline-flex items-center min-h-[48px]">
            Iniciar sesión
          </Link>
        </div>
      </DeviceLayout>
    )
  }

  return (
    <DeviceLayout hideSearch>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Portal Developer</h1>
            <p className="text-sm text-slate-500 mt-0.5">Hola, {user?.username}</p>
          </div>
          <Link
            to="/developer/upload"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20 min-h-[48px]"
          >
            <Plus size={16} /> Nueva app
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total apps', value: stats.total, Icon: Code2, color: '#6366f1' },
            { label: 'Publicadas', value: stats.published, Icon: Clock, color: '#10b981' },
            { label: 'Descargas', value: stats.downloads, Icon: Download, color: '#f59e0b' },
            { label: 'Rating medio', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', Icon: Star, color: '#ec4899' },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color }} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
              <div className="text-2xl font-bold mono gradient-text">{value}</div>
            </div>
          ))}
        </div>

        {/* Apps list */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Mis apps ({apps.length})</h2>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
            </div>
          ) : apps.length === 0 ? (
            <div className="card p-10 text-center">
              <Upload size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm mb-4">Todavía no has publicado ninguna app</p>
              <Link to="/developer/upload" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
                Publicar mi primera app →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {apps.map(app => (
                <MyAppRow
                  key={app.id}
                  app={app}
                  onUpload={() => {}}
                  onDelete={() => handleDelete(app)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DeviceLayout>
  )
}
