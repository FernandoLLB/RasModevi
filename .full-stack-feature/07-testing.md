# Testing & Validation: ModevI

## Seguridad — Hallazgos (auditado por security-auditor agent)

### CRÍTICOS (4)
| ID | Dónde | Problema |
|----|-------|---------|
| C1 | `backend/auth.py:21` | JWT secret hardcodeado en el repo como fallback |
| C2 | `backend/seed.py` | Contraseñas semilla triviales: admin123, dev123 |
| C3 | `backend/routers/auth.py:34` | El registro acepta `"role":"admin"` — cualquiera puede ser admin |
| C4 | `backend/routers/device.py:88` | ZIP extraction sin protección Zip Slip (path traversal) |

### ALTOS (8)
- H1: CORS `allow_origins=["*"]` — cualquier web puede llamar la API con token
- H2: Endpoints de hardware/GPIO sin autenticación (cualquiera puede leer/escribir GPIO)
- H3: Endpoints de device (install/uninstall/activate) sin autenticación
- H4: Sin validación de número de pin GPIO — podrían tocarse pines del sistema
- H5: SDK endpoints sin autorización a nivel de app (App A puede leer datos de App B)
- H6: JWT en localStorage — vulnerable a XSS desde iframes con allow-same-origin
- H7: `sandbox="allow-scripts allow-same-origin"` niega el sandbox (iframes pueden leer localStorage del host)
- H8: postMessage sin validación de origin (`'*'` como targetOrigin)

### MEDIOS (9)
- M1/M2: Sin rate limiting en ningún endpoint
- M3: Sin protección contra zip bombs en uploads
- M5: `serve_frontend` catch-all puede servir archivos fuera de dist/ (`../backend/modevi.db`)
- M6: Refresh tokens no se invalidan al usarse
- M7: `/api/sdk/system/info` expone info del sistema sin auth
- M8: WebSocket sin autenticación
- M9: `python-jose` desmantenido (CVEs conocidos)

---

## Performance — Hallazgos (auditado por performance-engineer agent)

### Críticos para Raspberry Pi 5

| Prioridad | Dónde | Problema | Impacto |
|-----------|-------|---------|---------|
| 1 | `sdk.py`, `system.py` | `psutil.cpu_percent(interval=0.2/0.5)` bloquea el event loop 200-500ms en cada llamada | Alto — stalls visibles |
| 2 | `App.jsx` | Sin code splitting — 294KB JS cargado entero al arrancar Chromium | Alto — tiempo inicial |
| 3 | `device.py:88` | `zipfile.extractall()` síncrono dentro de `async def` — bloquea event loop | Alto — en instalación |
| 4 | `StorePage.jsx` | Búsqueda lanza API en cada tecla sin debounce | Alto — UX |
| 5 | `database.py` | SQLite sin WAL mode ni busy timeout — bloqueos bajo concurrencia | Medio-alto |
| 6 | `DeviceContext.jsx` | Value object recrea referencia en cada render — re-renders innecesarios | Medio |
| 7 | `InstallButton.jsx` | `installedApps.find()` lineal en cada render (20 búsquedas por poll) | Medio |
| 8 | `DeviceContext.jsx` | Polling cada 5s sin pausa en visibilitychange ni guard de overlap | Medio |
| 9 | `main.py` | Sin headers de cache en assets — Chromium re-valida cada recarga | Medio |
| 10 | `AppRunnerPage.jsx` | SDK `<script>` inyectado en host page, no en el iframe — bug funcional | Bug |

### Tres cambios inmediatos recomendados
1. `psutil.cpu_percent(interval=None)` + cache background task
2. SQLite WAL mode en `database.py`
3. Debounce 300ms en búsqueda + lazy loading de rutas /developer y /login

---

## Action Items (prioritizados para TFG)

### Imprescindibles antes de demo
1. **C3 — Role elevation**: En `auth.py` cambiar `role=body.role` → `role="user"` y solo permitir developer en registro explícito
2. **C4 — Zip Slip**: Añadir validación de paths antes de `extractall` en `device.py`
3. **M5 — Path traversal frontend**: Validar que `file_path.resolve()` esté dentro de `FRONTEND_DIR`
4. **Performance psutil**: Cambiar `interval=0.2` a `interval=None`

### Mejoras de calidad (nice to have para TFG)
- Debounce en búsqueda
- SQLite WAL mode
- Code splitting básico (rutas developer)
- Validación `EmailStr` en schemas
