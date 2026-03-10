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
  ]
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

### GET /api/device/apps

Lista todas las apps instaladas en este dispositivo, con datos de la app de la tienda.

**Auth:** No requerida

**Response 200:**
```json
[
  {
    "id": 1,
    "store_app_id": 2,
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

Devuelve la app activa actualmente, o `null` si ninguna está activa.

---

### POST /api/device/apps/:store_app_id/install

Instala una app desde la tienda. Extrae el ZIP en `backend/installed/<id>/`. Incrementa `downloads_count`.

**Errores:** `404 APP_NOT_FOUND`, `409 ALREADY_INSTALLED`

**Response 201:** InstalledApp creada.

---

### POST /api/device/apps/:installed_id/uninstall

Desinstala una app. Elimina los archivos extraídos y el registro de la base de datos.

**Response 204**

---

### POST /api/device/apps/:installed_id/activate

Activa una app (desactiva las demás). Registra en el log de actividad.

**Response 200:** InstalledApp actualizada con `is_active: true`.

---

### POST /api/device/apps/:installed_id/deactivate

Desactiva la app.

**Response 204**

---

### POST /api/device/apps/:installed_id/launch

Registra que la app fue lanzada. Incrementa `launch_count` y actualiza `last_launched`.

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

### GET /api/sdk/hardware/sensors

Devuelve los sensores activos del dispositivo (para las apps).

### GET /api/sdk/hardware/gpio/:pin

Lee un pin GPIO desde una app.

### POST /api/sdk/hardware/gpio/:pin

Escribe un pin GPIO desde una app.

---

## /api/notes — Notas

### GET /api/notes

Lista todas las notas (primero las fijadas, luego por fecha de actualización desc).

### POST /api/notes

Crea una nota. **Body:** `{ "title": "Texto", "content": "...", "color": "default", "pinned": false }`

### PUT /api/notes/:id

Actualiza parcialmente una nota.

### DELETE /api/notes/:id

Elimina una nota.

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
