# ModevI

Plataforma modular de aplicaciones para Raspberry Pi 5 con pantalla táctil. El dispositivo arranca directamente en una tienda de apps (sin escritorio visible), donde el usuario puede instalar aplicaciones creadas por la comunidad — o generarlas con IA. Las apps pueden acceder al hardware de la Pi mediante el SDK de ModevI.

---

## Indice

- [Concepto](#concepto)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Instalación y arranque](#instalación-y-arranque)
- [Modo kiosk (dispositivo)](#modo-kiosk-dispositivo)
- [Base de datos](#base-de-datos)
- [API REST](#api-rest)
- [SDK ModevI.js](#sdk-modevi-js)
- [Librerías JS disponibles](#librerías-js-disponibles)
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
| Almacenamiento de ficheros | Cloudflare R2 (ZIPs de apps, iconos) |
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
│   ├── hw.py                # Utilidades de hardware compartidas (GPIO, PWM, I2C, cámara)
│   ├── requirements.txt
│   ├── routers/
│   │   ├── auth.py          # POST /api/auth/{register,login,refresh} GET /me
│   │   ├── store.py         # GET /api/store/apps + /apps/{id}/package
│   │   ├── developer.py     # CRUD apps + upload ZIP (rol developer)
│   │   ├── admin.py         # Aprobar/rechazar apps (rol admin)
│   │   ├── device.py        # install/uninstall/activate/deactivate/launch
│   │   ├── sdk.py           # Bridge para iframes: system info, app data, SQL DB, GPIO, PWM, I2C, cámara, librerías JS
│   │   ├── hardware.py      # Sensores CRUD + GPIO + PWM + I2C + cámara + WebSocket stream
│   │   ├── notes.py         # CRUD notas
│   │   ├── system.py        # Info sistema (CPU, RAM, temp)
│   │   └── ai.py            # Generación apps con IA (SSE streaming)
│   ├── apps/                # Apps demo (clock, notes, photoframe, sysmonitor…)
│   ├── installed/           # Apps instaladas — ZIP extraídos (ignorado por git)
│   ├── app_data/            # BDs SQLite por app (ignorado por git)
│   ├── libs/                # Mirror local de librerías JS (ignorado por git)
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
│   ├── kiosk.sh             # Espera al backend y abre Chromium en kiosk
│   └── download_libs.sh     # Descarga/actualiza las librerías JS del mirror local
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

# Descargar librerías JS del mirror local
bash scripts/download_libs.sh

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
STORE_API_URL=https://modevi.es   # Para que la Pi descargue ZIPs de R2 vía Railway
```

> **Nota:** `picamera2` no está disponible en pip. Instalarlo vía apt: `sudo apt install python3-picamera2`

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
R2_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2 access key>
R2_SECRET_ACCESS_KEY=<r2 secret key>
R2_BUCKET_NAME=modevi
R2_PUBLIC_URL=https://pub-<hash>.r2.dev
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
| `store_apps` | Apps publicadas. `package_url` apunta al ZIP en R2; `icon_path` al icono en R2 |
| `store_app_hardware` | M2M apps ↔ hardware |
| `app_ratings` | Valoraciones (1-5 estrellas) |

### SQLite — Dispositivo (local Pi)

| Tabla | Descripción |
|-------|-------------|
| `installed_apps` | Apps instaladas por usuario (`user_id` + `store_app_id` → unique). Cada usuario tiene su propia lista independiente. |
| `app_data` | KV store por app (usado por el SDK) |
| `activity_log` | Historial de instalaciones y lanzamientos |
| `notes` | Notas de la app demo — aisladas por `user_id` |
| `device_settings` | Configuración del dispositivo (compartida por todos los usuarios) |
| `registered_sensors` | Sensores físicos conectados (compartidos por todos los usuarios) |

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

Todos los endpoints de dispositivo requieren autenticación JWT. Los resultados se filtran por el usuario autenticado (cada usuario ve solo sus apps instaladas y sus notas).

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
GET    /api/hardware/gpio/:pin/pwm
POST   /api/hardware/gpio/:pin/pwm
GET    /api/hardware/i2c/:bus/:address/:register
GET    /api/hardware/camera/snapshot
GET    /api/hardware/camera/stream
WS     /api/hardware/sensors/:id/stream
```

### IA

```
GET  /api/ai/create-app?name=...&description=...&category_id=...&token=JWT
GET  /api/ai/debug-app?installed_id=...&feedback=...&token=JWT         ← Pi (DEVICE_BASE)
POST /api/ai/publish-improved   body: {installed_id, name, description, category_id?}
```

`create-app` y `debug-app` devuelven Server-Sent Events (SSE) con el progreso en tiempo real.
`publish-improved` es un POST síncrono que publica la versión local instalada como nueva app en la tienda.

---

## SDK ModevI.js

Las apps instaladas tienen acceso a `window.ModevI` en el iframe (versión 1.1.0):

```javascript
// Sistema
const info = await ModevI.system.info()
// → { hostname, platform, cpu_percent, cpu_count, ram_percent, ram_total, ram_used,
//     disk_percent, disk_total, disk_used, temperature, uptime_seconds }

// ── SQL por app (ModevI.db) — para datos estructurados e históricos ──────────
await ModevI.db.exec(
  "CREATE TABLE IF NOT EXISTS lecturas (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, valor REAL)"
)
const { last_insert_id } = await ModevI.db.exec(
  "INSERT INTO lecturas (ts, valor) VALUES (?, ?)", [Date.now(), 23.4]
)
const rows = await ModevI.db.query(
  "SELECT AVG(valor) as media FROM lecturas WHERE ts > ?", [Date.now() - 3600000]
)
// Cada app tiene su propio SQLite aislado. Se borra al desinstalar.

// ── KV store (ModevI.data) — para preferencias simples ───────────────────────
await ModevI.data.set('tema', 'oscuro')
const { value } = await ModevI.data.get('tema')   // → { key, value, updated_at }
await ModevI.data.delete('tema')
const all = await ModevI.data.getAll()

// ── GPIO digital ─────────────────────────────────────────────────────────────
const { value } = await ModevI.hardware.gpioRead(17)
await ModevI.hardware.gpioWrite(17, 1)

// ── PWM — LEDs dimmer, servos, ventiladores ───────────────────────────────────
await ModevI.hardware.pwmSet(18, 0.75)        // pin 18 al 75%
const { duty_cycle } = await ModevI.hardware.pwmGet(18)

// ── I2C — sensores (BME280, VL53L0X, SSD1306…) ───────────────────────────────
const { data } = await ModevI.hardware.i2cRead(0x76, 0xD0, 1)   // 1 byte
const { data } = await ModevI.hardware.i2cRead(0x76, 0xF7, 8)   // 8 bytes

// ── Cámara ────────────────────────────────────────────────────────────────────
const imgUrl = await ModevI.hardware.camera.snapshot()   // data URL base64
document.getElementById('foto').src = imgUrl
document.getElementById('cam').src = ModevI.hardware.camera.streamUrl()  // MJPEG live

// ── Notificaciones ────────────────────────────────────────────────────────────
ModevI.notify.toast('Guardado', 'success')
ModevI.notify.toast('Error al conectar', 'error')
```

Carga manual en el `<head>`:
```html
<script src="/api/sdk/app/APP_ID/sdk.js"></script>
```

---

## Librerías JS disponibles

Las apps pueden usar estas librerías sin CDN externo, referenciando el mirror local:

| Librería | `<script>` tag | Uso |
|----------|----------------|-----|
| Chart.js 4.4 | `<script src="/api/sdk/libs/chart.js"></script>` | Gráficas (line, bar, pie, radar…) |
| Three.js r160 | `<script src="/api/sdk/libs/three.js"></script>` | Gráficos 3D / WebGL |
| Alpine.js 3.13 | `<script defer src="/api/sdk/libs/alpine.js"></script>` | Reactividad declarativa |
| Anime.js 3.2 | `<script src="/api/sdk/libs/anime.js"></script>` | Animaciones CSS/JS |
| Matter.js 0.19 | `<script src="/api/sdk/libs/matter.js"></script>` | Física 2D (juegos) |
| Tone.js 14.7 | `<script src="/api/sdk/libs/tone.js"></script>` | Audio y síntesis musical |
| Marked.js 9.1 | `<script src="/api/sdk/libs/marked.js"></script>` | Renderizar Markdown |

El endpoint `GET /api/sdk/libs` devuelve el catálogo completo con URLs. Los archivos se sirven con caché de 1 año (`Cache-Control: immutable`).

Al desplegar en una Pi nueva o actualizar versiones, ejecutar:
```bash
bash scripts/download_libs.sh
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

## IA para apps — Crear, Mejorar y Publicar

Los usuarios con rol `developer` o `admin` acceden a estas funciones desde `/ai/create`.

### Crear nueva app

1. El usuario introduce nombre, descripción y categoría (modo libre o guiado con preguntas)
2. El frontend abre SSE a `/api/ai/create-app` en Railway
3. Claude claude-opus-4-6 genera un HTML completo en streaming
4. `claude-haiku-4-5` genera automáticamente una descripción legible para la tienda
5. Se crea un ZIP y se sube a **Cloudflare R2** (permanente, no se pierde en reinicios)
6. La app aparece publicada en la tienda inmediatamente
7. Se instala en la Pi automáticamente

### Mejorar app instalada

1. En el tab "Mejorar", el usuario selecciona cualquier app instalada del grid
2. Describe los cambios o bugs a corregir
3. Claude regenera el HTML completo con las mejoras aplicadas (SSE via Pi)
4. **Solo modifica los archivos locales de la Pi** — la app original en la tienda queda intacta
5. El usuario puede probar la app y decidir si publicar la versión mejorada

### Publicar versión mejorada en la tienda

Disponible siempre que haya una app seleccionada en el tab "Mejorar", independientemente de si se mejoró en esa sesión. Crea una **nueva entrada** en la tienda sin tocar la original:

- Rellena nombre, descripción y categoría
- El backend lee el `index.html` actual de la Pi, crea un ZIP y lo sube a R2
- Aparece publicada inmediatamente como nueva app

**Transparencia open source:** el prompt original del usuario se almacena en `store_apps.ai_prompt` y es visible en la página de detalle (sección colapsable "Generada con IA — ver prompt").

**Apps generadas:** single HTML file, dark theme (`#0f0f1a`), optimizadas para pantalla táctil. Usan el mirror local de librerías JS (Chart.js, Three.js, Alpine.js…) con `<script src="/api/sdk/libs/chart.js">` — sin CDN externo.

---

## Limitaciones actuales y trabajo futuro

### Modelo de dispositivo único — aislamiento por usuario

La Pi es un dispositivo compartido: múltiples usuarios pueden iniciar sesión en la misma Pi (la misma `device.db`, los mismos archivos físicos). El aislamiento por usuario se consigue a nivel de datos:

- **Apps instaladas**: la columna `user_id` en `installed_apps` garantiza que cada usuario ve solo sus propias apps. Dos usuarios pueden instalar la misma app en la misma Pi de forma completamente independiente.
- **Notas**: la columna `user_id` en `notes` asegura que cada usuario ve solo sus propias notas.
- **Hardware y sensores**: los recursos físicos (GPIO, I2C, sensores registrados, `device_settings`) son globales y compartidos por todos los usuarios.
- **SQLite por app**: la base de datos de cada app instalada (`app_data/app_{installed_id}.db`) está ligada a la instancia instalada concreta, no a la app global — si dos usuarios instalan la misma app, cada uno tiene su propio SQLite aislado.

**Evolución natural hacia multi-dispositivo:**

1. **Registro de dispositivo** — Al arrancar, la Pi se registra en Railway con un `device_token` único vinculado al usuario propietario
2. **Autenticación de dispositivo** — La Pi se identifica en cada petición de device API mediante ese token, no el usuario desde el browser
3. **Routing dinámico** — El frontend obtiene la URL del device del usuario autenticado (`user.device_url`) en lugar de usar `VITE_DEVICE_API_URL` fijo

```
Futuro:
  Fernando → pi.modevi.es/fernando  → Pi de Fernando
  María    → pi.modevi.es/maria     → Pi de María
  (cada Pi registrada con su token, cada una con su estado independiente)
```

### Otras mejoras planificadas

- **Panel de admin** con gestión visual de usuarios y apps desde la web
- **Actualizaciones OTA** de apps — el developer publica v2 y los dispositivos instalados reciben la actualización
- **Permisos granulares** — las apps declaran qué permisos necesitan y el usuario los aprueba al instalar
- **Marketplace de hardware** — filtrar apps por el hardware exacto conectado a tu Pi (detectado automáticamente)

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
