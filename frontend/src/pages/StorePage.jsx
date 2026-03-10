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

  return (
    <DeviceLayout onSearch={setSearch} searchValue={search}>
      <div className="max-w-6xl mx-auto px-4 py-5">

        {/* Featured */}
        {!search && !category && !hardware && featured && (
          <FeaturedBanner app={featured} />
        )}

        {/* Filters */}
        <div className="mb-5">
          <CategoryBar categories={categories} selected={category} onSelect={setCategory} />
        </div>

        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <HardwareFilterBar tags={hardwareTags} selected={hardware} onSelect={setHardware} />
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none appearance-none cursor-pointer min-h-[44px]"
          >
            <option value="downloads" style={{ background: '#1a1a2e' }}>Más descargadas</option>
            <option value="rating" style={{ background: '#1a1a2e' }}>Mejor valoradas</option>
            <option value="newest" style={{ background: '#1a1a2e' }}>Más recientes</option>
          </select>
        </div>

        <AppGrid apps={apps} loading={loading} />
      </div>
    </DeviceLayout>
  )
}
