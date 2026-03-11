import { useState, useEffect } from 'react'
import { storeApi } from '../api/store'
import DeviceLayout from '../components/layout/DeviceLayout'
import CategoryBar from '../components/layout/CategoryBar'
import HardwareFilterBar from '../components/layout/HardwareFilterBar'
import FeaturedBanner from '../components/store/FeaturedBanner'
import AppGrid from '../components/store/AppGrid'

export default function StorePage() {
  const [apps, setApps] = useState([])
  const [categories, setCategories] = useState([])
  const [hardwareTags, setHardwareTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [hardware, setHardware] = useState('')
  const [sort, setSort] = useState('downloads')

  useEffect(() => {
    Promise.all([storeApi.getCategories(), storeApi.getHardwareTags()])
      .then(([cats, hw]) => { setCategories(cats); setHardwareTags(hw) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    storeApi.getApps({ search, category_slug: category, hardware_slug: hardware, sort })
      .then(setApps)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [search, category, hardware, sort])

  const featured = apps.find(a => a.status === 'published') || apps[0]

  const sortSelect = (extraClass = '') => (
    <select
      value={sort}
      onChange={e => setSort(e.target.value)}
      className={`bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none appearance-none cursor-pointer min-h-[44px] ${extraClass}`}
    >
      <option value="downloads" style={{ background: '#1a1a2e' }}>Más descargadas</option>
      <option value="rating" style={{ background: '#1a1a2e' }}>Mejor valoradas</option>
      <option value="newest" style={{ background: '#1a1a2e' }}>Más recientes</option>
    </select>
  )

  return (
    <DeviceLayout onSearch={setSearch} searchValue={search}>
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-8 py-5">

        {/* Layout: sidebar on xl+, stacked below xl */}
        <div className="xl:flex xl:gap-8">

          {/* ── Desktop sidebar (xl+) ── */}
          <aside className="hidden xl:flex flex-col gap-6 w-52 shrink-0 sticky top-[68px] h-[calc(100vh-68px)] overflow-y-auto pb-6 pr-2">

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">Categorías</p>
              <CategoryBar
                categories={categories}
                selected={category}
                onSelect={setCategory}
                vertical
              />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">Hardware</p>
              <HardwareFilterBar
                tags={hardwareTags}
                selected={hardware}
                onSelect={setHardware}
                sidebar
              />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">Ordenar por</p>
              {sortSelect('w-full')}
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">

            {/* Mobile / Pi filters (hidden on xl+) */}
            <div className="xl:hidden mb-4">
              <CategoryBar categories={categories} selected={category} onSelect={setCategory} />
            </div>
            <div className="xl:hidden flex items-center justify-between mb-4 flex-wrap gap-3">
              <HardwareFilterBar tags={hardwareTags} selected={hardware} onSelect={setHardware} />
              {sortSelect()}
            </div>

            {/* Featured banner */}
            {!search && !category && !hardware && featured && (
              <FeaturedBanner app={featured} />
            )}

            {/* Desktop: app count + sort */}
            <div className="hidden xl:flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {loading ? 'Cargando…' : `${apps.length} apps`}
              </p>
              {sortSelect()}
            </div>

            <AppGrid apps={apps} loading={loading} />
          </div>
        </div>

      </div>
    </DeviceLayout>
  )
}
