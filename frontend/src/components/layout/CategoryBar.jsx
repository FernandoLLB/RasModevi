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

export default function CategoryBar({ categories, selected, onSelect, vertical = false }) {
  const all = [{ name: 'Todas', slug: '' }, ...categories]

  // Vertical mode: used in desktop sidebar
  if (vertical) {
    return (
      <div className="flex flex-col gap-0.5">
        {all.map(cat => {
          const Icon = ICONS[cat.name] || LayoutGrid
          const isActive = selected === cat.slug
          return (
            <button
              key={cat.slug}
              onClick={() => onSelect(cat.slug)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer min-h-[44px] w-full text-left ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
              {cat.name}
            </button>
          )
        })}
      </div>
    )
  }

  // Horizontal scroll mode: used on mobile / Pi
  return (
    <div className="relative">
      <div className="absolute right-0 top-0 bottom-2 w-12 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to left, var(--bg-base), transparent)' }}
      />
      <div
        className="flex gap-2.5 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {all.map(cat => {
          const Icon = ICONS[cat.name] || LayoutGrid
          const isActive = selected === cat.slug
          return (
            <button
              key={cat.slug}
              onClick={() => onSelect(cat.slug)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer min-h-[44px] ${
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
        <div className="shrink-0 w-8" />
      </div>
    </div>
  )
}
