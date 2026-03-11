import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { storeApi } from '../api/store'
import DeviceLayout from '../components/layout/DeviceLayout'
import AppDetailHeader from '../components/detail/AppDetailHeader'
import RatingsSection from '../components/detail/RatingsSection'

export default function AppDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState(null)
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [a, r] = await Promise.all([storeApi.getApp(slug), storeApi.getRatings(slug)])
      setApp(a); setRatings(r)
    } catch { navigate('/') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [slug])

  if (loading) {
    return (
      <DeviceLayout hideSearch>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start gap-6 mb-8">
            <div className="skeleton rounded-2xl shrink-0" style={{ width: 72, height: 72 }} />
            <div className="flex-1 flex flex-col gap-3">
              <div className="skeleton h-7 w-48 rounded" />
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-4 w-64 rounded" />
            </div>
          </div>
        </div>
      </DeviceLayout>
    )
  }

  return (
    <DeviceLayout hideSearch>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] mb-6 transition-colors cursor-pointer min-h-[44px]"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        <AppDetailHeader app={app} />

        <div className="border-t border-white/[0.06] mb-6" />

        {app.long_description && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3">Descripción</h2>
            <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{app.long_description}</p>
          </div>
        )}

        <RatingsSection app={app} ratings={ratings} onRatingAdded={load} />
      </div>
    </DeviceLayout>
  )
}
