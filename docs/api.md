# Referencia de la API ModevI

Base URL: `http://localhost:8000`
Swagger interactivo: `http://localhost:8000/docs`
ReDoc: `http://localhost:8000/redoc`

---

## Autenticación

La API usa **JWT Bearer tokens**.

```
Authorization: Bearer <access_token>
```

Los tokens de acceso expiran en **30 minutos**. Usa el refresh token (válido 7 días) para renovarlos sin obligar al usuario a iniciar sesión.

### Errores de autenticación

Todos los errores siguen el formato:
```json
{ "detail": "Mensaje legible", "code": "ERROR_CODE" }
```

Códigos comunes: `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `INVALID_REFRESH_TOKEN`, `USERNAME_TAKEN`, `EMAIL_TAKEN`

---

## /api/auth — Autenticación

### POST /api/auth/register

Crea una nueva cuenta de usuario.

**Body:**
```json
{
  "username": "string (3-50 chars)",
  "email": "user@example.com",
  "password": "string (min 6 chars)",
  "role": "user | developer"
}
```

**Response 201:**
```json
{
  "id": 1,
  "username": "fernandodev",
  "email": "fernando@example.com",
  "role": "developer",
  "avatar_url": null,
  "bio": null,
  "is_active": true,
  "created_at": "2026-03-10T10:00:00"
}
```

**Errores:** `409 USERNAME_TAKEN`, `409 EMAIL_TAKEN`

---

### POST /api/auth/login

Inicia sesión y devuelve los tokens JWT.

**Body:**
```json
{ "username": "admin", "password": "admin123" }
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errores:** `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DISABLED`

---

### GET /api/auth/me

Devuelve los datos del usuario autenticado.

**Auth:** Requerida

**Response 200:** Mismo formato que UserOut (ver register)

---

### POST /api/auth/refresh

Renueva el access_token usando el refresh_token.

**Body:**
```json
{ "refresh_token": "eyJ..." }
```

**Response 200:** Mismo formato que login (nuevos tokens)

**Errores:** `401 INVALID_REFRESH_TOKEN`

---

## /api/store — Tienda pública

### GET /api/store/categories

Lista todas las categorías disponibles.

**Auth:** No requerida

**Response 200:**
```json
[
  { "id": 1, "name": "Utilidades", "slug": "utilidades", "icon": "Wrench", "description": null, "sort_order": 0 },
  { "id": 7, "name": "IoT", "slug": "iot", "icon": "Radio", "description": null, "sort_order": 6 }
]
```

---

### GET /api/store/hardware-tags

Lista todas las etiquetas de hardware disponibles para filtrar.

**Auth:** No requerida

**Response 200:**
```json
[
  { "id": 1, "name": "GPIO", "slug": "gpio", "description": "General Purpose I/O pins", "interface": "gpio" },
  { "id": 4, "name": "DHT22", "slug": "dht22", "description": "Temperature and humidity sensor", "interface": "gpio" }
]
```

---

### GET /api/store/apps

Lista apps publicadas con filtros y paginación.

