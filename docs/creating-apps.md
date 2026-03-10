# Guía para crear apps en ModevI

Esta guía explica cómo crear, probar y publicar una app para la plataforma ModevI.

---

## Qué es una app de ModevI

Una app de ModevI es cualquier aplicación web (HTML + CSS + JavaScript) que se ejecuta dentro de un iframe en la pantalla táctil de la Raspberry Pi. La app puede:

- Usar cualquier framework web (React, Vue, vanilla JS, Svelte…)
- Acceder al hardware de la Pi mediante el SDK de ModevI
- Almacenar datos propios sin interferir con otras apps
- Llamar a APIs externas directamente desde el navegador

---

## Estructura mínima

```
mi-app/
├── manifest.json    ← Metadatos obligatorios
└── index.html       ← Punto de entrada
```

### manifest.json

```json
{
  "name": "Nombre de la App",
  "version": "1.0.0",
  "description": "Descripción breve visible en la tienda (máx. 500 caracteres)",
  "entry_point": "index.html",
  "required_hardware": [],
  "permissions": [],
  "icon": "icon.png"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `name` | string | ✅ | Nombre público de la app |
| `version` | string | ✅ | Versión semántica (e.g. `1.2.0`) |
| `description` | string | ✅ | Descripción corta (máx. 500 chars) |
| `entry_point` | string | ✅ | Archivo HTML de entrada (relativo al ZIP) |
| `required_hardware` | array | — | Hardware necesario (ver tabla abajo) |
| `permissions` | array | — | Permisos SDK requeridos |
| `icon` | string | — | Ruta al icono dentro del ZIP (PNG/SVG, ideal 256×256) |

**Valores válidos para `required_hardware`:**

| Valor | Descripción |
|-------|-------------|
| `gpio` | Acceso general a pines GPIO |
| `i2c` | Bus I2C |
| `spi` | Bus SPI |
| `dht22` | Sensor de temperatura/humedad DHT22 |
| `bmp280` | Sensor de presión/temperatura BMP280 |
| `hc-sr04` | Sensor de distancia ultrasónico |
| `camera` | Cámara de la Raspberry Pi |
| `oled` | Display OLED |
| `neopixel` | LEDs NeoPixel/WS2812 |

**Valores válidos para `permissions`:**

| Valor | Acceso concedido |
|-------|-----------------|
| `db` | Base de datos propia de la app |
| `sensors` | Lectura de sensores registrados |
| `gpio` | Lectura y escritura de pines GPIO |
| `network` | Llamadas a APIs externas de internet |

---

## Usar el SDK ModevI.js

Añade el script al `<head>` de tu `index.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi App</title>
  <!-- El SDK se carga automáticamente al instalar la app.
       Durante desarrollo local puedes usar: -->
  <script src="/api/sdk/app/APP_ID/sdk.js"></script>
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>
```

> **Nota:** Al instalar la app desde la tienda, el backend inyecta el SDK con el `app_id` correcto. Durante el desarrollo en local puedes apuntar al endpoint del SDK con el ID de la app instalada.

### API del SDK

#### `ModevI.system`

```javascript
// Información del sistema operativo y hardware
const info = await ModevI.system.getInfo()
console.log(info)
/*
{
  hostname: "modevi-pi",
  platform: "Linux",
  cpu_percent: 12.4,
  cpu_count: 4,
  ram_percent: 45.2,
  ram_total: 16.0,
  ram_used: 7.2,
  disk_percent: 23.1,
  disk_total: 120.0,
  disk_used: 27.7,
  temperature: 52.3,   // null en no-Pi
  uptime_seconds: 86400
}
*/
```

#### `ModevI.db`

Almacenamiento clave-valor privado de tu app. Los datos persisten entre sesiones y son independientes de los de otras apps.

```javascript
// Guardar
await ModevI.db.set('usuario', 'Fernando')
await ModevI.db.set('config', JSON.stringify({ modo: 'oscuro', volumen: 80 }))

// Leer
const nombre = await ModevI.db.get('usuario')   // "Fernando"
const raw    = await ModevI.db.get('config')     // string JSON
const config = JSON.parse(raw)

// Eliminar
await ModevI.db.delete('usuario')

// Listar todos los pares
const todos = await ModevI.db.list()
// → [{ key: "config", value: "{...}", updated_at: "..." }]

// Listar con prefijo
const preferencias = await ModevI.db.list('pref_')
```

#### `ModevI.hardware`

```javascript
// Sensores registrados en el dispositivo
const sensores = await ModevI.hardware.getSensors()
/*
[
  {
    id: 1,
    name: "Sensor exterior",
    sensor_type: "DHT22",
    interface: "gpio",
    pin_or_address: "4",
    is_active: true
  }
]
*/

// Leer pin GPIO (devuelve 0 o 1)
const { pin, value } = await ModevI.hardware.readGPIO(17)
if (value === 1) console.log('Botón presionado')

