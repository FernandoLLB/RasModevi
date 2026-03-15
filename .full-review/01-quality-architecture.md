# Phase 1: Code Quality & Architecture Review

## Code Quality Findings

### Critical

| ID | Issue | File | Lines |
|----|-------|------|-------|
| C-01 | **SQL Injection in SDK DB endpoints** — `sdk_db_query`/`sdk_db_exec` accept arbitrary SQL without validation. `ATTACH DATABASE` or `load_extension()` could access filesystem or execute code. | `backend/routers/sdk.py` | 223-258 |
| C-02 | **Unauthenticated hardware endpoints** — All GPIO/PWM/I2C/camera endpoints at `/api/hardware/*` have no auth. Pi is internet-accessible via `pi.modevi.es`. | `backend/routers/hardware.py` | 80-174 |
| C-03 | **ZIP Slip path traversal** — `zf.extractall()` without checking for `../../` entries in uploaded ZIPs. Malicious ZIP could write files outside install directory. | `backend/routers/device.py` | 241 |
| C-04 | **CORS allows all origins** — `allow_origins=["*"]` on both entry points. Combined with unauthenticated SDK/hardware endpoints, any website can control hardware. | `backend/main.py`, `backend/main_store.py` | 137-142, 80-85 |

### High

| ID | Issue | File | Lines |
|----|-------|------|-------|
| H-01 | **Admin role self-assignment** — `UserCreate` schema accepts `role="admin"`. Any registering user can become admin. | `backend/schemas.py`, `backend/routers/auth.py` | 15-27, 24-51 |
| H-02 | **JWT in URL query params** — `create-app`/`debug-app` SSE endpoints accept JWT via `?token=`. Tokens leak in logs, history, Cloudflare edge. Frontend already uses `fetch` (not EventSource). | `backend/routers/ai.py` | 1363-1401, 1735-1772 |
| H-03 | **Deprecated `datetime.utcnow()`** — Used throughout models and auth. Deprecated since Python 3.12, produces naive datetimes. | `backend/models_*.py`, `backend/auth.py` | Multiple |
| H-04 | **GPIO `Button()` leak** — `gpio_read()` creates new `Button` object per call without caching (unlike `gpio_write`/`pwm_set`). Will cause "pin already in use" errors. | `backend/hw.py` | 28-32 |
| H-05 | **Deprecated `asyncio.get_event_loop()`** — Used in hw.py camera operations. Deprecated since Python 3.10. | `backend/hw.py` | 127-128, 140-141 |

### Medium

| ID | Issue | File | Lines |
|----|-------|------|-------|
| M-01 | **Massive code duplication in ai.py** — `_stream` (266 lines) and `_stream_debug` (125 lines) share nearly identical SSE formatting, HTML validation, SDK replacement. SDK fix logic duplicated a third time in `device.py`. | `backend/routers/ai.py`, `backend/routers/device.py` | Multiple |
| M-02 | **`_slugify` duplicated 3 times** — Same function in `developer.py` and `ai.py` (twice). Slug uniqueness loop also duplicated. | `backend/routers/developer.py`, `backend/routers/ai.py` | 29-32, 953-956 |
| M-03 | **R2 client created per-request** — `_client()` creates new boto3 S3 client on every upload/delete. Extra TCP+SSL overhead. | `backend/r2.py` | 13-33 |
| M-04 | **`_enrich()` has write side-effects** — GET endpoint triggers database writes (caching `local_name`/`local_icon_url`) inside a read-only enrichment function. | `backend/routers/device.py` | 51-139 |
| M-05 | **AICreatePage.jsx is 700+ lines** — 25+ state variables, three distinct concerns (create, improve, publish) in one component. | `frontend/src/pages/AICreatePage.jsx` | Entire file |
| M-06 | **Hardcoded category IDs** — `UploadWizard.jsx` has `{ 'Utilidades': 1, 'Multimedia': 2, ... }` instead of fetching from API. | `frontend/src/components/developer/UploadWizard.jsx` | 8 |
| M-07 | **`seed.py` calls `init_db()` redundantly** — `main.py` lifespan already calls `init_db()` before `seed()`. | `backend/seed.py` | 117 |
| M-08 | **`cpu_percent()` blocks event loop** — `psutil.cpu_percent(interval=0.5)` is synchronous blocking in async handlers. Blocks all requests for 200-500ms. | `backend/routers/system.py`, `backend/routers/sdk.py` | 36, 118 |
| M-09 | **Missing useEffect dependency** — `load` function not in deps array in AppDetailPage. | `frontend/src/pages/AppDetailPage.jsx` | 25 |
| M-10 | **Typo: `deleteSesor`** — Missing 'n' in function name. | `frontend/src/pages/SettingsPage.jsx` | 41 |
| M-11 | **`require_developer` is a no-op** — Returns any authenticated user, role check commented out. Contradicts three-tier model. | `backend/auth.py` | 113-115 |
| M-12 | **No route guards for authenticated pages** — Developer, AI, settings pages accessible without auth. Pages show layout chrome before prompting login. | `frontend/src/App.jsx` | Routes |

### Low

