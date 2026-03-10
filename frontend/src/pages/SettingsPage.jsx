import { useState, useEffect } from 'react'
import { Settings, Cpu, Radio, Plus, Trash2, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DeviceLayout from '../components/layout/DeviceLayout'
import { systemApi } from '../api/system'
import { api } from '../api/client'

function SensorRow({ sensor, onDelete }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
        <Radio size={18} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{sensor.name}</p>
        <p className="text-xs text-slate-500">{sensor.sensor_type} · {sensor.interface} · pin {sensor.pin_or_address}</p>
      </div>
      <div className={`w-2 h-2 rounded-full ${sensor.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      <button onClick={() => onDelete(sensor.id)} className="p-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center">
        <Trash2 size={18} />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [sysInfo, setSysInfo] = useState(null)
  const [sensors, setSensors] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    systemApi.getInfo().then(setSysInfo).catch(console.error)
    api.get('/api/hardware/sensors').then(setSensors).catch(console.error)
  }, [])

  const deleteSesor = async (id) => {
    await api.delete(`/api/hardware/sensors/${id}`)
    setSensors(s => s.filter(x => x.id !== id))
  }

  return (
    <DeviceLayout hideSearch>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings size={20} className="text-slate-400" />
          <h1 className="text-lg font-bold">Ajustes del dispositivo</h1>
        </div>

        {/* System info */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Sistema</h2>
          <div className="card divide-y divide-white/[0.05]">
            {[
              { label: 'Dispositivo', value: sysInfo?.hostname || '—' },
              { label: 'Sistema operativo', value: sysInfo?.platform || '—' },
              { label: 'CPU', value: sysInfo ? `${sysInfo.cpu_count} cores · ${sysInfo.cpu_percent?.toFixed(0)}%` : '—' },
              { label: 'RAM', value: sysInfo ? `${sysInfo.ram_used?.toFixed(1)} / ${sysInfo.ram_total?.toFixed(1)} GB` : '—' },
              { label: 'Temperatura', value: sysInfo?.temperature ? `${sysInfo.temperature.toFixed(1)}°C` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-slate-400">{label}</span>
                <span className="text-sm mono text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Sensors */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sensores registrados</h2>
            <button
              onClick={() => {/* TODO: open sensor register modal */}}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
              style={{ background: 'none', border: 'none' }}
            >
              <Plus size={15} /> Añadir sensor
            </button>
          </div>

          {sensors.length > 0 ? (
            <div className="flex flex-col gap-2">
              {sensors.map(s => <SensorRow key={s.id} sensor={s} onDelete={deleteSesor} />)}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <Radio size={28} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No hay sensores registrados</p>
              <p className="text-xs text-slate-600 mt-1">Conecta un sensor y regístralo para usarlo en las apps</p>
            </div>
          )}
        </section>

        {/* Navigation */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Navegación</h2>
          <div className="card divide-y divide-white/[0.05]">
            {[
              { label: 'Tienda de apps', path: '/' },
              { label: 'Launcher', path: '/launcher' },
              { label: 'Portal developer', path: '/developer' },
            ].map(({ label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/[0.04] transition-colors cursor-pointer min-h-[52px]"
                style={{ background: 'none', border: 'none', textAlign: 'left' }}
              >
                <span className="text-sm font-medium text-slate-300">{label}</span>
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </DeviceLayout>
  )
}
