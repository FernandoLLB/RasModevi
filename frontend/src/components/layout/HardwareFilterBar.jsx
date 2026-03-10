import { ChevronDown, ChevronUp, Cpu } from 'lucide-react'
import { useState } from 'react'

const HW_COLORS = {
  gpio: '#10b981', i2c: '#6366f1', spi: '#8b5cf6',
  dht22: '#f59e0b', bmp280: '#f59e0b', 'hc-sr04': '#f59e0b',
  camera: '#ec4899', oled: '#06b6d4', neopixel: '#f97316',
}

export default function HardwareFilterBar({ tags, selected, onSelect }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-3 min-h-[44px] text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] rounded-xl transition-colors mb-1 cursor-pointer"
      >
        <Cpu size={16} />
        Filtrar por hardware
        {selected && <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold">{selected}</span>}
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className="flex flex-wrap gap-3 mb-4 animate-fade-in">
          <button
            onClick={() => onSelect('')}
            className={`px-5 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer min-h-[44px] ${
              !selected ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]'
            }`}
          >
            Todos
          </button>
          {tags.map(tag => {
            const color = HW_COLORS[tag.slug] || '#94a3b8'
            const isActive = selected === tag.slug
            return (
              <button
                key={tag.slug}
                onClick={() => onSelect(isActive ? '' : tag.slug)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer border min-h-[44px] ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{
                  background: isActive ? color + '25' : 'rgba(255,255,255,0.04)',
                  borderColor: isActive ? color + '50' : 'transparent',
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                {tag.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
