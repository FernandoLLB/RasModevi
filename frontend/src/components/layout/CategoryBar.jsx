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
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
      {all.map(cat => {
        const Icon = ICONS[cat.name] || LayoutGrid
        const isActive = selected === cat.slug
        return (
          <button
            key={cat.slug}
            onClick={() => onSelect(cat.slug)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer ${
              isActive
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'bg-white/[0.04] text-slate-400 border border-transparent hover:bg-white/[0.07] hover:text-slate-200'
            }`}
          >
            <Icon size={15} />
            {cat.name}
          </button>
        )
      })}
    </div>
  )
}
