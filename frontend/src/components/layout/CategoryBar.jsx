import { LayoutGrid, Wrench, Film, Brain, Cpu, GraduationCap, Gamepad2, Radio, Users } from 'lucide-react'

const ICONS = {
  'Todas': LayoutGrid,
  'Utilidades': Wrench,
  'Multimedia': Film,
  'Productividad': Brain,
  'Sistema': Cpu,
  'Educación': GraduationCap,
  'Juegos': Gamepad2,
  'IoT': Radio,
  'Social': Users,
}

export default function CategoryBar({ categories, selected, onSelect }) {
  const all = [{ name: 'Todas', slug: '' }, ...categories]

  return (
    <div className="relative">
      {/* Fade indicator on right to hint at scrollability */}
      <div className="absolute right-0 top-0 bottom-2 w-12 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to left, var(--bg-base), transparent)' }}
      />
      <div
        className="flex gap-2 sm:gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {all.map(cat => {
          const Icon = ICONS[cat.name] || LayoutGrid
          const isActive = selected === cat.slug
          return (
            <button
              key={cat.slug}
              onClick={() => onSelect(cat.slug)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer min-h-[40px] sm:min-h-[44px] ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-white/[0.04] text-slate-400 border border-transparent hover:bg-white/[0.07] hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {cat.name}
            </button>
          )
        })}
        {/* Extra padding so last item isn't hidden by fade */}
        <div className="shrink-0 w-8" />
      </div>
    </div>
  )
}
