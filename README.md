# ModevI

Plataforma modular de aplicaciones para Raspberry Pi 5 con pantalla táctil. El dispositivo arranca directamente en una tienda de apps (sin escritorio visible), donde el usuario puede instalar aplicaciones creadas por la comunidad. Las apps pueden acceder al hardware de la Pi mediante el SDK de ModevI.

---

## Índice

- [Concepto](#concepto)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Instalación y arranque](#instalación-y-arranque)
- [Modo kiosk (dispositivo)](#modo-kiosk-dispositivo)
- [Base de datos](#base-de-datos)
- [API REST](#api-rest)
- [SDK ModevI.js](#sdk-modevi-js)
- [Formato de apps](#formato-de-apps)
- [Credenciales por defecto](#credenciales-por-defecto)

---

## Concepto

ModevI tiene dos partes:

**Tienda comunitaria** — Plataforma web donde developers publican apps open source empaquetadas como ZIP. Cada app declara qué hardware requiere (GPIO, I2C, DHT22, cámara…). Los usuarios filtran por hardware disponible, valoran las apps e instalan las que quieren.

**Experiencia de dispositivo** — La Raspberry Pi 5 arranca en modo kiosk directamente en la store de ModevI, sin exponer el sistema operativo. El usuario navega la tienda desde la pantalla táctil de 7", instala apps y las lanza. Las apps se ejecutan en un iframe y tienen acceso al hardware de la Pi a través del SDK de ModevI.js.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Raspberry Pi 5                        │
│                                                          │
│  ┌──────────────┐    ┌────────────────────────────────┐ │
│  │  Chromium    │    │        FastAPI :8000            │ │
│  │  (kiosk)     │◄──►│                                │ │
│  │              │    │  /api/auth     ← JWT auth       │ │
│  │  React SPA   │    │  /api/store    ← Tienda pública │ │
│  │  + Router    │    │  /api/device   ← Instalación   │ │
│  │              │    │  /api/hardware ← GPIO/sensores  │ │
│  │  ModevI.js   │    │  /api/sdk      ← Bridge iframe  │ │
│  │  SDK bridge  │    │  /api/developer← Portal devs   │ │
│  └──────────────┘    │  /api/admin    ← Administración │ │
│                      │  /api/notes    ← Notas          │ │
│  App iframe          │  /api/system   ← Info sistema   │ │
│  (sandboxed)         │                                │ │
│  window.ModevI  ────►│  SQLite (modevi.db)            │ │
│                      │  /installed/   ← Apps extraídas│ │
│                      │  /store/       ← Paquetes ZIP  │ │
│                      └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Stack técnico:**

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.13, FastAPI 0.135, Uvicorn |
| Base de datos | SQLite + SQLAlchemy 2.0 |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Hardware | gpiozero (GPIO), smbus2 (I2C) |
| Frontend | React 19, Vite 7, TailwindCSS 4, React Router 7 |
| Iconos | lucide-react |
| Kiosk | Chromium en modo fullscreen |

---

## Estructura del proyecto

```
rasModevi/
├── backend/
│   ├── main.py              # Entrada FastAPI + static mounts
│   ├── database.py          # SQLAlchemy engine, session factory
│   ├── models.py            # 12 modelos ORM
│   ├── schemas.py           # Pydantic v2 schemas (request/response)
│   ├── auth.py              # JWT utilities + FastAPI dependencies
│   ├── seed.py              # Datos iniciales (usuarios, categorías, apps demo)
│   ├── modevi_sdk.py        # ModevI.js SDK (servido dinámicamente)
│   ├── requirements.txt
│   ├── routers/
│   │   ├── auth.py          # POST /api/auth/{register,login,refresh} GET /api/auth/me
│   │   ├── store.py         # GET /api/store/{apps,categories,hardware-tags,ratings}
│   │   ├── developer.py     # CRUD apps + upload ZIP (rol developer)
│   │   ├── admin.py         # Aprobar/rechazar apps (rol admin)
│   │   ├── device.py        # install/uninstall/activate/deactivate/launch
│   │   ├── sdk.py           # Bridge para iframes: system info, app data, GPIO
│   │   ├── hardware.py      # Sensores CRUD + GPIO read/write + WebSocket stream
│   │   ├── notes.py         # CRUD notas
│   │   └── system.py        # Info sistema (CPU, RAM, temp)
│   ├── apps/                # Apps demo legacy (clock, notes, photoframe, sysmonitor)
│   ├── installed/           # Apps instaladas (ZIP extraídos, auto-creado)
│   └── store/
│       ├── packages/        # ZIPs subidos por developers (auto-creado)
│       └── icons/           # Iconos extraídos de los ZIPs (auto-creado)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # BrowserRouter + proveedores + rutas
│   │   ├── main.jsx         # Entry point React
│   │   ├── index.css        # Tailwind + fuentes + CSS variables + animaciones
│   │   ├── api/             # Capa de acceso a API (client, auth, store, device…)
│   │   ├── context/         # AuthContext + DeviceContext
│   │   ├── components/
│   │   │   ├── layout/      # DeviceLayout, TopBar, CategoryBar, HardwareFilterBar
│   │   │   ├── store/       # AppCard, AppGrid, FeaturedBanner, InstallButton…
│   │   │   ├── detail/      # AppDetailHeader, RatingsSection
│   │   │   ├── launcher/    # LauncherGrid, LauncherAppIcon
│   │   │   └── developer/   # UploadWizard, MyAppRow, StatusBadge
│   │   └── pages/           # StorePage, AppDetailPage, LauncherPage, AppRunnerPage…
│   └── dist/                # Build de producción (generado con vite build)
├── scripts/
│   ├── start.sh             # Arranca el backend (python3 main.py)
│   └── kiosk.sh             # Espera al backend y abre Chromium en kiosk
└── docs/
    ├── architecture.md      # Arquitectura detallada
    ├── database-schema.md   # Esquema de BD completo con código SQLAlchemy
    ├── api.md               # Referencia de endpoints
    └── creating-apps.md     # Guía para crear y publicar apps
```

---

## Requisitos

**Hardware:**
- Raspberry Pi 5 (recomendado: 4GB+ RAM)
- Raspberry Pi Touch Display 2 (7")
- Raspberry Pi OS Bookworm 64-bit

**Software:**
- Python 3.11+
- Node.js 20+ (solo para compilar el frontend)
- Chromium (preinstalado en Pi OS)

---

## Instalación y arranque

### 1. Clonar e instalar dependencias

```bash
git clone <repo>
cd rasModevi

# Instalar dependencias Python
pip install -r backend/requirements.txt

# Compilar el frontend (solo necesario si se modificó)
cd frontend
npm install
npm run build
cd ..
```

### 2. Arrancar el servidor

```bash
bash scripts/start.sh
# o directamente:
cd backend && python3 main.py
```

El servidor arranca en `http://0.0.0.0:8000` y sirve:
- La API REST en `/api/*`
- El frontend React en `/`
- Las apps instaladas en `/installed/*`
- Los paquetes de la tienda en `/store/*`

La base de datos SQLite (`backend/modevi.db`) y los directorios `store/` e `installed/` se crean automáticamente al primer arranque.

### 3. Acceder

Desde la Pi o cualquier dispositivo en la misma red:
```
http://192.168.88.242:8000
```

---

## Modo kiosk (dispositivo)

El script `scripts/kiosk.sh` espera a que el backend esté disponible y luego abre Chromium en modo pantalla completa apuntando a `http://localhost:8000`.

```bash
# En una terminal
bash scripts/start.sh

# En otra terminal (o al inicio del sistema)
bash scripts/kiosk.sh
```

Para que el dispositivo arranque directamente en modo kiosk al encenderse, añadir al autostart de la sesión gráfica de Pi OS.

---

## Base de datos

SQLite en `backend/modevi.db`. 12 tablas organizadas en dos dominios:

### Dominio plataforma (community store)

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios del sistema. Roles: `user`, `developer`, `admin` |
| `categories` | Categorías de apps (Utilidades, IoT, Juegos…) |
| `hardware_tags` | Etiquetas de hardware (GPIO, I2C, DHT22, Camera…) |
| `store_apps` | Apps publicadas en la tienda. Estado: `pending`/`published`/`rejected` |
| `store_app_hardware` | Relación M2M entre apps y hardware requerido |
| `app_ratings` | Valoraciones (1-5 estrellas) y comentarios de usuarios |

### Dominio dispositivo (local)

| Tabla | Descripción |
|-------|-------------|
| `installed_apps` | Apps instaladas en este dispositivo |
| `app_data` | Almacenamiento clave-valor por app (usado por el SDK) |
| `activity_log` | Historial de instalaciones, activaciones y lanzamientos |
| `notes` | Notas de la app demo de notas |
| `device_settings` | Configuración del dispositivo (brillo, zona horaria…) |
| `registered_sensors` | Sensores físicos conectados a la Pi |

---

## API REST

Base: `http://localhost:8000`

Documentación interactiva (Swagger): `http://localhost:8000/docs`

### Autenticación

```
POST /api/auth/register   Crear cuenta
POST /api/auth/login      Iniciar sesión → devuelve access_token + refresh_token
GET  /api/auth/me         Datos del usuario autenticado
POST /api/auth/refresh    Renovar access_token con refresh_token
```

Los endpoints protegidos requieren el header:
```
Authorization: Bearer <access_token>
```

### Tienda (público)

```
GET /api/store/apps                  Lista apps publicadas
    ?search=texto                    Búsqueda por nombre/descripción
    ?category_slug=iot               Filtrar por categoría
    ?hardware_slug=dht22             Filtrar por hardware requerido
    ?sort=downloads|rating|newest    Ordenar
    ?page=1&limit=20                 Paginación

GET /api/store/apps/:slug            Detalle de una app
GET /api/store/categories            Lista de categorías
GET /api/store/hardware-tags         Lista de etiquetas de hardware
GET /api/store/apps/:slug/ratings    Valoraciones de una app
POST /api/store/apps/:slug/rate      Valorar una app (autenticado)
DELETE /api/store/apps/:slug/rate    Eliminar propia valoración
```

### Portal developer (rol developer/admin)

```
GET    /api/developer/apps           Mis apps
POST   /api/developer/apps           Crear nueva app
POST   /api/developer/apps/:id/upload  Subir ZIP del paquete
PUT    /api/developer/apps/:id       Actualizar metadatos
DELETE /api/developer/apps/:id       Eliminar app
```

### Administración (rol admin)

```
GET  /api/admin/apps           Todas las apps (incluidas pendientes)
POST /api/admin/apps/:id/approve  Aprobar app → status=published
POST /api/admin/apps/:id/reject   Rechazar app → status=rejected
```

### Dispositivo

```
GET  /api/device/apps                    Apps instaladas
GET  /api/device/apps/active             App activa actualmente
POST /api/device/apps/:store_id/install  Instalar app
POST /api/device/apps/:id/uninstall      Desinstalar
POST /api/device/apps/:id/activate       Activar (lanza en modo kiosk)
POST /api/device/apps/:id/deactivate     Desactivar
POST /api/device/apps/:id/launch         Registrar lanzamiento
```

### Hardware

```
GET  /api/hardware/sensors               Sensores registrados
POST /api/hardware/sensors               Registrar sensor
PUT  /api/hardware/sensors/:id           Actualizar sensor
DELETE /api/hardware/sensors/:id         Eliminar sensor
GET  /api/hardware/gpio/:pin             Leer pin GPIO (mock si no es Pi)
POST /api/hardware/gpio/:pin             Escribir pin GPIO
WS   /api/hardware/sensors/:id/stream    Stream en tiempo real (WebSocket)
```

### Sistema

```
GET /api/system/info    CPU, RAM, temperatura, disco, uptime
GET /api/system/stats   Estadísticas de la plataforma (apps, instalaciones)
```

---

## SDK ModevI.js

Las apps instaladas tienen acceso al objeto `window.ModevI` inyectado automáticamente en el iframe. Permite comunicarse con el sistema sin salir del sandbox.

```javascript
// Sistema
const info = await ModevI.system.getInfo()
// → { hostname, cpu_percent, ram_percent, temperature, uptime_seconds, … }

// Base de datos por app (namespaced automáticamente)
await ModevI.db.set('config', JSON.stringify({ theme: 'dark' }))
const val = await ModevI.db.get('config')
await ModevI.db.delete('config')
const all = await ModevI.db.list()       // todos los pares clave-valor
const pref = await ModevI.db.list('cfg') // solo los que empiezan por 'cfg'

// Hardware - sensores registrados
const sensors = await ModevI.hardware.getSensors()

// Hardware - GPIO
const { value } = await ModevI.hardware.readGPIO(17)   // 0 o 1
await ModevI.hardware.writeGPIO(27, 1)                 // encender LED

// Hardware - sensor en tiempo real
ModevI.hardware.streamSensor(sensorId, (data) => {
  console.log(data.value, data.timestamp)
})

// Notificaciones al sistema
ModevI.notify.toast('Guardado correctamente', 'success')
ModevI.notify.toast('Error de conexión', 'error')
```

El SDK se carga automáticamente añadiendo en el `<head>` de la app:
```html
<script src="/api/sdk/app/APP_ID/sdk.js"></script>
```

---

## Formato de apps

Las apps se distribuyen como archivos ZIP con la siguiente estructura:

```
mi-app.zip
├── manifest.json    (obligatorio)
├── index.html       (obligatorio, punto de entrada)
└── assets/          (opcional, imágenes, CSS, JS compilado…)
```

### manifest.json

```json
{
  "name": "Mi App",
  "version": "1.0.0",
  "description": "Descripción corta (máx. 500 caracteres)",
  "entry_point": "index.html",
  "required_hardware": ["gpio", "dht22"],
  "permissions": ["db", "sensors"],
  "icon": "assets/icon.png"
}
```

**Campos de `required_hardware`:** `gpio`, `i2c`, `spi`, `dht22`, `bmp280`, `hc-sr04`, `camera`, `oled`, `neopixel`

**Campos de `permissions`:** `db` (acceso a base de datos), `sensors` (lectura de sensores), `gpio` (control GPIO), `network` (acceso a internet)

El ZIP tiene un límite de **50 MB**. La app se extrae en `backend/installed/<id>/` cuando el usuario la instala desde la tienda.

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
| `/` | Tienda de apps: búsqueda, filtros, grid |
| `/app/:slug` | Detalle de una app |
| `/launcher` | Pantalla inicio del dispositivo |
| `/running/:app_id` | Ejecución de app en iframe fullscreen |
| `/settings` | Ajustes del dispositivo y sensores |
| `/login` | Inicio de sesión |
| `/register` | Registro de cuenta |
| `/developer` | Portal developer: mis apps y estadísticas |
| `/developer/upload` | Wizard de publicación de nueva app |
