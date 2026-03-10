# Requirements: ModevI — Plataforma Modular para Raspberry Pi 5

## Problem Statement

ModevI es un TFG con dos partes integradas:

1. **Plataforma comunitaria (tienda online)**: Portal web donde developers publican apps open source gratuitas para el ecosistema ModevI. Los developers suben paquetes ZIP con su app y metadata; los usuarios pueden explorarlas, valorarlas y descargarlas.

2. **Experiencia de dispositivo**: Raspberry Pi 5 conectada a una pantalla táctil Raspberry Display 2 (7"). El dispositivo arranca directamente en la store de ModevI — sin escritorio Linux visible — como si fuera una tablet tipo iPad. El usuario instala apps desde la tienda, las lanza, y puede filtrar por hardware compatible (ej: "apps que usan sensor de humedad").

El atractivo principal del producto es que el usuario puede comprar sensores/periféricos para su Pi, buscar en la store apps compatibles con ese hardware, instalarlas y usarlas — todo sin tocar el sistema operativo.

## Acceptance Criteria

- [ ] El dispositivo arranca en modo kiosk directamente en la store de ModevI (sin escritorio)
- [ ] Los usuarios pueden explorar apps por categoría, hardware requerido y búsqueda de texto
- [ ] Los usuarios pueden instalar, desinstalar y lanzar apps desde la store
- [ ] Las apps instaladas se ejecutan en iframe sandboxed con acceso al SDK de ModevI
- [ ] El SDK de ModevI expone: hardware GPIO/sensores, base de datos por app, info del sistema
- [ ] Los developers pueden registrarse, subir apps (ZIP + manifest.json), y gestionar sus publicaciones
- [ ] Existe autenticación JWT con roles: `user`, `developer`, `admin`
- [ ] Cada app tiene: nombre, descripción, icono, categoría, versión, hardware_requerido, valoraciones
- [ ] Los usuarios pueden valorar y comentar apps (1-5 estrellas)
- [ ] La interfaz del dispositivo es profesional, táctil-friendly, tipo App Store / iPad
- [ ] Las apps pueden acceder a hardware via SDK (GPIO, sensores I2C/SPI), a base de datos propia, y a APIs externas

## Scope

### In Scope

- Portal web de la tienda (store) con búsqueda, categorías, filtros por hardware
- Portal de developers (upload, edición de metadata, mis apps publicadas)
- Autenticación y autorización (registro, login, roles)
- Sistema de valoraciones y comentarios de apps
- Ejecución de apps en iframe sandboxed con SDK ModevI.js
- SDK ModevI.js con módulos: `system`, `hardware`, `db`, `notify`
- API de hardware: lectura/escritura GPIO, sensores via backend Python (gpiozero)
- Base de datos por app (SQLite namespaced por app_id)
- Manifest.json estándar para declarar metadata, permisos y hardware requerido
- Launcher/home screen del dispositivo (apps instaladas, búsqueda rápida)
- Sistema de actividad / logs de instalación
- Scripts de inicio (kiosk, start)

### Out of Scope

- Pagos o monetización de cualquier tipo (todo gratis, open source)
- App nativa iOS/Android
- Moderación manual de apps antes de publicarlas
- Infraestructura cloud real con dominio público, CDN, SSL en producción
- Sandbox de seguridad avanzado (cgroups, namespaces) — iframe básico es suficiente para el TFG
- Acceso a cámara/audio/Bluetooth desde el SDK (GPIO + I2C/SPI es suficiente)

## Technical Constraints

- El backend debe correr en Raspberry Pi 5 (ARM64, Python 3.13)
- Hardware GPIO via Python: usar `gpiozero` (más moderno que RPi.GPIO)
- Sin Docker obligatorio: el proyecto debe correr con comandos simples en la Pi
- Las apps son paquetes ZIP con `manifest.json` + frontend compilado (cualquier framework)
- El SDK ModevI.js se inyecta automáticamente en el iframe de cada app instalada
- Comunicación SDK ↔ Backend via postMessage (iframe) → fetch API → FastAPI

## Technology Stack

### Backend
- **Framework**: FastAPI 0.135+ con Python 3.13
- **ORM**: SQLAlchemy 2.0 (modelos existentes a extender)
- **Base de datos**: SQLite (via SQLAlchemy) — suficiente para TFG
- **Auth**: JWT con `python-jose[cryptography]` + `passlib[bcrypt]`
- **File uploads**: `python-multipart` (ya instalado) + almacenamiento local en `backend/store/`
- **Hardware**: `gpiozero` para GPIO, soporte I2C/SPI via `smbus2`
- **Sistema**: `psutil` (ya instalado)
- **WebSocket**: FastAPI native (para datos de sensores en tiempo real)

### Frontend
- **Framework**: React 19 + Vite 7 (existente)
- **Estilos**: TailwindCSS 4 (existente) — mantener
- **Routing**: React Router v7 (añadir)
- **Icons**: lucide-react (existente)
- **Estado global**: Context API + useReducer (sin Redux, KISS)
- **HTTP client**: fetch nativo (sin axios para simplificar)

### SDK
- **ModevI.js**: Vanilla JS, inyectado en `<head>` de cada app
- **Comunicación**: postMessage con el host (origen ModevI) → REST API
- **Módulos**: `ModevI.system`, `ModevI.hardware`, `ModevI.db`, `ModevI.notify`

### Infraestructura
- Un solo servidor FastAPI en `0.0.0.0:8000`
- Chromium en modo kiosk apuntando a `http://localhost:8000`
- Apps instaladas en `backend/installed/{app_id}/` (ZIP extraído)
- Paquetes en `backend/store/packages/{app_id}/` (ZIP original)
- Iconos en `backend/store/icons/`

## Dependencies

- No depende de servicios externos; todo corre en la Pi
- Compatible con Raspberry Pi 5, Raspberry Pi OS (Bookworm, 64-bit)
- Las apps pueden llamar APIs externas directamente desde el navegador (sin restricción adicional)

## Configuration

- Stack: FastAPI + React + SQLite + TailwindCSS + React Router
- API Style: REST (con WebSocket para sensores en tiempo real)
- Complexity: complex
- Auth: JWT con roles user/developer/admin
- App format: ZIP (manifest.json + index.html + assets)
- Hardware: GPIO via gpiozero, sensores I2C via smbus2
