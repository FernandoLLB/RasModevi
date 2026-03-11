"""
Test suite for new features:
  - JS library mirror
  - Hardware SDK (PWM, I2C, camera)
  - Per-app SQL database
  - Uninstall cleanup

Run from backend/ dir:
  python3 ../scripts/test_new_features.py
"""
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = "http://localhost:8000"
PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
SKIP = "\033[93m~\033[0m"

results = {"pass": 0, "fail": 0, "skip": 0}


def req(method, path, body=None, expect_status=200):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            raw = resp.read()
            status = resp.status
            try:
                payload = json.loads(raw)
            except Exception:
                payload = raw
            return status, payload
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            payload = json.loads(raw)
        except Exception:
            payload = raw
        return e.code, payload


def check(name, condition, detail=""):
    if condition:
        print(f"  {PASS} {name}")
        results["pass"] += 1
    else:
        print(f"  {FAIL} {name}" + (f" — {detail}" if detail else ""))
        results["fail"] += 1


def skip(name, reason):
    print(f"  {SKIP} {name} (skipped: {reason})")
    results["skip"] += 1


def section(title):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


# ─────────────────────────────────────────────────────────
# 1. JS LIBRARY MIRROR
# ─────────────────────────────────────────────────────────
section("1. JS Library Mirror")

status, body = req("GET", "/api/sdk/libs")
check("GET /api/sdk/libs → 200", status == 200, f"got {status}")
check("Returns 7 libraries", isinstance(body, list) and len(body) == 7, f"got {len(body) if isinstance(body, list) else body}")

expected_libs = {"chart.js", "three.js", "alpine.js", "anime.js", "matter.js", "tone.js", "marked.js"}
if isinstance(body, list):
    got_names = {item["name"] for item in body}
    check("All 7 library names correct", got_names == expected_libs, f"got {got_names}")
    for item in body:
        check(f"  {item['name']} has url+description", "url" in item and "description" in item)

# Serve an actual JS file
status, body = req("GET", "/api/sdk/libs/chart.js")
check("GET /api/sdk/libs/chart.js → 200", status == 200, f"got {status}")

# 404 for unknown lib
status, body = req("GET", "/api/sdk/libs/nonexistent.js", expect_status=404)
check("GET /api/sdk/libs/nonexistent.js → 404", status == 404, f"got {status}")

# ─────────────────────────────────────────────────────────
# 2. PWM ENDPOINTS
# ─────────────────────────────────────────────────────────
section("2. PWM Endpoints")

status, body = req("GET", "/api/hardware/gpio/18/pwm")
check("GET /api/hardware/gpio/18/pwm → 200", status == 200, f"got {status}")
check("Response has pin + duty_cycle", isinstance(body, dict) and "pin" in body and "duty_cycle" in body, str(body))
check("Initial duty_cycle is 0.0", isinstance(body, dict) and body.get("duty_cycle") == 0.0, str(body))

status, body = req("POST", "/api/hardware/gpio/18/pwm", {"duty_cycle": 0.75})
check("POST /api/hardware/gpio/18/pwm → 200", status == 200, f"got {status}")
check("duty_cycle echoed back as 0.75", isinstance(body, dict) and body.get("duty_cycle") == 0.75, str(body))

# Validation: duty_cycle > 1.0 should fail
status, body = req("POST", "/api/hardware/gpio/18/pwm", {"duty_cycle": 1.5})
check("duty_cycle=1.5 → 422 validation error", status == 422, f"got {status}")

# Validation: duty_cycle < 0.0 should fail
status, body = req("POST", "/api/hardware/gpio/18/pwm", {"duty_cycle": -0.1})
check("duty_cycle=-0.1 → 422 validation error", status == 422, f"got {status}")

# SDK bridge same endpoints
status, body = req("GET", "/api/sdk/hardware/gpio/18/pwm")
check("GET /api/sdk/hardware/gpio/18/pwm → 200 (SDK bridge)", status == 200, f"got {status}")