// Escribir pin GPIO
await ModevI.hardware.writeGPIO(27, 1)  // encender
await ModevI.hardware.writeGPIO(27, 0)  // apagar

// Stream de sensor en tiempo real
const stopStream = ModevI.hardware.streamSensor(sensorId, (data) => {
  console.log(`Valor: ${data.value} a las ${new Date(data.timestamp * 1000).toLocaleTimeString()}`)
})
// Para detener el stream:
stopStream()
```

#### `ModevI.notify`

```javascript
// Toast de información (desaparece solo)
ModevI.notify.toast('Configuración guardada')
ModevI.notify.toast('Operación completada', 'success')
ModevI.notify.toast('No se pudo conectar', 'error')
ModevI.notify.toast('Batería baja', 'warning')
```

---

## Ejemplo: app de temperatura con DHT22

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Temperatura DHT22</title>
  <script src="/api/sdk/app/APP_ID/sdk.js"></script>
  <style>
    body { font-family: sans-serif; background: #0a0a0f; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 40px; text-align: center; }
    .value { font-size: 72px; font-weight: bold; color: #10b981; }
    .unit { font-size: 24px; color: rgba(255,255,255,0.5); }
    .label { font-size: 14px; color: rgba(255,255,255,0.4); margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="value" id="temp">--</div>
    <div class="unit">°C</div>
    <div class="label" id="sensor-name">Buscando sensor...</div>
  </div>

  <script>
    async function init() {
      const sensores = await ModevI.hardware.getSensors()
      const dht = sensores.find(s => s.sensor_type === 'DHT22')

      if (!dht) {
        document.getElementById('sensor-name').textContent = 'Sin sensor DHT22 registrado'
        return
      }

      document.getElementById('sensor-name').textContent = dht.name

      ModevI.hardware.streamSensor(dht.id, (data) => {
        document.getElementById('temp').textContent = data.value.toFixed(1)
      })
    }

    init().catch(console.error)
  </script>
</body>
</html>
```

**manifest.json:**
```json
{
  "name": "Temperatura DHT22",
  "version": "1.0.0",
  "description": "Muestra la temperatura y humedad del sensor DHT22 en tiempo real.",
  "entry_point": "index.html",
  "required_hardware": ["dht22", "gpio"],
  "permissions": ["sensors"],
  "icon": "icon.png"
}
```

---

## Empaquetar y publicar

### 1. Crear el ZIP

```bash
# Desde la carpeta de tu app:
zip -r mi-app.zip manifest.json index.html assets/

# o para incluir todo el directorio:
zip -r mi-app.zip .
```

El ZIP no debe superar **50 MB**.

### 2. Crear cuenta de developer

Accede a `http://localhost:8000/register` y selecciona el tipo de cuenta **Developer**.

### 3. Publicar desde el portal

1. Ir a `http://localhost:8000/developer`
2. Pulsar **Nueva app**
3. Rellenar nombre, descripción, categoría y versión
4. Subir el ZIP en el siguiente paso
5. La app queda en estado **Pendiente** hasta que un admin la apruebe

### 4. Aprobar (rol admin)

Con las credenciales de admin, acceder a `http://localhost:8000/docs` → `/api/admin/apps/:id/approve`.

---

## Acceso a APIs externas

Las apps pueden llamar a cualquier API externa directamente desde el código JavaScript:

```javascript
// Ejemplo: obtener tiempo de OpenWeatherMap
const resp = await fetch('https://api.openweathermap.org/data/2.5/weather?q=Madrid&appid=TU_API_KEY')
const data = await resp.json()
console.log(data.main.temp)
```

No se necesita ninguna configuración especial; el iframe tiene acceso a internet siempre que el dispositivo esté conectado.

---

## Apps con framework (React, Vue…)

Puedes usar cualquier framework que compile a HTML/JS estático.

**Ejemplo con Vite + React:**

```bash
npm create vite@latest mi-app -- --template react
cd mi-app
npm install
npm run build
# Copiar dist/ como raíz del ZIP + manifest.json
cp manifest.json dist/
cd dist && zip -r ../../mi-app.zip .
```

El `entry_point` en `manifest.json` debe apuntar al `index.html` del build (normalmente en la raíz del ZIP).

---

## Limitaciones del sandbox

Las apps se ejecutan en un `<iframe>` con el atributo:
```html
sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
```

Esto significa:
- ✅ JavaScript habilitado
- ✅ Llamadas fetch/XHR (misma origen y externas)
- ✅ Formularios
- ✅ Ventanas emergentes (popups)
- ❌ Acceso directo al DOM del host
- ❌ `localStorage`/`sessionStorage` del dominio principal (usar `ModevI.db` en su lugar)
- ❌ Service Workers
- ❌ `allow-top-navigation` (no puede redirigir la página principal)
