const HW_COLORS = {
  gpio: '#10b981', i2c: '#6366f1', spi: '#8b5cf6',
  dht22: '#f59e0b', bmp280: '#f59e0b', 'hc-sr04': '#f59e0b',
  camera: '#ec4899', oled: '#06b6d4', neopixel: '#f97316',
}

export default function HardwareBadge({ tag, size = 'sm' }) {
  const color = HW_COLORS[typeof tag === 'string' ? tag.toLowerCase() : tag.slug?.toLowerCase()] || '#94a3b8'
  const label = typeof tag === 'string' ? tag : tag.name

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md ${size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}
      style={{ background: color + '18', color, border: `1px solid ${color}30` }}
    >
      <span className={`rounded-full ${size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} style={{ background: color }} />
      {label}
    </span>
  )
}
