# ModevI — Contexto para Claude Code

## Overview
TFG: plataforma modular para Raspberry Pi 5 con pantalla táctil 7". Dos partes:
1. **Tienda comunitaria**: developers suben apps ZIP open source con manifest.json
2. **Experiencia dispositivo**: Pi arranca en kiosk directo a la store (como iPad)

## Estado actual del proyecto
El proyecto está **implementado y funcional**. Backend + frontend completos con build limpio.
Última feature: **generación de apps con IA** (Claude API) — completamente integrada.

## Arquitectura
- **Backend**: FastAPI (Python 3.13) en `backend/main.py`, puerto 8000
- **Frontend**: React 19 + Vite + TailwindCSS 4 + React Router 7, build en `frontend/dist/`
- **BD Plataforma**: MySQL en el portátil Windows — users, categories, store_apps, hardware_tags, app_ratings
- **BD Dispositivo**: SQLite en `backend/device.db` (local Pi) — installed_apps, app_data, activity_log, notes, device_settings, registered_sensors
- **SDK**: ModevI.js servido en `/api/sdk/app/{id}/sdk.js`

## Estructura de routers (backend)
- `routers/auth.py` — /api/auth/{register,login,me,refresh} — JWT HS256 — **registro desactivado** (`REGISTRATION_ENABLED=false`; reactivar en `.env` + Railway vars)
- `routers/store.py` — /api/store/apps (filtros: search, category_slug, hardware_slug, sort)
- `routers/developer.py` — /api/developer/apps (CRUD + upload ZIP, rol developer)
- `routers/admin.py` — /api/admin/apps (aprobar/rechazar, rol admin)
- `routers/device.py` — /api/device/apps (install/uninstall/activate/deactivate/launch)
- `routers/sdk.py` — /api/sdk/* (bridge para iframes: db, system, gpio)
- `routers/hardware.py` — /api/hardware (sensores CRUD, GPIO, WebSocket stream)
- `routers/notes.py` — /api/notes (CRUD notas)
- `routers/system.py` — /api/system/{info,stats}
- `routers/ai.py` — /api/ai/create-app, /api/ai/debug-app, /api/ai/publish-improved (SSE streaming, genera y mejora apps HTML con Claude claude-opus-4-6)

## Modelos — dos archivos separados
- `models_platform.py` → MySQL: User, Category, HardwareTag, StoreApp, store_app_hardware (M2M), AppRating
- `models_device.py` → SQLite: InstalledApp, AppData, ActivityLog, Note, DeviceSetting, RegisteredSensor
- `models.py` → re-exporta ambos (backward compat)
- `InstalledApp.store_app_id` es Integer plano (sin FK cross-DB); el router enriquece con datos de MySQL en cada request

## Archivos clave
- Backend entry: `backend/main.py`
- DB config: `backend/database.py` (dos engines: platform_engine MySQL + device_engine SQLite)
- Config: `backend/.env` (PLATFORM_DB_URL, DEVICE_DB_PATH, SECRET_KEY, ANTHROPIC_API_KEY)
- Auth: `backend/auth.py` (JWT + passlib bcrypt)
- Schemas: `backend/schemas.py` (Pydantic v2)
- SDK JS: `backend/modevi_sdk.py`
- Seed: `backend/seed.py` (admin/admin123, devuser/dev123, 8 cats, 9 hw tags, 4 apps demo)
- Start: `scripts/start.sh` / `scripts/kiosk.sh`

## Frontend (src/)
- `App.jsx` — BrowserRouter + AuthProvider + DeviceProvider + Routes
- `context/AuthContext.jsx` — JWT localStorage, auto-refresh on 401
- `context/DeviceContext.jsx` — installedApps, activeApp, polling 5s
- `api/` — client.js (fetch+auth), auth.js, store.js, device.js, developer.js, system.js
- `pages/` — StorePage, AppDetailPage, LauncherPage, AppRunnerPage, SettingsPage, LoginPage, RegisterPage, DeveloperDashboard, DeveloperUpload, AICreatePage (/ai/create)
- `components/store/` — AppCard, AppGrid, FeaturedBanner, InstallButton, HardwareBadge, RatingStars
- `components/launcher/` — LauncherGrid, LauncherAppIcon (long-press para desinstalar)
- `components/developer/` — UploadWizard (3 pasos), MyAppRow, StatusBadge

## Documentación disponible
- `README.md` — Overview completo, arquitectura, instalación, API, SDK, formato de apps
- `docs/api.md` — Referencia completa de todos los endpoints
- `docs/creating-apps.md` — Guía para developers de la comunidad
- `docs/architecture.md` — Arquitectura detallada
- `docs/database-schema.md` — Esquema BD completo con código SQLAlchemy

## Raspberry Pi
- IP local: 192.168.88.242, User: fernando
- Hostname: modevi-pi, Pi 5, 16GB RAM, pantalla táctil 7"
- Acceso remoto: Tailscale (fernando está fuera de casa frecuentemente)

## Portátil Windows (servidor de BD)
- MySQL corriendo en Windows, accesible vía Tailscale
- IP Tailscale del portátil: **100.127.188.63** (usar cuando Fernando está fuera de casa)
- IP WiFi local: **192.168.1.48** (usar cuando Pi y portátil están en la misma red doméstica)
- Usuario MySQL: modevi_user / modevi_pass, BD: modevi
- Puerto 3306 abierto en Windows Firewall para Tailscale

## Cómo cambiar la conexión de BD según ubicación
Editar `backend/.env` en la Pi:
- **Fuera de casa (Tailscale)**: `PLATFORM_DB_URL=mysql+pymysql://modevi_user:modevi_pass@100.127.188.63/modevi`
- **En casa (red local)**: `PLATFORM_DB_URL=mysql+pymysql://modevi_user:modevi_pass@192.168.1.48/modevi`

Tras cambiar el .env, reiniciar el backend:
```bash
pkill -f "python3 main.py" && cd ~/Projects/rasModevi/backend && python3 main.py &
```

## Credenciales por defecto (seed)
- admin / admin123 (rol admin)
- devuser / dev123 (rol developer)

## Cómo arrancar
```bash
cd backend && python3 main.py   # Todo en :8000
# o
bash scripts/start.sh

# Para kiosk en Pi:
bash scripts/kiosk.sh
```

## Build frontend
```bash
cd frontend && npm run build    # → frontend/dist/
```

## Formato de apps para la tienda
ZIP con:
- manifest.json (name, version, description, entry_point, required_hardware[], permissions[])
- index.html (entrada, cualquier framework compilado)
- assets/ (opcional)
Max 50MB. Se extrae en backend/installed/{id}/

## ModevI.js SDK (window.ModevI)
- system.getInfo() → CPU, RAM, temp, uptime
- db.get/set/delete/list(prefix?) → KV store por app
- hardware.getSensors(), readGPIO(pin), writeGPIO(pin, val), streamSensor(id, cb)
- notify.toast(msg, type)

## Feature: IA para Apps (Crear + Mejorar + Publicar)

### Crear apps con IA
- **Endpoint:** `GET /api/ai/create-app?name=...&description=...&category_id=...&token=JWT`
- **Modelo:** `claude-opus-4-6`, max_tokens=32000
- **Protocolo:** SSE — `fetch + ReadableStream` en el frontend (NO EventSource — ver nota abajo)
- **JWT en query param** (limitación del browser: EventSource no soporta headers custom)
- **Rol requerido:** developer o admin
- **Pipeline:**
  1. connecting → llama a Anthropic API
  2. generating → stream de chunks HTML en tiempo real
  3. packaging → crea ZIP con manifest.json autogenerado
  4. registering → inserta StoreApp en MySQL (status=published directo)
  5. done → instala en SQLite + ActivityLog
- **Validación HTML:** elimina code fences, valida `<!DOCTYPE html>` y `</html>`
- **Apps generadas:** single HTML file, dark theme (#0f0f1a), optimizado táctil, sin CDN externos

### Mejorar apps con IA (debug-app)
- **Endpoint:** `GET /api/ai/debug-app?installed_id=...&feedback=...&token=JWT` — en la **Pi** (DEVICE_BASE)
- **Pipeline:** connecting → generating (Mejorando) → packaging (Actualizando) → done
- **Efecto:** modifica SOLO el index.html local instalado en la Pi. NO toca la store original.
- **La app original en la tienda queda intacta.** El usuario decide si publicar la versión mejorada.

### Publicar app instalada como nueva entrada en la tienda
- **Endpoint:** `POST /api/ai/publish-improved` — en Railway (STORE_BASE), auth por header Bearer
- **Body:** `{ installed_id, name, description, category_id? }`
- **Proceso:** lee index.html de la Pi, crea ZIP, sube a R2, inserta nueva StoreApp en MySQL (published)
- **Importante:** crea una NUEVA app en la tienda, nunca sobreescribe la original

### Frontend — AICreatePage (/ai/create)
- **Dos tabs principales:** "Crear app" (flujo existente) | "Mejorar app" (nuevo)
- **Tab Mejorar:** grid de apps instaladas → selección → dos acciones independientes:
  - Sección "Mejorar con IA": textarea + SSE streaming
  - Sección "Publicar en la tienda": siempre disponible con la app seleccionada, independiente de si se mejoró en esta sesión
- **SSE implementation:** `fetch + ReadableStream` con `Accept: text/event-stream`. Se usa en lugar de EventSource para obtener el código HTTP de error real. Eventos separados por `\n\n`.
- **Nota crítica:** tras cambiar `ai.py`, reiniciar el backend en la Pi es obligatorio o las rutas nuevas no se registran y el catch-all SPA intercepta las peticiones.
- **TopBar:** botón "Crear con IA" (icono Sparkles, color violeta) visible solo a developers
- **Dependencia:** `anthropic>=0.40.0` en requirements.txt
