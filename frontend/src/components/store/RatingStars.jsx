import { Star } from 'lucide-react'

export default function RatingStars({ rating = 0, max = 5, interactive = false, onChange, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(rating)
        return (
          <button
            key={i}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => onChange?.(i + 1) : undefined}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
            style={{ background: 'none', border: 'none', padding: 0 }}
          >
            <Star
              size={size}
              className={filled ? 'text-amber-400' : 'text-slate-600'}
              fill={filled ? 'currentColor' : 'none'}
            />
          </button>
        )
      })}
    </div>
  )
}
