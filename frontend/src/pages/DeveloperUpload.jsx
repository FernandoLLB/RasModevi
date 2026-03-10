import { useNavigate } from 'react-router-dom'
import DeviceLayout from '../components/layout/DeviceLayout'
import UploadWizard from '../components/developer/UploadWizard'
import { ArrowLeft } from 'lucide-react'

export default function DeveloperUpload() {
  const navigate = useNavigate()

  return (
    <DeviceLayout hideSearch>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/developer')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors cursor-pointer"
          style={{ background: 'none', border: 'none' }}
        >
          <ArrowLeft size={16} /> Volver al portal
        </button>
        <h1 className="text-xl font-bold mb-6">Publicar nueva app</h1>
        <UploadWizard onSuccess={() => navigate('/developer')} />
      </div>
    </DeviceLayout>
  )
}