status, body = req("POST", "/api/sdk/hardware/gpio/18/pwm", {"duty_cycle": 0.5})
check("POST /api/sdk/hardware/gpio/18/pwm → 200 (SDK bridge)", status == 200, f"got {status}")

# ─────────────────────────────────────────────────────────
# 3. I2C ENDPOINTS
# ─────────────────────────────────────────────────────────
section("3. I2C Endpoints")

status, body = req("GET", "/api/hardware/i2c/1/118/208")
if status == 200:
    check("GET /api/hardware/i2c/1/118/208 → 200", True)
    check("Response has bus, address, register, data", all(k in body for k in ["bus","address","register","data"]), str(body))
    check("data is a list", isinstance(body.get("data"), list), str(body))
elif status == 500:
    # Expected on Pi without I2C enabled or no device connected
    skip("I2C read", "I2C bus not available or no device — expected on dev machine")
    check("GET /api/hardware/i2c/1/118/208 responds (500 acceptable without hardware)", status in (200, 500), f"got {status}")
else:
    check("GET /api/hardware/i2c/1/118/208 → 200 or 500", False, f"got {status}: {body}")

# length param
status, body = req("GET", "/api/hardware/i2c/1/118/247?length=8")
check("I2C read with length=8 responds", status in (200, 500), f"got {status}")
if status == 200:
    check("data has 8 bytes", isinstance(body.get("data"), list) and len(body["data"]) == 8, str(body))

# SDK bridge
status, body = req("GET", "/api/sdk/hardware/i2c/1/118/208")
check("GET /api/sdk/hardware/i2c/1/118/208 responds (SDK bridge)", status in (200, 500), f"got {status}")

# ─────────────────────────────────────────────────────────
# 4. CAMERA ENDPOINTS
# ─────────────────────────────────────────────────────────
section("4. Camera Endpoints")

status, body = req("GET", "/api/hardware/camera/snapshot")
if status == 503:
    check("Camera snapshot → 503 when no camera (correct)", True)
    check("503 body has NO_CAMERA code", isinstance(body, dict) and body.get("detail", {}).get("code") == "NO_CAMERA", str(body))
elif status == 200:
    check("Camera snapshot → 200 (camera available!)", True)
    check("Response has 'image' key", isinstance(body, dict) and "image" in body, str(body))
    check("Image is data URL", isinstance(body.get("image"), str) and body["image"].startswith("data:image/jpeg"), str(body)[:80])
else:
    check("Camera snapshot → 200 or 503", False, f"got {status}: {body}")

# Camera stream: just check response headers (don't read body — it's an infinite MJPEG stream)
try:
    _r = urllib.request.Request(BASE + "/api/hardware/camera/stream")
    _conn = urllib.request.urlopen(_r, timeout=5)
    _stream_status = _conn.status
    _conn.close()
except urllib.error.HTTPError as _e:
    _stream_status = _e.code
except Exception:
    _stream_status = -1
check("Camera stream → 200 or 503 (header check only)", _stream_status in (200, 503), f"got {_stream_status}")

status, body = req("GET", "/api/sdk/hardware/camera/snapshot")
check("SDK camera snapshot responds (200 or 503)", status in (200, 503), f"got {status}")

# ─────────────────────────────────────────────────────────
# 5. PER-APP SQL DATABASE
# ─────────────────────────────────────────────────────────
section("5. Per-app SQL Database")

# Need an installed app. Check if any exist.
status, installed = req("GET", "/api/device/apps")
if status != 200 or not isinstance(installed, list) or len(installed) == 0:
    skip("SQL database tests", "no installed apps — install one from the store first")
