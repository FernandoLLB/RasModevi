# Frontend Implementation: ModevI

## Build status: ✅ SUCCESS (294KB JS + 34KB CSS, 0 errores)

## Files Created/Modified

### Foundation
- `frontend/package.json` — añadido react-router-dom@^7.0.0
- `frontend/src/index.css` — fuente "Plus Jakarta Sans" + "DM Mono", CSS variables, dot-grid background, skeleton animation, card/glass classes, stagger delays
- `frontend/src/App.jsx` — BrowserRouter + AuthProvider + DeviceProvider + todas las rutas
- `frontend/src/main.jsx` — sin cambios

### API Layer (src/api/)
- `client.js` — base fetch con JWT auth headers, auto-refresh on 401, FormData support
- `auth.js` — register, login, me
- `store.js` — getApps (con filtros), getApp, getCategories, getHardwareTags, getRatings, createRating, deleteRating
- `device.js` — getInstalled, getActive, install, uninstall, activate, deactivate, launch
- `developer.js` — getMyApps, createApp, updateApp, deleteApp, uploadPackage (FormData)
- `system.js` — getInfo, getStats

### Contexts (src/context/)
- `AuthContext.jsx` — user state, JWT en localStorage, auto-load on mount, login/logout/register, event auth:logout
- `DeviceContext.jsx` — installedApps, activeApp, polling 5s, install/uninstall/activate/deactivate, installingIds set para loading states

### Components (src/components/)
- `Logo.jsx` — SVG logo ModevI reutilizable
- `layout/TopBar.jsx` — logo + active app indicator + search + user menu + nav links
- `layout/CategoryBar.jsx` — pills con iconos lucide por categoría, scroll horizontal
- `layout/HardwareFilterBar.jsx` — collapsible con pills de colores por hardware tag
- `layout/DeviceLayout.jsx` — wrapper con TopBar
- `store/HardwareBadge.jsx` — pill con color por tipo hardware (GPIO=verde, I2C=índigo, etc.)
- `store/RatingStars.jsx` — estrellas estáticas e interactivas
- `store/InstallButton.jsx` — state machine: not installed→installing→installed→active
- `store/AppCard.jsx` — card con icono/inicial coloreada, rating, badges, InstallButton, animación stagger
- `store/AppGrid.jsx` — grid responsive 2-4 cols, skeleton loading, empty state
- `store/FeaturedBanner.jsx` — hero banner con gradient mesh
- `detail/AppDetailHeader.jsx` — icon grande + info + hardware badges + InstallButton grande
- `detail/RatingsSection.jsx` — histograma de ratings + lista de reviews + formulario de valoración
- `launcher/LauncherAppIcon.jsx` — icono 76px, tap=launch, long-press=delete, pulsing dot si activa
- `launcher/LauncherGrid.jsx` — grid responsive + botón "Más apps"
- `developer/StatusBadge.jsx` — pending/published/rejected con colores
- `developer/MyAppRow.jsx` — fila con status, stats, acciones
- `developer/UploadWizard.jsx` — wizard 3 pasos: metadatos → ZIP dropzone → confirmación

### Pages (src/pages/)
- `StorePage.jsx` — hero featured + CategoryBar + HardwareFilter + sort + AppGrid
- `AppDetailPage.jsx` — header + descripción larga + RatingsSection
- `LauncherPage.jsx` — reloj + grid apps + dock con Store/Settings
- `AppRunnerPage.jsx` — iframe fullscreen + SDK injection + toast listener + back button overlay
- `SettingsPage.jsx` — info sistema + sensores registrados + navegación
- `LoginPage.jsx` — form con error handling
- `RegisterPage.jsx` — form con selector rol user/developer
- `DeveloperDashboard.jsx` — stats cards + lista apps con MyAppRow
- `DeveloperUpload.jsx` — wrapper de UploadWizard

## Design System
- Fuente: Plus Jakarta Sans (UI) + DM Mono (números/stats)
- Tema: Obsidian dark (#0a0a0f base, #111118 cards)
- Dot-grid background sutil
- Cards con glassmorphism y hover effects
- Skeleton loading en todos los estados de carga
- Animaciones: fade-up staggered en grids, fade-in en modales
- Touch-friendly: 44px+ tap targets, tap-highlight desactivado