**Auth:** No requerida

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `search` | string | — | Búsqueda en nombre y descripción |
| `category_slug` | string | — | Filtrar por slug de categoría |
| `hardware_slug` | string | — | Filtrar por slug de hardware requerido |
| `sort` | string | `downloads` | `downloads` \| `rating` \| `newest` |
| `page` | int | `1` | Página (≥ 1) |
| `limit` | int | `20` | Resultados por página (1-100) |

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Reloj",
    "slug": "clock",
    "description": "Reloj digital con fecha y hora",
    "icon_path": null,
    "version": "1.0.0",
    "avg_rating": 4.5,
    "ratings_count": 12,
    "downloads_count": 150,
    "status": "published",
    "required_hardware": [],
    "permissions": [],
    "category_id": 1,
    "developer_id": 2,
    "created_at": "2026-03-10T10:00:00",
    "developer": { "id": 2, "username": "devuser", "role": "developer" }
  }
]
```

---

### GET /api/store/apps/:slug

Detalle completo de una app publicada.

**Auth:** No requerida

**Response 200:** Igual que el item del listado, más:
```json
{
  "long_description": "Descripción larga en texto plano...",
  "hardware_tags": [
    { "id": 4, "name": "DHT22", "slug": "dht22", "interface": "gpio" }
  ],
  "ai_prompt": "Prompt original del usuario si la app fue generada con IA, null en caso contrario"
}
```

**Errores:** `404 APP_NOT_FOUND`

---

### GET /api/store/apps/:slug/ratings

Lista de valoraciones de una app.

**Auth:** No requerida

**Response 200:**
```json
[
  {
    "id": 1,
    "user_id": 3,
    "store_app_id": 1,
    "rating": 5,
    "comment": "Muy buena app, funciona perfectamente con el DHT22",
    "created_at": "2026-03-10T12:00:00",
    "user": { "id": 3, "username": "usuario1" }
  }
]
```

---

### POST /api/store/apps/:slug/rate

Valorar una app. Si el usuario ya tiene una valoración, se actualiza (upsert).

**Auth:** Requerida

**Body:**
```json
{ "rating": 5, "comment": "Excelente app" }
```

`rating` debe estar entre 1 y 5.

**Response 201:** Objeto rating creado/actualizado.

---

### DELETE /api/store/apps/:slug/rate

Eliminar la propia valoración.

**Auth:** Requerida

**Response 204:** Sin contenido.

---

## /api/developer — Portal developer

Todos los endpoints requieren rol `developer` o `admin`.

### GET /api/developer/apps

Lista las apps del developer autenticado.

**Response 200:** Array de StoreApp (mismo formato que listado público, incluye `pending` y `rejected`)

---

### POST /api/developer/apps

Crea una nueva app (en estado `pending`).

**Body:**
```json
{
  "name": "Mi App",
  "description": "Descripción corta",
  "long_description": "Descripción larga opcional",
  "version": "1.0.0",
  "category_id": 7
}
```

**Response 201:** StoreApp creada.

---

### POST /api/developer/apps/:id/upload

Sube el paquete ZIP de la app. **Multipart/form-data**.

**Form field:** `file` (archivo .zip, máx. 50 MB)

El ZIP debe contener un `manifest.json` válido con los campos `name`, `version`, `description`, `entry_point`.

**Response 200:** StoreApp actualizada con `package_path` e `icon_path`.

**Errores:** `400` si el ZIP es inválido o falta el manifest, `413` si supera 50 MB.

---

### PUT /api/developer/apps/:id

Actualiza los metadatos de una app propia.

**Body:** Cualquier subconjunto de los campos de creación.

---

### DELETE /api/developer/apps/:id

Elimina una app propia y su paquete.

**Response 204:** Sin contenido.

---

## /api/admin — Administración

Todos los endpoints requieren rol `admin`.

### GET /api/admin/apps

Lista todas las apps (cualquier estado).

**Response 200:** Array de StoreApp.

---

### POST /api/admin/apps/:id/approve

Publica una app (cambia estado a `published`).

**Response 200:** StoreApp actualizada.

---

### POST /api/admin/apps/:id/reject

Rechaza una app con motivo.

**Body:**
```json
{ "reason": "El manifest.json contiene campos inválidos" }
```

**Response 200:** StoreApp actualizada con `rejection_reason`.

---

## /api/device — Gestión del dispositivo

> **Autenticación requerida en todos los endpoints.** Los resultados se filtran automáticamente por el usuario autenticado: cada usuario ve solo sus propias apps instaladas. El mismo `store_app_id` puede estar instalado por múltiples usuarios de forma independiente.

### GET /api/device/apps

Lista las apps instaladas por el usuario autenticado, con datos de la app de la tienda.

**Auth:** Requerida

**Response 200:**
```json
[
  {
    "id": 1,
    "store_app_id": 2,
    "user_id": 3,
    "install_date": "2026-03-10T10:00:00",
    "is_active": false,
    "last_launched": null,
    "launch_count": 0,
    "install_path": "/path/to/installed/1",
    "store_app": { "id": 2, "name": "Reloj", "slug": "clock", ... }
  }
]
```

---

### GET /api/device/apps/active

Devuelve la app activa actualmente para el usuario autenticado, o `null` si ninguna está activa.

**Auth:** Requerida

---

### POST /api/device/apps/:store_app_id/install

Instala una app desde la tienda para el usuario autenticado. Extrae el ZIP en `backend/installed/<id>/`. Incrementa `downloads_count`.

**Auth:** Requerida

**Errores:** `404 APP_NOT_FOUND`, `409 ALREADY_INSTALLED` (el mismo usuario ya la tiene instalada)

**Response 201:** InstalledApp creada.

---

### POST /api/device/apps/:installed_id/uninstall

Desinstala una app del usuario autenticado. Elimina:
- Los archivos extraídos del ZIP (`backend/installed/{id}/`)
- La base de datos SQLite de la app (`backend/app_data/app_{id}.db`) si existe
- Todas las entradas del KV store asociadas a esta app

**Auth:** Requerida

**Response 204**

---

### POST /api/device/apps/:installed_id/activate

Activa una app (desactiva las demás del mismo usuario). Registra en el log de actividad.

**Auth:** Requerida

**Response 200:** InstalledApp actualizada con `is_active: true`.

---

### POST /api/device/apps/:installed_id/deactivate

Desactiva la app.

**Auth:** Requerida

**Response 204**

---

### POST /api/device/apps/:installed_id/launch

Registra que la app fue lanzada. Incrementa `launch_count` y actualiza `last_launched`.

**Auth:** Requerida

**Response 204**

---

## /api/hardware — Hardware y sensores

### GET /api/hardware/sensors

Lista los sensores registrados en este dispositivo.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Temperatura exterior",
    "sensor_type": "DHT22",
    "interface": "gpio",
    "pin_or_address": "4",
    "is_active": true,
    "created_at": "2026-03-10T10:00:00"
  }
]
```

