import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import RatingStars from '../store/RatingStars'
import { storeApi } from '../../api/store'
import { useAuth } from '../../context/AuthContext'

function RatingHistogram({ ratings }) {
  const counts = [5, 4, 3, 2, 1].map(n => ({
    stars: n,
    count: ratings.filter(r => r.rating === n).length,
  }))
  const max = Math.max(...counts.map(c => c.count), 1)
  return (
    <div className="flex flex-col gap-1.5">
      {counts.map(({ stars, count }) => (
        <div key={stars} className="flex items-center gap-2">
          <span className="text-xs mono text-slate-400 w-3">{stars}</span>
          <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400/70 rounded-full transition-all duration-500"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs mono text-slate-500 w-4">{count}</span>
        </div>
      ))}
    </div>
  )
}

export default function RatingsSection({ app, ratings, onRatingAdded }) {
  const { isAuthenticated } = useAuth()
  const [myRating, setMyRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!myRating) return
    setSubmitting(true)
    setError('')
    try {
      await storeApi.createRating(app.slug, { rating: myRating, comment: comment || undefined })
      setMyRating(0)
      setComment('')
      onRatingAdded?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <MessageSquare size={16} className="text-slate-400" />
        Valoraciones ({ratings?.length || 0})
      </h2>

      {ratings?.length > 0 && (
        <div className="flex gap-8 mb-6 p-4 card">
          <div className="text-center">
            <div className="text-4xl font-bold mono gradient-text">{app.avg_rating?.toFixed(1) || '—'}</div>
            <RatingStars rating={app.avg_rating} size={13} />
            <p className="text-xs text-slate-500 mt-1">{ratings.length} reseñas</p>
          </div>
          <div className="flex-1">
            <RatingHistogram ratings={ratings} />
          </div>
        </div>
      )}

      {isAuthenticated && (
        <div className="card p-4 mb-6">
          <p className="text-sm font-medium mb-3">Tu valoración</p>
          <RatingStars rating={myRating} interactive onChange={setMyRating} size={20} />
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Escribe un comentario (opcional)..."
            rows={3}
            className="w-full mt-3 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <button
            onClick={submit}
            disabled={!myRating || submitting}
            className="mt-3 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-sm font-medium transition-colors cursor-pointer"
          >
            {submitting ? 'Enviando...' : 'Enviar valoración'}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {ratings?.map(r => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-bold">
                  {r.user?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-sm font-medium">{r.user?.username || 'Usuario'}</span>
              </div>
              <RatingStars rating={r.rating} size={12} />
            </div>
            {r.comment && <p className="text-sm text-slate-400 leading-relaxed">{r.comment}</p>}
            <p className="text-xs text-slate-600 mt-2">{new Date(r.created_at).toLocaleDateString('es-ES')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
