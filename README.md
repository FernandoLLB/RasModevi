# ModevI

Plataforma modular de aplicaciones para Raspberry Pi 5 con pantalla táctil. El dispositivo arranca directamente en una tienda de apps (sin escritorio visible), donde el usuario puede instalar aplicaciones creadas por la comunidad — o generarlas con IA. Las apps pueden acceder al hardware de la Pi mediante el SDK de ModevI.

**Producción:** [modevi.es](https://modevi.es)

---

## Índice

- [Concepto](#concepto)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Instalación y arranque](#instalación-y-arranque)
- [Modo kiosk (dispositivo)](#modo-kiosk-dispositivo)
- [Base de datos](#base-de-datos)
- [API REST](#api-rest)
- [SDK ModevI.js](#sdk-modevi-js)
- [Formato de apps](#formato-de-apps)
- [Generación de apps con IA](#generación-de-apps-con-ia)
- [Credenciales por defecto](#credenciales-por-defecto)

---

## Concepto

ModevI tiene dos partes:

**Tienda comunitaria** — Plataforma web donde developers publican apps open source empaquetadas como ZIP. Cada app declara qué hardware requiere (GPIO, I2C, DHT22, cámara…). Los usuarios filtran por hardware disponible, valoran las apps e instalan las que quieren. También pueden generar apps automáticamente con IA.

**Experiencia de dispositivo** — La Raspberry Pi 5 arranca en modo kiosk directamente en la store de ModevI, sin exponer el sistema operativo. El usuario navega la tienda desde la pantalla táctil de 7", instala apps y las lanza. Las apps se ejecutan en un iframe y tienen acceso al hardware de la Pi a través del SDK de ModevI.js.

---

## Arquitectura

El proyecto está desplegado en una arquitectura split:

```
Internet → modevi.es (Railway — siempre disponible)
  ├── Store frontend (React SPA)
  ├── /api/auth/*        ← Autenticación JWT
  ├── /api/store/*       ← Tienda pública
  ├── /api/developer/*   ← Portal developers
  ├── /api/admin/*       ← Administración
  └── /api/ai/*          ← Generación de apps con IA (Claude)

Internet → pi.modevi.es (Raspberry Pi vía Cloudflare Tunnel)
  ├── /api/device/*      ← Instalación/lanzamiento de apps
  ├── /api/hardware/*    ← GPIO y sensores
  ├── /api/sdk/*         ← Bridge iframe ↔ sistema
  ├── /api/notes/*       ← Notas
  ├── /api/system/*      ← Info del sistema
  ├── /installed/{id}/   ← Archivos de apps instaladas
  └── /apps/{slug}/      ← Apps demo
```

El frontend detecta automáticamente a qué backend enviar cada petición según el prefijo de la URL.

**Stack técnico:**

| Capa | Tecnología |
|------|-----------|
| Backend store | Python 3.11, FastAPI, Uvicorn — Railway |
| Backend dispositivo | Python 3.13, FastAPI, Uvicorn — Raspberry Pi |
| BD plataforma | MySQL en Railway |
| BD dispositivo | SQLite local en la Pi |
| Auth | JWT HS256 + bcrypt (passlib) |
| IA | Claude claude-opus-4-6 (Anthropic API), SSE streaming |
| Hardware | gpiozero (GPIO), smbus2 (I2C) |
| Frontend | React 19, Vite 7, TailwindCSS 4, React Router 7 |
| Iconos | lucide-react |
| Tunnel | Cloudflare Tunnel |
| Kiosk | Chromium en modo fullscreen |

---

## Estructura del proyecto

```
rasModevi/
├── Dockerfile               # Multi-stage: Node 20 (frontend) + Python 3.11 (backend)
├── railway.json             # Configuración de deploy en Railway
├── nixpacks.toml            # Presente pero no usado (builder = Dockerfile)
├── backend/
│   ├── main.py              # Entry Pi — todos los routers
│   ├── main_store.py        # Entry Railway — auth, store, developer, admin, ai
│   ├── database.py          # Dos engines: MySQL (plataforma) + SQLite (dispositivo)
│   ├── models_platform.py   # Modelos MySQL: User, Category, StoreApp, AppRating…
│   ├── models_device.py     # Modelos SQLite: InstalledApp, ActivityLog, Note…
│   ├── models.py            # Re-exporta ambos (compatibilidad)
│   ├── schemas.py           # Pydantic v2 schemas
│   ├── auth.py              # JWT utilities + FastAPI dependencies
│   ├── seed.py              # Datos iniciales (usuarios, categorías, apps demo)
│   ├── modevi_sdk.py        # ModevI.js SDK (servido dinámicamente)
│   ├── requirements.txt
│   ├── routers/
│   │   ├── auth.py          # POST /api/auth/{register,login,refresh} GET /me
│   │   ├── store.py         # GET /api/store/apps + /apps/{id}/package
│   │   ├── developer.py     # CRUD apps + upload ZIP (rol developer)
│   │   ├── admin.py         # Aprobar/rechazar apps (rol admin)
│   │   ├── device.py        # install/uninstall/activate/deactivate/launch
│   │   ├── sdk.py           # Bridge para iframes: system info, app data, GPIO
│   │   ├── hardware.py      # Sensores CRUD + GPIO + WebSocket stream
│   │   ├── notes.py         # CRUD notas
│   │   ├── system.py        # Info sistema (CPU, RAM, temp)
│   │   └── ai.py            # Generación apps con IA (SSE streaming)
│   ├── apps/                # Apps demo (clock, notes, photoframe, sysmonitor…)
│   ├── installed/           # Apps instaladas — ZIP extraídos (ignorado por git)
│   └── store/
│       ├── packages/        # ZIPs de apps (ignorado por git)
│       └── icons/           # Iconos de apps
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # BrowserRouter + AuthProvider + DeviceProvider + Routes
│   │   ├── api/
│   │   │   ├── client.js    # fetch+auth, enruta store→Railway / device→Pi
│   │   │   ├── auth.js
│   │   │   ├── store.js
│   │   │   ├── device.js
│   │   │   └── developer.js
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # JWT localStorage, auto-refresh on 401
│   │   │   └── DeviceContext.jsx # installedApps, activeApp, polling 5s
│   │   ├── components/
│   │   │   ├── layout/      # DeviceLayout, TopBar, CategoryBar
│   │   │   ├── store/       # AppCard, AppGrid, FeaturedBanner, InstallButton…
│   │   │   ├── launcher/    # LauncherGrid, LauncherAppIcon (long-press desinstala)
│   │   │   └── developer/   # UploadWizard (3 pasos), MyAppRow, StatusBadge
│   │   └── pages/
│   │       ├── StorePage.jsx
│   │       ├── AppDetailPage.jsx
│   │       ├── LauncherPage.jsx
│   │       ├── AppRunnerPage.jsx  # Carga apps en iframe desde pi.modevi.es
│   │       ├── AICreatePage.jsx   # Generación de apps con IA
│   │       ├── SettingsPage.jsx
│   │       ├── LoginPage.jsx
│   │       ├── RegisterPage.jsx
│   │       ├── DeveloperDashboard.jsx
│   │       └── DeveloperUpload.jsx
│   └── dist/                # Build de producción (generado con npm run build)
├── scripts/
│   ├── start.sh             # Arranca el backend (python3 main.py)
│   └── kiosk.sh             # Espera al backend y abre Chromium en kiosk
└── docs/
    ├── architecture.md
    ├── database-schema.md
    ├── api.md
    └── creating-apps.md
```

---

## Instalación y arranque

### Desarrollo local (Pi)

```bash
git clone <repo>
cd rasModevi

# Instalar dependencias Python
pip install -r backend/requirements.txt

# Compilar el frontend
cd frontend && npm install && npm run build && cd ..

# Configurar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con las credenciales de BD, SECRET_KEY, ANTHROPIC_API_KEY

# Arrancar
cd backend && python3 main.py
```

El servidor arranca en `http://0.0.0.0:8000` y sirve la API + el frontend React + las apps instaladas.

### Variables de entorno (backend/.env)

```env
PLATFORM_DB_URL=mysql+pymysql://user:pass@host/dbname
DEVICE_DB_PATH=./device.db
SECRET_KEY=tu-clave-secreta
ANTHROPIC_API_KEY=sk-ant-...
STORE_API_URL=https://modevi.es   # Para que la Pi descargue ZIPs de Railway
```

### Deploy en Railway

El proyecto incluye un `Dockerfile` multi-stage. Railway detecta el `Dockerfile` automáticamente.

Variables de entorno necesarias en Railway:
```
PLATFORM_DB_URL=<mysql railway url>
SECRET_KEY=<clave secreta>
ANTHROPIC_API_KEY=<api key>
DEVICE_DB_PATH=/tmp/device.db
VITE_STORE_API_URL=https://modevi.es
VITE_DEVICE_API_URL=https://pi.modevi.es
```

---

## Modo kiosk (dispositivo)

```bash
# En una terminal
bash scripts/start.sh

# En otra (o al inicio del sistema)
bash scripts/kiosk.sh
```

`kiosk.sh` espera a que el backend esté disponible y abre Chromium en modo fullscreen apuntando a `http://localhost:8000`.

---

## Base de datos

Dos bases de datos separadas:

### MySQL — Plataforma (Railway)

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios. Roles: `user`, `developer`, `admin` |
| `categories` | Categorías de apps |
| `hardware_tags` | Etiquetas de hardware requerido |
| `store_apps` | Apps publicadas. Incluye `package_data` LONGBLOB para persistir ZIPs |
| `store_app_hardware` | M2M apps ↔ hardware |
| `app_ratings` | Valoraciones (1-5 estrellas) |

### SQLite — Dispositivo (local Pi)

| Tabla | Descripción |
|-------|-------------|
| `installed_apps` | Apps instaladas en este dispositivo |
| `app_data` | KV store por app (usado por el SDK) |
| `activity_log` | Historial de instalaciones y lanzamientos |
| `notes` | Notas de la app demo |
| `device_settings` | Configuración del dispositivo |
| `registered_sensors` | Sensores físicos conectados |

---

## API REST

Documentación interactiva: `https://modevi.es/docs`

### Autenticación

```
POST /api/auth/register   Crear cuenta
POST /api/auth/login      Iniciar sesión → access_token + refresh_token
GET  /api/auth/me         Datos del usuario autenticado
POST /api/auth/refresh    Renovar access_token
```

Header requerido en endpoints protegidos:
```
Authorization: Bearer <access_token>
```

### Tienda (público)

```
GET /api/store/apps                  Lista apps publicadas
    ?search=texto
    ?category_slug=iot
    ?hardware_slug=dht22
    ?sort=downloads|rating|newest
    ?page=1&limit=20

GET /api/store/apps/:id/package      Descargar ZIP de la app
GET /api/store/apps/:slug            Detalle de una app
GET /api/store/categories            Categorías
GET /api/store/hardware-tags         Etiquetas de hardware
POST /api/store/apps/:slug/rate      Valorar app (autenticado)
```

### Portal developer (rol developer/admin)

```
GET    /api/developer/apps
POST   /api/developer/apps
POST   /api/developer/apps/:id/upload
PUT    /api/developer/apps/:id
DELETE /api/developer/apps/:id
```

### Administración (rol admin)

```
GET  /api/admin/apps
POST /api/admin/apps/:id/approve
POST /api/admin/apps/:id/reject
```

### Dispositivo (Pi)

```
GET  /api/device/apps
POST /api/device/apps/:store_id/install
POST /api/device/apps/:id/uninstall
POST /api/device/apps/:id/activate
POST /api/device/apps/:id/deactivate
POST /api/device/apps/:id/launch
```

### Hardware (Pi)

```
GET    /api/hardware/sensors
POST   /api/hardware/sensors
PUT    /api/hardware/sensors/:id
DELETE /api/hardware/sensors/:id
GET    /api/hardware/gpio/:pin
POST   /api/hardware/gpio/:pin
WS     /api/hardware/sensors/:id/stream
```

### IA

```
GET /api/ai/create-app?name=...&description=...&category_id=...&token=JWT
```

Devuelve Server-Sent Events (SSE) con el progreso de generación.

---

## SDK ModevI.js

Las apps instaladas tienen acceso a `window.ModevI` en el iframe:

```javascript
// Sistema
const info = await ModevI.system.getInfo()
// → { hostname, cpu_percent, ram_percent, temperature, uptime_seconds }

// Base de datos por app (namespaced automáticamente)
await ModevI.db.set('config', JSON.stringify({ theme: 'dark' }))
const val = await ModevI.db.get('config')
await ModevI.db.delete('config')
const all = await ModevI.db.list()
const pref = await ModevI.db.list('cfg')

// GPIO
const { value } = await ModevI.hardware.readGPIO(17)
await ModevI.hardware.writeGPIO(27, 1)

// Sensores en tiempo real
ModevI.hardware.streamSensor(sensorId, (data) => {
  console.log(data.value, data.timestamp)
})

// Notificaciones
ModevI.notify.toast('Guardado', 'success')
ModevI.notify.toast('Error', 'error')
```

Carga manual en el `<head>`:
```html
<script src="/api/sdk/app/APP_ID/sdk.js"></script>
```

---

## Formato de apps

ZIP con:

```
mi-app.zip
├── manifest.json    (obligatorio)
├── index.html       (obligatorio)
└── assets/          (opcional)
```

### manifest.json

```json
{
  "name": "Mi App",
  "version": "1.0.0",
  "description": "Descripción corta",
  "entry_point": "index.html",
  "required_hardware": ["gpio", "dht22"],
  "permissions": ["db", "sensors"]
}
```

**Hardware:** `gpio`, `i2c`, `spi`, `dht22`, `bmp280`, `hc-sr04`, `camera`, `oled`, `neopixel`

**Permisos:** `db`, `sensors`, `gpio`, `network`

Límite: **50 MB**.

---

## Generación de apps con IA

Los usuarios con rol `developer` o `admin` pueden generar apps automáticamente desde `/ai/create`.

**Flujo:**
1. El usuario introduce nombre, descripción y categoría
2. El frontend conecta via SSE a `/api/ai/create-app`
3. Railway genera un HTML completo con Claude claude-opus-4-6 (streaming en tiempo real)
4. Se crea un ZIP con el HTML y un `manifest.json` autogenerado
5. El ZIP se guarda en el filesystem de Railway **y** en la columna `package_data` de MySQL (para sobrevivir reinicios)
6. La app aparece publicada en la tienda inmediatamente
7. El usuario la instala en la Pi — la Pi descarga el ZIP de Railway vía `/api/store/apps/{id}/package`

**Apps generadas:** single HTML file, dark theme (`#0f0f1a`), optimizadas para pantalla táctil 800×480, sin CDN externos.

---

## Credenciales por defecto

Creadas automáticamente al primer arranque:

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | admin |
| `devuser` | `dev123` | developer |

---

## Rutas del frontend

| Ruta | Descripción |
|------|-------------|
| `/` | Tienda de apps |
| `/app/:slug` | Detalle de una app |
| `/launcher` | Pantalla inicio del dispositivo |
| `/run/:app_id` | Ejecución de app en iframe fullscreen |
| `/ai/create` | Generador de apps con IA |
| `/settings` | Ajustes del dispositivo |
| `/login` | Inicio de sesión |
| `/register` | Registro |
| `/developer` | Portal developer |
| `/developer/upload` | Publicar nueva app |