---

### POST /api/hardware/sensors

Registra un nuevo sensor físico.

**Body:**
```json
{
  "name": "Temperatura exterior",
  "sensor_type": "DHT22",
  "interface": "gpio",
  "pin_or_address": "4",
  "config_json": { "pull_up": true, "interval": 2 },
  "hardware_tag_id": 4
}
```

`interface` debe ser `gpio`, `i2c` o `spi`.

**Response 201:** Sensor creado.

---

### PUT /api/hardware/sensors/:id

Actualiza la configuración de un sensor existente.

---

### DELETE /api/hardware/sensors/:id

Elimina el registro de un sensor.

**Response 204**

---

### GET /api/hardware/gpio/:pin

Lee el valor de un pin GPIO (0 o 1). En entornos no-Pi devuelve siempre 0 (mock).

**Response 200:**
```json
{ "pin": 17, "value": 1 }
```

---

### POST /api/hardware/gpio/:pin

Escribe un valor en un pin GPIO.

**Body:**
```json
{ "value": 1 }
```

`value` debe ser 0 o 1.

**Response 200:**
```json
{ "success": true }
```

En no-Pi: `{ "success": true, "mock": true }`

---

### GET /api/hardware/gpio/:pin/pwm

Lee el duty cycle PWM actual del pin.

**Response 200:**
```json
{ "pin": 18, "duty_cycle": 0.75 }
```

Si el pin no ha sido configurado como PWM, devuelve 0.0.

---

### POST /api/hardware/gpio/:pin/pwm

Establece el duty cycle PWM en un pin (para LEDs dimmer, servos, ventiladores…).

**Body:**
```json
{ "duty_cycle": 0.75 }
```

`duty_cycle`: float entre 0.0 (apagado) y 1.0 (máxima potencia).

**Response 200:**
```json
{ "pin": 18, "duty_cycle": 0.75 }
```

En no-Pi: funciona sin errores (no hace nada físico).

---

### GET /api/hardware/i2c/:bus/:address/:register

Lee bytes de un dispositivo I2C.

**Path params:**
- `bus`: número de bus I2C (normalmente 1 en Raspberry Pi)
- `address`: dirección del dispositivo en decimal (e.g. 118 para BME280 en 0x76)
- `register`: registro a leer en decimal

