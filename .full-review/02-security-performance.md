# Phase 2: Security & Performance Review

## Security Findings

### Critical (6)

| ID | Issue | CVSS | CWE | File | Details |
|----|-------|------|-----|------|---------|
| S-C1 | **Arbitrary SQL execution in SDK** | 9.8 | CWE-89 | `backend/routers/sdk.py:223-258` | `db/query` and `db/exec` accept any SQL string. `ATTACH DATABASE` can read any file on the Pi filesystem including `device.db`. `load_extension()` can execute arbitrary code. |
| S-C2 | **Unauthenticated internet-exposed endpoints** | 9.8 | CWE-306 | `backend/routers/sdk.py`, `hardware.py`, `system.py` | All SDK, hardware, and system endpoints have no auth. Exposed via Cloudflare Tunnel at `pi.modevi.es`. Anyone can control GPIO, access camera, exec SQL. |
| S-C3 | **ZIP Slip path traversal** | 8.6 | CWE-22 | `backend/routers/device.py:241`, `ai.py:1320` | `zf.extractall()` without validating archive member paths. Malicious ZIP with `../../.ssh/authorized_keys` writes files outside install directory. |
| S-C4 | **Admin role self-assignment** | 9.1 | CWE-269 | `backend/schemas.py:15-26`, `routers/auth.py:46` | `UserCreate` accepts `role: "admin"`. When registration is re-enabled, any user can create admin account with full privileges. |
| S-C5 | **Wildcard CORS on both backends** | 8.1 | CWE-942 | `backend/main.py:139`, `main_store.py:82` | `allow_origins=["*"]` on both entry points. Any website can make cross-origin API calls to store and Pi backends. |
| S-C6 | **`require_developer` is a no-op** | 8.1 | CWE-862 | `backend/auth.py:113-115` | Function returns any authenticated user without role check. All developer endpoints (create apps, upload, AI generation) accessible to any user. |

### High (8)