else:
    app_id = installed[0]["id"]
    print(f"  Using installed app id={app_id}")

    # CREATE TABLE
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/exec", {
        "sql": "CREATE TABLE IF NOT EXISTS test_modevi (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, value REAL, ts INTEGER)",
        "params": []
    })
    check("CREATE TABLE IF NOT EXISTS → 200", status == 200, f"{status}: {body}")

    # INSERT
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/exec", {
        "sql": "INSERT INTO test_modevi (name, value, ts) VALUES (?, ?, ?)",
        "params": ["sensor_a", 23.4, int(time.time() * 1000)]
    })
    check("INSERT → 200", status == 200, f"{status}: {body}")
    check("INSERT returns last_insert_id", isinstance(body, dict) and body.get("last_insert_id", 0) >= 1, str(body))
    insert_id = body.get("last_insert_id") if isinstance(body, dict) else None

    # INSERT second row
    req("POST", f"/api/sdk/app/{app_id}/db/exec", {
        "sql": "INSERT INTO test_modevi (name, value, ts) VALUES (?, ?, ?)",
        "params": ["sensor_b", 30.1, int(time.time() * 1000)]
    })

    # SELECT all
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/query", {
        "sql": "SELECT * FROM test_modevi ORDER BY id",
        "params": []
    })
    check("SELECT * → 200", status == 200, f"{status}: {body}")
    check("SELECT returns 'rows' key", isinstance(body, dict) and "rows" in body, str(body))
    rows = body.get("rows", []) if isinstance(body, dict) else []
    check("SELECT returns 2 rows", len(rows) == 2, f"got {len(rows)} rows: {rows}")

    # SELECT with WHERE param
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/query", {
        "sql": "SELECT * FROM test_modevi WHERE name = ?",
        "params": ["sensor_a"]
    })
    check("SELECT with WHERE param → 200", status == 200, f"{status}: {body}")
    rows = body.get("rows", []) if isinstance(body, dict) else []
    check("WHERE filter returns 1 row", len(rows) == 1, f"got {len(rows)}: {rows}")
    check("Row has correct columns", len(rows) == 1 and rows[0].get("name") == "sensor_a", str(rows))

    # SELECT aggregation
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/query", {
        "sql": "SELECT AVG(value) as media, COUNT(*) as total FROM test_modevi",
        "params": []
    })
    check("SELECT AVG aggregation → 200", status == 200, f"{status}: {body}")
    rows = body.get("rows", []) if isinstance(body, dict) else []
    check("Aggregation returns 1 row with 'media'", len(rows) == 1 and "media" in rows[0], str(rows))

    # UPDATE
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/exec", {
        "sql": "UPDATE test_modevi SET value = ? WHERE name = ?",
        "params": [99.9, "sensor_a"]
    })
    check("UPDATE → 200", status == 200, f"{status}: {body}")
    check("UPDATE reports changes=1", isinstance(body, dict) and body.get("changes") == 1, str(body))

    # exec() with SELECT should still work (backend doesn't restrict it) but returns no rows
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/exec", {
        "sql": "SELECT * FROM test_modevi",
        "params": []
    })
    check("exec() with SELECT → 200 (allowed, returns changes/last_insert_id)", status == 200, f"{status}: {body}")

    # Invalid SQL → 400
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/query", {
        "sql": "SELECT * FROM tabla_que_no_existe_xyz",
        "params": []
    })
    check("SELECT from nonexistent table → 400", status == 400, f"got {status}: {body}")
    check("Error has DB_ERROR code", isinstance(body, dict) and body.get("detail", {}).get("code") == "DB_ERROR", str(body))

    # Syntax error
    status, body = req("POST", f"/api/sdk/app/{app_id}/db/exec", {
        "sql": "THIS IS NOT SQL AT ALL @@@@",
        "params": []
    })
    check("Invalid SQL syntax → 400", status == 400, f"got {status}: {body}")

    # Cleanup test table
    req("POST", f"/api/sdk/app/{app_id}/db/exec", {"sql": "DROP TABLE IF EXISTS test_modevi", "params": []})
    print(f"  (test_modevi table dropped)")

    # Verify DB file exists on disk
    backend_dir = Path(__file__).resolve().parent.parent / "backend"
    db_path = backend_dir / "app_data" / f"app_{app_id}.db"
    check(f"app_{app_id}.db exists on disk", db_path.exists(), str(db_path))

