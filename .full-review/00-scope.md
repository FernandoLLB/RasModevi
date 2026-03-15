# Review Scope

## Target

Full comprehensive review of the ModevI project — a modular platform for Raspberry Pi 5 with touchscreen. The project consists of a FastAPI backend (Python 3.13), a React 19 frontend (Vite + TailwindCSS 4), split deployment (Railway for store/auth + Raspberry Pi for device/hardware), and AI-powered app generation with Claude.

## Files

### Backend (Python — FastAPI)
- `backend/main.py` — Pi entry point
- `backend/main_store.py` — Railway entry point
- `backend/database.py` — Dual DB config (MySQL + SQLite)
- `backend/auth.py` — JWT authentication (HS256, passlib bcrypt)
- `backend/schemas.py` — Pydantic v2 schemas
- `backend/models_platform.py` — MySQL models (User, Category, StoreApp, etc.)
- `backend/models_device.py` — SQLite models (InstalledApp, AppData, etc.)
- `backend/models.py` — Re-exports
- `backend/r2.py` — Cloudflare R2 helpers
- `backend/hw.py` — Hardware utilities (GPIO, PWM, I2C, camera)
- `backend/modevi_sdk.py` — SDK JS generation
- `backend/seed.py` — Database seeding
- `backend/routers/auth.py` — Auth endpoints
- `backend/routers/store.py` — Store endpoints
- `backend/routers/developer.py` — Developer CRUD
- `backend/routers/admin.py` — Admin endpoints
- `backend/routers/device.py` — Device install/uninstall
- `backend/routers/sdk.py` — SDK bridge for iframes
- `backend/routers/hardware.py` — Hardware/GPIO/sensors
- `backend/routers/notes.py` — Notes CRUD
- `backend/routers/system.py` — System info
- `backend/routers/ai.py` — AI app generation (SSE streaming)

### Frontend (React 19 + Vite)
- `frontend/src/App.jsx` — Router + providers
- `frontend/src/api/client.js` — API client (split routing)
- `frontend/src/api/auth.js`, `store.js`, `device.js`, `developer.js`, `system.js`
- `frontend/src/context/AuthContext.jsx` — JWT context
- `frontend/src/context/DeviceContext.jsx` — Device state + polling
- `frontend/src/pages/` — StorePage, AppDetailPage, LauncherPage, AppRunnerPage, SettingsPage, LoginPage, RegisterPage, DeveloperDashboard, DeveloperUpload, AICreatePage
- `frontend/src/components/` — store/, launcher/, developer/, detail/, layout/

### Infrastructure
- `Dockerfile` — Railway deployment
- `scripts/start.sh`, `scripts/kiosk.sh`, `scripts/download_libs.sh`

### Documentation
- `README.md`, `CLAUDE.md`
- `docs/api.md`, `docs/architecture.md`, `docs/creating-apps.md`, `docs/database-schema.md`

## Flags

- Security Focus: no
- Performance Critical: no
- Strict Mode: no
- Framework: FastAPI (backend) + React 19 (frontend)

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
