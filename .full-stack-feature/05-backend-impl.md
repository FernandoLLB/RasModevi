# Backend Implementation: ModevI

## Files Created/Modified

### New files
- `backend/auth.py` — JWT utilities + FastAPI dependencies (get_current_user, require_developer, require_admin)
- `backend/schemas.py` — Pydantic v2 schemas para auth, store, device, hardware, system
- `backend/modevi_sdk.py` — ModevI.js SDK como string constant de Python
- `backend/routers/auth.py` — register, login, me, refresh
- `backend/routers/store.py` — listado público con filtros, detalle, categorías, hardware tags, ratings
- `backend/routers/developer.py` — CRUD apps + upload ZIP con validación manifest
- `backend/routers/admin.py` — aprobar/rechazar apps
- `backend/routers/device.py` — install/uninstall/activate/deactivate/launch
- `backend/routers/sdk.py` — bridge endpoints para iframes + sirve sdk.js dinámico
- `backend/routers/hardware.py` — sensor CRUD + GPIO read/write + WebSocket streaming

### Modified files
- `backend/main.py` — reescrito: 9 routers registrados, lifespan con init_db+seed+dirs, static mounts
- `backend/routers/system.py` — corregido: usa InstalledApp/ActivityLog en vez de modelos viejos
- `backend/requirements.txt` — añadidos python-jose[cryptography]==3.3.0, passlib[bcrypt]==1.7.4

## API Surface (48 endpoints + 1 WebSocket)

- `/api/auth` — 4 endpoints (register, login, me, refresh)
- `/api/store` — 7 endpoints (apps list/detail, categories, hardware_tags, ratings CRUD)
- `/api/developer` — 5 endpoints (CRUD + ZIP upload)
- `/api/admin` — 3 endpoints (list all, approve, reject)
- `/api/device` — 7 endpoints (list, active, install, uninstall, activate, deactivate, launch)
- `/api/sdk` — 8 endpoints + sirve sdk.js (data CRUD, system info, GPIO, sensors)
- `/api/hardware` — 6 endpoints + 1 WebSocket (sensor CRUD, GPIO, stream)
- `/api/notes` — 4 endpoints (existente)
- `/api/system` — 2 endpoints (existente, corregido)

## Key Features
- GPIO gpiozero con fallback mock para desarrollo en no-Pi
- ZIP upload: validación manifest.json, límite 50MB, extracción de icono
- JWT: access 30min + refresh 7días
- Roles: user/developer/admin con FastAPI dependencies
- ModevI.js SDK servido dinámicamente con app_id inyectado
- WebSocket para streaming de sensores en tiempo real