**Query params:**
- `length` (int, default 1): número de bytes a leer

**Response 200:**
```json
{ "bus": 1, "address": 118, "register": 208, "data": [96] }
```

`data` es un array de enteros (bytes).

**Errores:** `500 I2C_ERROR` si el dispositivo no responde o el bus no está habilitado.

Requiere: `sudo raspi-config` → Interface Options → I2C

---

### GET /api/hardware/camera/snapshot

Captura un fotograma y lo devuelve como data URL base64.

**Response 200:**
```json
{ "image": "data:image/jpeg;base64,/9j/...", "mock": false }
```

**Errores:** `503 NO_CAMERA` si no hay cámara disponible.

Requiere: `picamera2` (`sudo apt install python3-picamera2`)

---

### GET /api/hardware/camera/stream

Stream MJPEG en tiempo real. Usar directamente como `src` de un elemento `<img>`.

**Media type:** `multipart/x-mixed-replace; boundary=frame`

**Uso:**
```html
<img src="/api/hardware/camera/stream">
```

Emite ~10 fps hasta que el cliente desconecta.

**Errores:** `503 NO_CAMERA` si no hay cámara disponible.

---

### WS /api/hardware/sensors/:id/stream

WebSocket que emite lecturas del sensor cada segundo.

**Conexión:**
```javascript
const ws = new WebSocket('ws://localhost:8000/api/hardware/sensors/1/stream')
ws.onmessage = (e) => {
  const data = JSON.parse(e.data)
  // { sensor_id: 1, timestamp: 1704067200.0, value: 22.5 }
}
```

En entornos no-Pi, el valor oscila sinusoidalmente alrededor de 20.0 (simulación).

---

## /api/sdk — Bridge para apps (iframes)

Estos endpoints son llamados internamente por el SDK ModevI.js desde dentro de los iframes. No están pensados para uso directo.

### GET /api/sdk/system/info

Devuelve la información del sistema. Sin auth.

---

### GET /api/sdk/app/:id/sdk.js

Devuelve el código JavaScript del SDK con el `installed_app_id` inyectado. Se incluye mediante `<script src="/api/sdk/app/ID/sdk.js">` en el HTML de la app.

---

### GET /api/sdk/app/:id/data

Lista todos los pares clave-valor de la app.

### GET /api/sdk/app/:id/data/:key

Lee un valor concreto.

### PUT /api/sdk/app/:id/data/:key

Guarda o actualiza un valor. **Body:** `{ "value": "string" }`

### DELETE /api/sdk/app/:id/data/:key

Elimina un par clave-valor.

---

### POST /api/sdk/app/:id/db/query

Ejecuta una consulta SELECT en la base de datos SQLite aislada de la app. La BD se crea automáticamente en el primer uso.

**Body:**
```json
{
  "sql": "SELECT * FROM lecturas WHERE sensor = ? ORDER BY ts DESC LIMIT 50",
  "params": ["temperatura"]
}
```

**Response 200:**
```json
{
  "rows": [
    { "id": 1, "ts": 1704067200000, "valor": 23.4, "sensor": "temperatura" }
  ]
}
```

`rows` es un array de objetos. Las columnas dependen del `SELECT`. Array vacío si no hay resultados.

**Errores:** `400 DB_ERROR` si el SQL es inválido.

---

### POST /api/sdk/app/:id/db/exec

