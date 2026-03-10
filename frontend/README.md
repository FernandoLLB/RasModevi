# ModevI — Frontend

Interfaz web de ModevI construida con React 19, Vite 7 y TailwindCSS 4.

## Stack

- **React 19** con hooks modernos
- **Vite 7** como bundler
- **TailwindCSS 4** (sin config file, integrado via Vite plugin)
- **React Router 7** para navegación SPA
- **lucide-react** para iconografía
- **Plus Jakarta Sans** + **DM Mono** como tipografías

## Desarrollo local

```bash
npm install
npm run dev        # Dev server en http://localhost:5173
                   # con proxy automático a backend en :8000
```

## Build para producción

```bash
npm run build      # Genera frontend/dist/
```

El backend sirve el `dist/` directamente en `http://localhost:8000`.

## Estructura

```
src/
├── App.jsx              # Router + providers
├── main.jsx             # Entry point
├── index.css            # Tailwind + fuentes + variables CSS
├── api/                 # Capa de acceso a la API
│   ├── client.js        # Fetch base con JWT y auto-refresh
│   ├── auth.js          # Register, login, me, refresh
│   ├── store.js         # Apps, categorías, ratings
│   ├── device.js        # Install, activate, launch
│   ├── developer.js     # CRUD apps + upload ZIP
│   └── system.js        # Info sistema
├── context/
│   ├── AuthContext.jsx  # Usuario, tokens JWT, login/logout
│   └── DeviceContext.jsx # Apps instaladas, polling 5s
├── components/
│   ├── layout/          # DeviceLayout, TopBar, CategoryBar, HardwareFilterBar
│   ├── store/           # AppCard, AppGrid, FeaturedBanner, InstallButton, HardwareBadge
│   ├── detail/          # AppDetailHeader, RatingsSection
│   ├── launcher/        # LauncherGrid, LauncherAppIcon
│   └── developer/       # UploadWizard, MyAppRow, StatusBadge
└── pages/
    ├── StorePage.jsx          # / — Tienda con búsqueda y filtros
    ├── AppDetailPage.jsx      # /app/:slug — Detalle de app
    ├── LauncherPage.jsx       # /launcher — Home screen del dispositivo
    ├── AppRunnerPage.jsx      # /running/:app_id — Iframe fullscreen
    ├── SettingsPage.jsx       # /settings — Ajustes y sensores
    ├── LoginPage.jsx          # /login
    ├── RegisterPage.jsx       # /register
    ├── DeveloperDashboard.jsx # /developer
    └── DeveloperUpload.jsx    # /developer/upload
```

## Variables CSS disponibles

```css
--bg-base, --bg-surface, --bg-elevated
--border, --border-hover
--primary, --primary-hover, --primary-glow
--success, --success-glow
--warning, --danger
--text-primary, --text-secondary, --text-muted
```

## Proxy en desarrollo

`vite.config.js` redirige `/api/*`, `/apps/*`, `/installed/*` y `/store/*` al backend en `http://localhost:8000`.