# ─────────────────────────────────────────────────────────
# 6. UNINSTALL CLEANUP
# ─────────────────────────────────────────────────────────
section("6. Uninstall Cleanup (KV + SQL)")

status, installed = req("GET", "/api/device/apps")
if status != 200 or not isinstance(installed, list) or len(installed) == 0:
    skip("Uninstall cleanup test", "no installed apps")
else:
    app_id = installed[0]["id"]
    backend_dir = Path(__file__).resolve().parent.parent / "backend"

    # Create a DB to verify it gets deleted
    req("POST", f"/api/sdk/app/{app_id}/db/exec", {
        "sql": "CREATE TABLE IF NOT EXISTS cleanup_test (x INTEGER)",
        "params": []
    })
    db_path = backend_dir / "app_data" / f"app_{app_id}.db"
    db_existed = db_path.exists()
    print(f"  app_{app_id}.db exists before uninstall: {db_existed}")

    if len(installed) > 1:
        # Only uninstall if there are multiple apps — leave at least one installed
        app_to_remove = installed[-1]["id"]
        store_id = installed[-1].get("store_app_id")
        print(f"  Testing uninstall of app id={app_to_remove}")
        db_path_remove = backend_dir / "app_data" / f"app_{app_to_remove}.db"

        # Create something to clean up
        req("POST", f"/api/sdk/app/{app_to_remove}/db/exec", {
            "sql": "CREATE TABLE IF NOT EXISTS will_be_deleted (x TEXT)", "params": []
        })
        req("PUT", f"/api/sdk/app/{app_to_remove}/data/test_key", {"value": "test_value"})

        status, body = req("POST", f"/api/device/apps/{app_to_remove}/uninstall")
        check("Uninstall → 204", status == 204, f"got {status}: {body}")

        # Verify DB deleted
        check(f"app_{app_to_remove}.db deleted after uninstall", not db_path_remove.exists(), str(db_path_remove))

        # Verify KV entries gone
        status2, kv = req("GET", f"/api/sdk/app/{app_to_remove}/data")
        check("KV store returns 404 for uninstalled app", status2 == 404, f"got {status2}: {kv}")
    else:
        skip("Uninstall + cleanup", "only 1 app installed — skipping to avoid removing it")

# ─────────────────────────────────────────────────────────
# 7. EXISTING FEATURES STILL WORK
# ─────────────────────────────────────────────────────────
section("7. Existing Features (regression)")

status, body = req("GET", "/api/store/apps")
check("GET /api/store/apps → 200", status == 200, f"{status}")

status, body = req("GET", "/api/store/categories")
check("GET /api/store/categories → 200", status == 200, f"{status}")

status, body = req("GET", "/api/sdk/system/info")
check("GET /api/sdk/system/info → 200", status == 200, f"{status}")
if status == 200:
    for field in ["hostname", "platform", "cpu_percent", "ram_percent", "uptime_seconds"]:
        check(f"  system.info has '{field}'", field in body, str(list(body.keys()) if isinstance(body, dict) else body))

status, body = req("GET", "/api/hardware/gpio/17")
check("GET /api/hardware/gpio/17 → 200 (mock)", status == 200, f"{status}")

status, body = req("GET", "/api/hardware/sensors")
check("GET /api/hardware/sensors → 200", status == 200, f"{status}")

# ─────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────
print(f"\n{'═'*55}")
total = results["pass"] + results["fail"] + results["skip"]
print(f"  RESULTADO: {results['pass']} pasados  {results['fail']} fallidos  {results['skip']} omitidos  ({total} total)")
print(f"{'═'*55}\n")

sys.exit(0 if results["fail"] == 0 else 1)
