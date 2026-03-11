import { useNavigate } from 'react-router-dom'
import DeviceLayout from '../components/layout/DeviceLayout'
import UploadWizard from '../components/developer/UploadWizard'
import { ArrowLeft } from 'lucide-react'

export default function DeveloperUpload() {
  const navigate = useNavigate()

  return (
    <DeviceLayout hideSearch>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => navigate('/developer')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] mb-6 transition-colors cursor-pointer min-h-[44px]"
        >
          <ArrowLeft size={16} /> Volver al portal
        </button>
        <h1 className="text-xl font-bold mb-6">Publicar nueva app</h1>
        <UploadWizard onSuccess={() => navigate('/developer')} />
      </div>
    </DeviceLayout>
  )
}
