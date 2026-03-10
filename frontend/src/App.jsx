import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DeviceProvider } from './context/DeviceContext'

import StorePage from './pages/StorePage'
import AppDetailPage from './pages/AppDetailPage'
import LauncherPage from './pages/LauncherPage'
import AppRunnerPage from './pages/AppRunnerPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DeveloperDashboard from './pages/DeveloperDashboard'
import DeveloperUpload from './pages/DeveloperUpload'
import AICreatePage from './pages/AICreatePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DeviceProvider>
          <Routes>
            <Route path="/" element={<StorePage />} />
            <Route path="/app/:slug" element={<AppDetailPage />} />
            <Route path="/launcher" element={<LauncherPage />} />
            <Route path="/running/:app_id" element={<AppRunnerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/developer" element={<DeveloperDashboard />} />
            <Route path="/developer/upload" element={<DeveloperUpload />} />
            <Route path="/ai/create" element={<AICreatePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DeviceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