| ID | Issue | File | Details |
|----|-------|------|---------|
| S-H1 | **JWT in URL query params** | `backend/routers/ai.py:1368,1741` | SSE endpoints accept JWT via `?token=`. Tokens leak in server logs, browser history, Cloudflare edge logs. Frontend already uses `fetch` (not EventSource). |
| S-H2 | **Hardcoded seed credentials** | `backend/seed.py` | `admin/admin123`, `devuser/dev123` created on every startup. If not changed, easily guessable admin access. |
| S-H3 | **No rate limiting on login** | `backend/routers/auth.py` | No brute-force protection. Attacker can attempt unlimited passwords against known usernames (admin, devuser). |
| S-H4 | **Missing security headers** | `backend/main.py`, `main_store.py` | No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy` headers. |
| S-H5 | **Iframe apps have unrestricted parent access** | `frontend/src/pages/AppRunnerPage.jsx` | Apps run in iframes without `sandbox` attribute. A malicious app can access `window.parent`, read JWT from localStorage, and exfiltrate tokens. |
| S-H6 | **No GPIO pin number validation** | `backend/hw.py`, `routers/hardware.py` | Any pin number accepted. Writing to reserved pins (UART, SPI, I2C) could brick the Pi or damage connected hardware. |
| S-H7 | **Frontend catch-all may serve unintended files** | `backend/main.py:175-180` | `StaticFiles(html=True)` on `installed/` serves all extracted ZIP contents. No file type restriction. |
| S-H8 | **JWT stored in localStorage** | `frontend/src/context/AuthContext.jsx` | XSS vulnerability would expose JWT. HttpOnly cookies would be safer but require CORS changes. |

### Medium (7)

| ID | Issue | File | Details |
|----|-------|------|---------|
| S-M1 | **No token revocation mechanism** | `backend/auth.py` | No blacklist for compromised tokens. Tokens remain valid until expiry. |
| S-M2 | **Unauthenticated WebSocket** | `backend/routers/hardware.py` | Sensor WebSocket streams have no auth. |
| S-M3 | **System info disclosure** | `backend/routers/system.py` | Exposes Python version, OS details, CPU model, memory — useful for targeted attacks. |
| S-M4 | **Verbose error messages** | Multiple routers | SQLite errors, tracebacks, and internal paths exposed in 400/500 responses. |
| S-M5 | **Unbounded AI prompt length** | `backend/routers/ai.py` | No max length on `description` query param. Could send massive prompts consuming API tokens. |
| S-M6 | **Mass-assignment pattern** | `backend/routers/auth.py:42-47` | User input directly mapped to model fields including `role`. |
| S-M7 | **No CSRF protection** | Both backends | JWT-in-header mitigates this for API calls, but cookie-based auth (if added later) would be vulnerable. |

### Low (5)

| ID | Issue |
|----|-------|
| S-L1 | **Unmaintained dependencies** — `python-jose` and `passlib` have low maintenance activity |
| S-L2 | **Debug output in production** — Some `print()` statements remain |
| S-L3 | **Weak password requirements** — No minimum length/complexity enforcement |
| S-L4 | **Missing email validation** — Email format validated by Pydantic but no verification flow |
| S-L5 | **Uvicorn production hardening** — Running with default settings, no `--proxy-headers` for Cloudflare |

---

## Performance Findings

### Critical (1)

| ID | Issue | Impact | File |
|----|-------|--------|------|
| P-C1 | **`cpu_percent(interval=0.5)` blocks event loop** | Freezes ALL requests for 500ms per call. With 5s polling, causes periodic server stalls. | `backend/routers/system.py:36`, `sdk.py:118` |

### High (5)

| ID | Issue | Impact | File |
|----|-------|--------|------|
| P-H1 | **GPIO Button() leaked per read** | File descriptor exhaustion after ~1024 reads of same pin. | `backend/hw.py:28-32` |
| P-H2 | **R2 boto3 client created per operation** | 100-300ms overhead per upload (TCP+TLS). Adds latency during AI app creation. | `backend/r2.py:13-33` |
| P-H3 | **`_enrich()` writes on every GET + cross-DB join** | Every 5s poll: MySQL round-trip (50-200ms) + potential SQLite write lock. | `backend/routers/device.py:51-139` |
| P-H4 | **DeviceContext polls every 5s unconditionally** | 12 req/min/user sustained load on ALL pages. Largest sustained load on Pi. | `frontend/src/context/DeviceContext.jsx:30-40` |
| P-H5 | **SQLite concurrent write contention** | `database is locked` errors possible under concurrent SDK writes + polling cache writes. No WAL mode configured. | `backend/database.py:33` |

### Medium (8)

| ID | Issue | Impact | File |
|----|-------|--------|------|
| P-M1 | **Anthropic client created per stream** | Unnecessary connection pool allocation per generation. | `backend/routers/ai.py:1115,1521,1428` |
| P-M2 | **No MySQL connection pool tuning** | Default pool_size=5. Pre-ping adds 50-200ms RTT on idle connections. | `backend/database.py:32` |
| P-M3 | **Slug uniqueness check via loop query** | O(n) MySQL queries for n existing slugs with same base. | `backend/routers/ai.py:1239-1243`, `developer.py:56-60` |
| P-M4 | **Per-request SQLite connections for app DBs** | 1-5ms overhead per SDK call. | `backend/routers/sdk.py:41-44` |
| P-M5 | **No caching on store listings** | MySQL query on every page view. Store is the landing page. | `backend/routers/store.py:50-92` |
| P-M6 | **No route-based code splitting** | 356KB monolith JS bundle. AICreatePage (800+ lines) loaded for every user. | `frontend/src/App.jsx` |
| P-M7 | **27 useState hooks cause re-renders on SSE chunks** | Full component tree re-renders on every token during streaming. Visible jank on Pi. | `frontend/src/pages/AICreatePage.jsx:87-131` |
| P-M8 | **O(n^2) string concatenation in AI stream** | ~25MB transient memory per 50KB generation due to immutable string copies. | `backend/routers/ai.py:1116,1522` |

### Low (6)

| ID | Issue |
|----|-------|
| P-L1 | **Sync notes router** — Uses `def` instead of `async def`, consumes thread pool |
| P-L2 | **Categories/tags uncached** — MySQL query on every fetch, essentially static data |
| P-L3 | **SDK JS uncached in browser** — No Cache-Control header, re-fetched on every app launch |
| P-L4 | **No AI generation rate limiting** — No per-user throttle, risks API budget exhaustion |
| P-L5 | **Unbounded activity log** — No TTL or row limit, slow growth on SD card |
| P-L6 | **no-cache middleware on all installed files** — Disables caching for all app assets |

---

## Critical Issues for Phase 3 Context

### Testing Requirements from Security Findings
1. **SQL injection tests** — Must test that `ATTACH DATABASE`, `PRAGMA`, `load_extension()` are blocked
2. **Auth bypass tests** — Verify unauthenticated requests to SDK/hardware return 401/403
3. **ZIP Slip tests** — Test with malicious archive containing `../../` entries
4. **Role escalation tests** — Verify `role: "admin"` rejected during registration
5. **CORS tests** — Verify cross-origin requests from unauthorized domains are blocked
6. **Iframe sandbox tests** — Verify apps cannot access parent window or localStorage
7. **Brute-force tests** — Verify rate limiting on login endpoint

### Testing Requirements from Performance Findings
1. **Event loop blocking tests** — Verify `cpu_percent` is non-blocking
2. **Concurrent write tests** — Test SQLite under concurrent polling + SDK writes
3. **Load tests** — Verify Pi handles multiple concurrent clients with 5s polling
4. **Memory leak tests** — Verify GPIO Button objects are properly cached
5. **SSE streaming tests** — Verify no jank/dropped frames during AI generation

### Documentation Requirements
1. **Security hardening guide** — Document required .env variables, CORS configuration, auth requirements
2. **Performance tuning guide** — Document SQLite WAL mode, connection pool settings
3. **Deployment checklist** — Ensure seed credentials are changed, security headers added
