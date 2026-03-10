import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, AlertCircle, User, Code2 } from 'lucide-react'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await register(form)
      navigate('/login', { state: { registered: true } })
    } catch (e) {
      setError(e.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo size={48} />
          <h1 className="text-xl font-bold mt-3 gradient-text">Crear cuenta</h1>
          <p className="text-sm text-slate-500 mt-1">Únete a la comunidad ModevI</p>
        </div>

        <form onSubmit={submit} className="card p-6 flex flex-col gap-4">
          {/* Role selector */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Tipo de cuenta</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'user', label: 'Usuario', desc: 'Instala y usa apps', Icon: User },
                { value: 'developer', label: 'Developer', desc: 'Publica tus apps', Icon: Code2 },
              ].map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField('role', value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    form.role === value
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                      : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-[10px] opacity-70">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Usuario</label>
            <input value={form.username} onChange={e => setField('username', e.target.value)}
              autoComplete="username"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
              autoComplete="email"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Contraseña</label>
            <input type="password" value={form.password} onChange={e => setField('password', e.target.value)}
              autoComplete="new-password"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <UserPlus size={16} />
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