| ID | Issue | File |
|----|-------|------|
| L-01 | **Inconsistent error response format** — Some routers use `{"detail": "string"}`, others use nested `{"detail": {"detail": "msg", "code": "CODE"}}`. | Multiple |
| L-02 | **`notes.py` uses sync handlers** — All other routers use `async def`. | `backend/routers/notes.py` |
| L-03 | **Inline Pydantic models in notes.py** — `NoteCreate`/`NoteUpdate` not in `schemas.py`. | `backend/routers/notes.py` |
| L-04 | **Dockerfile uses Python 3.11 but target is 3.13** — Version mismatch Railway vs Pi. | `Dockerfile` |
| L-05 | **`kiosk.sh` health check uses stale endpoint** — `/api/apps/` doesn't exist; should use `/api/store/categories`. | `scripts/kiosk.sh` |
| L-06 | **DeviceContext polls every 5s unconditionally** — Even on pages that don't show installed apps, wastes bandwidth. | `frontend/src/context/DeviceContext.jsx` |
| L-07 | **`download_libs.sh` missing jszip.js** — SDK lists 8 libs but script downloads 7. | `scripts/download_libs.sh` |
| L-08 | **PublishModal bypasses apiFetch** — Direct `fetch()` instead of centralized client. Misses 401 auto-refresh. | `frontend/src/components/PublishModal.jsx` |
| L-09 | **SettingsPage displays RAM in wrong units** — API returns bytes, page displays as-is with "GB" suffix. Field names also mismatch (`memory_*` vs `ram_*`). | `frontend/src/pages/SettingsPage.jsx` |
| L-10 | **AppRunnerPage toast reads wrong property** — `e.data.kind` vs `e.data.detail.type`. Toasts never show correct message. | `frontend/src/pages/AppRunnerPage.jsx` |
| L-11 | **System info endpoints return different schemas** — `/api/system/info` and `/api/sdk/system/info` have different field names. | `backend/routers/system.py`, `backend/routers/sdk.py` |

## Architecture Findings

### Critical

| ID | Issue | Impact |
|----|-------|--------|
| A-C1 | **SDK endpoints completely unauthenticated** — All data, SQL, and hardware SDK endpoints have no auth. Anyone reaching `pi.modevi.es` can exec SQL, toggle GPIO, access camera. | Remote hardware control, data exfiltration, arbitrary SQL execution |

### High

| ID | Issue | Impact |
|----|-------|--------|
| A-H1 | **CORS fully open + unauthenticated endpoints** — Any website can make cross-origin requests to Pi API and control hardware. | Cross-site hardware manipulation |
| A-H2 | **Self-assignable admin role at registration** — When registration is re-enabled, any user can create admin account. | Full privilege escalation |
| A-H3 | **require_developer is no-op** — Any authenticated user can access developer endpoints. Role system partially ineffective. | Unauthorized app creation/upload |

### Medium

| ID | Issue | Impact |
|----|-------|--------|
| A-M1 | **Two entry points with duplicated startup logic** — `main.py` and `main_store.py` both contain migration logic, CORS config, frontend serving. | Schema changes must be manually synced in both files |
| A-M2 | **ai.py is monolithic (1773 lines)** — Contains prompts, SSE pipeline, packaging, installation, store registration, icon generation. | Hard to test, modify, or reuse any piece independently |
| A-M3 | **Duplicated SDK tag replacement (3 locations)** — Same logic in `device.py`, `ai.py` create, `ai.py` debug with minor variations. | Bug fixes may not propagate to all locations |
| A-M4 | **Duplicated hardware endpoints** — `hardware.py` and `sdk.py` implement identical GPIO/PWM/I2C/camera endpoints with different prefixes. | Changes must be applied twice |
| A-M5 | **Cross-DB references without referential integrity** — `InstalledApp.store_app_id`/`user_id` are plain ints referencing MySQL from SQLite. Orphans possible. | Architectural trade-off (by design), mitigated by _enrich fallback |
| A-M6 | **Mixed sync/async patterns** — notes.py sync, others async. Some async handlers call blocking I/O. | Event loop blocking, inconsistency |

### Positive Patterns Noted

1. **Clean dual-database separation** — `PlatformBase`/`DeviceBase` with distinct session factories
2. **Consistent router structure** — APIRouter + Depends pattern used throughout
3. **Well-designed SDK** — `ModevI.js` with clean namespace separation and placeholder ID strategy
4. **Good frontend API layer** — `client.js` with auto token refresh and split-base routing
5. **Graceful hardware degradation** — `hw.py` returns mock data when libraries unavailable
6. **Per-user data isolation** — `user_id` filtering on InstalledApp and Note queries

## Critical Issues for Phase 2 Context

1. **SQL injection via raw SQL in SDK DB endpoints** — Security team should assess full attack surface
2. **Unauthenticated hardware + SDK endpoints exposed via Cloudflare Tunnel** — All hardware remotely accessible
3. **ZIP Slip path traversal in app installation** — File system access beyond install directory
4. **CORS wildcard + no auth = any website can control Pi hardware**
5. **Admin role self-assignment when registration is enabled**
6. **`cpu_percent()` blocking event loop** — Performance impact on all concurrent requests
7. **JWT tokens in URL query parameters** — Token leakage in logs/history