Ejecuta un statement SQL de escritura (`INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `DROP TABLE`).

**Body:**
```json
{
  "sql": "INSERT INTO lecturas (ts, valor, sensor) VALUES (?, ?, ?)",
  "params": [1704067200000, 23.4, "temperatura"]
}
```

**Response 200:**
```json
{
  "changes": 1,
  "last_insert_id": 42
}
```

`changes`: número de filas afectadas. `last_insert_id`: ID del último INSERT (0 si no aplica).

**Errores:** `400 DB_ERROR` si el SQL es inválido.

---

### GET /api/sdk/hardware/sensors

Devuelve los sensores activos del dispositivo (para las apps).

### GET /api/sdk/hardware/gpio/:pin

Lee un pin GPIO desde una app.

### POST /api/sdk/hardware/gpio/:pin

Escribe un pin GPIO desde una app.

---

### GET /api/sdk/hardware/gpio/:pin/pwm

Lee el duty cycle PWM actual del pin desde una app.

**Response 200:** `{ "pin": 18, "duty_cycle": 0.75 }`

---

### POST /api/sdk/hardware/gpio/:pin/pwm

Establece el duty cycle PWM desde una app.

**Body:** `{ "duty_cycle": 0.0-1.0 }`

**Response 200:** `{ "pin": 18, "duty_cycle": 0.75 }`

---

### GET /api/sdk/hardware/i2c/:bus/:address/:register

Lee bytes I2C desde una app.

**Query param:** `length` (int, default 1)

**Response 200:** `{ "bus": 1, "address": 118, "register": 208, "data": [96] }`

---

### GET /api/sdk/hardware/camera/snapshot

Captura un fotograma desde una app.

**Response 200:** `{ "image": "data:image/jpeg;base64,..." }`

---

### GET /api/sdk/hardware/camera/stream

Stream MJPEG desde una app. Usar como `src` de un elemento `<img>`:

```html
<img src="/api/sdk/hardware/camera/stream">
```

---

## /api/sdk/libs — Mirror de librerías JS

### GET /api/sdk/libs

Lista todas las librerías disponibles en el mirror local.

**Response 200:**
```json
[
  {
    "name": "chart.js",
    "url": "/api/sdk/libs/chart.js",
    "description": "Chart.js 4.4 — gráficas (line, bar, pie, radar, doughnut...)"
  }
]
```

---

### GET /api/sdk/libs/:filename

Sirve el archivo JS con cabeceras de caché de 1 año (`Cache-Control: public, max-age=31536000, immutable`).

**Librerías disponibles:** `chart.js`, `three.js`, `alpine.js`, `anime.js`, `matter.js`, `tone.js`, `marked.js`

**Uso en HTML de app:**
```html
<script src="/api/sdk/libs/chart.js"></script>
```

**Errores:** `404` si la librería no existe en el catálogo.

---

## /api/notes — Notas

> **Autenticación requerida en todos los endpoints.** Cada usuario ve y gestiona solo sus propias notas.

### GET /api/notes

Lista las notas del usuario autenticado (primero las fijadas, luego por fecha de actualización desc).

**Auth:** Requerida

### POST /api/notes

Crea una nota para el usuario autenticado. **Body:** `{ "title": "Texto", "content": "...", "color": "default", "pinned": false }`

**Auth:** Requerida

### PUT /api/notes/:id

Actualiza parcialmente una nota propia.

**Auth:** Requerida

### DELETE /api/notes/:id

Elimina una nota propia.

**Auth:** Requerida

---

## /api/system — Información del sistema

### GET /api/system/info

Métricas del sistema operativo en tiempo real.

**Response 200:**
```json
{
  "hostname": "modevi-pi",
  "platform": "Linux",
  "cpu_percent": 12.4,
  "cpu_count": 4,
  "ram_percent": 45.2,
  "ram_total": 16.0,
  "ram_used": 7.2,
  "disk_percent": 23.1,
  "disk_total": 120.0,
  "disk_used": 27.7,
  "temperature": 52.3,
  "uptime_seconds": 86400
}
```

`temperature` puede ser `null` en entornos no-Pi.

---

### GET /api/system/stats

Estadísticas de la plataforma.

**Response 200:**
```json
{
  "total_store_apps": 4,
  "installed_apps": 2,
  "active_app": "clock",
  "recent_activity": [...]
}
```

---

## /api/ai — IA para apps

> **Nota SSE:** Todos los endpoints SSE deben consumirse con `fetch + ReadableStream` y el header `Accept: text/event-stream`, **no** con `EventSource`. Esto permite obtener el código HTTP de error real (401, 500…) en caso de fallo.

### GET /api/ai/create-app

Genera una app HTML completa usando Claude claude-opus-4-6 y la publica en la tienda automáticamente. Devuelve **Server-Sent Events (SSE)**.

**Servidor:** Railway (`STORE_BASE`)
**Auth:** JWT en query param (limitación: SSE no soporta headers custom)

**Query params:**
| Param | Tipo | Descripción |
|---|---|---|
| `name` | string | Nombre de la app |
| `description` | string | Descripción / prompt de generación |
| `category_id` | int? | ID de categoría (opcional) |
| `token` | string | JWT de acceso |

**Rol requerido:** `developer` o `admin`

**Eventos SSE:**
```
data: {"type": "status",     "step": "connecting",  "message": "..."}
data: {"type": "status",     "step": "generating",  "message": "..."}
data: {"type": "code_chunk", "text": "<chunk>"}       ← stream HTML en tiempo real
data: {"type": "status",     "step": "describing",  "message": "..."}
data: {"type": "status",     "step": "packaging",   "message": "..."}
data: {"type": "status",     "step": "registering", "message": "..."}
data: {"type": "done",       "app_id": 42, "installed_id": 7, "app_slug": "mi-app", "message": "..."}
data: {"type": "error",      "message": "Descripción del error"}
```

**Comportamiento:**
- La descripción se genera automáticamente con `claude-haiku-4-5` a partir del nombre y el prompt
- El prompt original se almacena en `store_apps.ai_prompt` (visible en la página de detalle)
- La app se publica con `status=published` directamente (sin revisión)
- La app se instala automáticamente en el dispositivo al completar

---

### GET /api/ai/debug-app

Mejora una app ya instalada en el dispositivo aplicando el feedback del usuario. Devuelve **SSE**.

**Servidor:** Pi (`DEVICE_BASE`) — necesita acceso al sistema de archivos local
**Auth:** JWT en query param

**Query params:**
| Param | Tipo | Descripción |
|---|---|---|
| `installed_id` | int | ID de la app instalada (de `InstalledApp.id`) |
| `feedback` | string (min 5) | Descripción de cambios/bugs a corregir |
| `token` | string | JWT de acceso |

**Rol requerido:** `developer` o `admin`

**Eventos SSE:**
```
data: {"type": "status",     "step": "connecting",  "message": "..."}
data: {"type": "status",     "step": "generating",  "message": "..."}
data: {"type": "code_chunk", "text": "<chunk>"}       ← stream HTML en tiempo real
data: {"type": "status",     "step": "packaging",   "message": "..."}
data: {"type": "done",       "app_id": 42, "installed_id": 7, "app_slug": "mi-app", "message": "..."}
data: {"type": "error",      "message": "Descripción del error"}
```

**Comportamiento:**
- Lee el `index.html` actual de `backend/installed/{installed_id}/`
- Regenera el HTML completo con Claude aplicando el feedback
- **Solo modifica el archivo local de la Pi** — la app original en la store queda intacta
- Registra la acción en `ActivityLog`

---

### POST /api/ai/publish-improved

Publica la versión actual de una app instalada como **nueva entrada** en la tienda. No modifica la app original.

**Servidor:** Railway (`STORE_BASE`)
**Auth:** `Authorization: Bearer <token>`

**Body JSON:**
```json
{
  "installed_id": 7,
  "name": "Nombre de la nueva app",
  "description": "Descripción para la tienda",
  "category_id": 3
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `installed_id` | int | ID de la app instalada cuyo HTML se publicará |
| `name` | string | Nombre de la nueva entrada en la tienda |
| `description` | string | Descripción para la tienda |
| `category_id` | int? | ID de categoría (opcional) |

**Respuesta 200:**
```json
{
  "app_id": 43,
  "slug": "nombre-de-la-nueva-app",
  "message": "App «Nombre» publicada en la tienda."
}
```

**Comportamiento:**
- Lee el `index.html` actual del dispositivo (`backend/installed/{installed_id}/`)
- Crea un ZIP con el HTML y un `manifest.json` autogenerado
- Sube el ZIP a Cloudflare R2
- Crea una nueva `StoreApp` en MySQL con `status=published`
- La app original no se modifica
