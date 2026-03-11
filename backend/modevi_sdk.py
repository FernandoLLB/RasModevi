"""ModevI.js SDK — served dynamically to apps running in iframes."""

MODEVI_SDK_JS = r"""
/**
 * ModevI.js SDK v1.0.0
 * Injected into every app iframe by the ModevI platform.
 *
 * The SDK reads its own installed_app_id from:
 *   <meta name="modevi-app-id" content="<installed_app_id>">
 * or falls back to the placeholder replaced server-side: {{INSTALLED_APP_ID}}
 */
(function (global) {
  'use strict';

  // -------------------------------------------------------------------------
  // Determine app ID
  // -------------------------------------------------------------------------
  var metaTag = document.querySelector('meta[name="modevi-app-id"]');
  var installedAppId = metaTag
    ? metaTag.getAttribute('content')
    : '{{INSTALLED_APP_ID}}';

  // Base URL of the host (parent origin or same-origin fallback)
  var BASE_URL = '';

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------
  function apiUrl(path) {
    return BASE_URL + path;
  }

  async function apiFetch(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(apiUrl(path), opts);
    if (res.status === 204) return null;
    var json = await res.json();
    if (!res.ok) {
      var msg =
        (json && (json.detail || (json.detail && json.detail.detail))) ||
        'Unknown error';
      throw new Error(msg);
    }
    return json;
  }

  // -------------------------------------------------------------------------
  // System
  // -------------------------------------------------------------------------
  var system = {
    /**
     * Get device system information.
     * @returns {Promise<SystemInfo>}
     */
    info: function () {
      return apiFetch('GET', '/api/sdk/system/info');
    },
  };

  // -------------------------------------------------------------------------
  // Data store (key-value persistence per app)
  // -------------------------------------------------------------------------
  var data = {
    /**
     * Get all stored key-value pairs for this app.
     * @returns {Promise<Array<{key, value, updated_at}>>}
     */
    getAll: function () {
      return apiFetch('GET', '/api/sdk/app/' + installedAppId + '/data');
    },

    /**
     * Get a single value by key.
     * @param {string} key
     * @returns {Promise<{key, value, updated_at}>}
     */
    get: function (key) {
      return apiFetch('GET', '/api/sdk/app/' + installedAppId + '/data/' + encodeURIComponent(key));
    },

    /**
     * Set a value for a key (creates or updates).
     * @param {string} key
     * @param {string} value
     * @returns {Promise<{key, value, updated_at}>}
     */
    set: function (key, value) {
      return apiFetch('PUT', '/api/sdk/app/' + installedAppId + '/data/' + encodeURIComponent(key), {
        value: String(value),
      });
    },

    /**
     * Delete a key.
     * @param {string} key
     * @returns {Promise<null>}
     */
    delete: function (key) {
      return apiFetch('DELETE', '/api/sdk/app/' + installedAppId + '/data/' + encodeURIComponent(key));
    },
  };

  // -------------------------------------------------------------------------
  // Hardware
  // -------------------------------------------------------------------------
  var hardware = {
    /**
     * List all registered sensors.
     * @returns {Promise<Array<SensorOut>>}
     */
    sensors: function () {
      return apiFetch('GET', '/api/sdk/hardware/sensors');
    },

    /**
     * Read a GPIO pin value (0 or 1).
     * @param {number} pin  BCM pin number
     * @returns {Promise<{pin, value}>}
     */
    gpioRead: function (pin) {
      return apiFetch('GET', '/api/sdk/hardware/gpio/' + pin);
    },

    /**
     * Write a digital value to a GPIO pin.
     * @param {number} pin   BCM pin number
     * @param {0|1}    value 0 = LOW, 1 = HIGH
     * @returns {Promise<{success}>}
     */
    gpioWrite: function (pin, value) {
      return apiFetch('POST', '/api/sdk/hardware/gpio/' + pin, { value: value });
    },

    /**
     * Set PWM duty cycle on a pin (for LEDs dimmer, servos, fans...).
     * @param {number} pin        BCM pin number
     * @param {number} dutyCycle  0.0 (off) → 1.0 (full on)
     * @returns {Promise<{pin, duty_cycle}>}
     */
    pwmSet: function (pin, dutyCycle) {
      return apiFetch('POST', '/api/sdk/hardware/gpio/' + pin + '/pwm', { duty_cycle: dutyCycle });
    },

    /**
     * Read current PWM duty cycle for a pin.
     * @param {number} pin  BCM pin number
     * @returns {Promise<{pin, duty_cycle}>}
     */
    pwmGet: function (pin) {
      return apiFetch('GET', '/api/sdk/hardware/gpio/' + pin + '/pwm');
    },

    /**
     * Read bytes from an I2C device.
     * @param {number} address   Device address (e.g. 0x76 for BME280)
     * @param {number} register  Register to read from
     * @param {number} [length]  Number of bytes to read (default 1)
     * @param {number} [bus]     I2C bus number (default 1)
     * @returns {Promise<{bus, address, register, data: number[]}>}
     */
    i2cRead: function (address, register, length, bus) {
      var b = bus !== undefined ? bus : 1;
      var l = length !== undefined ? length : 1;
      return apiFetch('GET', '/api/sdk/hardware/i2c/' + b + '/' + address + '/' + register + '?length=' + l);
    },

    /**
     * Camera utilities.
     */
    camera: {
      /**
       * Capture a single frame as a base64 JPEG data URL.
       * Usage: document.getElementById('img').src = await ModevI.hardware.camera.snapshot();
       * @returns {Promise<string>}  data:image/jpeg;base64,... URL
       */
      snapshot: async function () {
        var result = await apiFetch('GET', '/api/sdk/hardware/camera/snapshot');
        return result.image;
      },

      /**
       * Get the MJPEG stream URL for use in an <img> tag.
       * Usage: document.getElementById('img').src = ModevI.hardware.camera.streamUrl();
       * @returns {string}
       */
      streamUrl: function () {
        return BASE_URL + '/api/sdk/hardware/camera/stream';
      },
    },
  };

  // -------------------------------------------------------------------------
  // SQL database (per-app isolated SQLite)
  // -------------------------------------------------------------------------
  var db = {
    /**
     * Execute a SELECT query and return rows as an array of objects.
     *
     * @param {string}   sql     SQL query with ? placeholders
     * @param {Array}    [params] Values for placeholders
     * @returns {Promise<Array<Object>>}
     *
     * @example
     * const rows = await ModevI.db.query(
     *   "SELECT * FROM lecturas WHERE sensor = ? ORDER BY ts DESC LIMIT 50",
     *   ["temperatura"]
     * );
     */
    query: async function (sql, params) {
      var result = await apiFetch('POST', '/api/sdk/app/' + installedAppId + '/db/query', {
        sql: sql,
        params: params || [],
      });
      return result.rows;
    },

    /**
     * Execute an INSERT / UPDATE / DELETE / CREATE TABLE statement.
     *
     * @param {string}   sql     SQL statement with ? placeholders
     * @param {Array}    [params] Values for placeholders
     * @returns {Promise<{changes: number, last_insert_id: number}>}
     *
     * @example
     * await ModevI.db.exec(
     *   "CREATE TABLE IF NOT EXISTS lecturas (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, valor REAL)"
     * );
     * const { last_insert_id } = await ModevI.db.exec(
     *   "INSERT INTO lecturas (ts, valor) VALUES (?, ?)",
     *   [Date.now(), 23.4]
     * );
     */
    exec: function (sql, params) {
      return apiFetch('POST', '/api/sdk/app/' + installedAppId + '/db/exec', {
        sql: sql,
        params: params || [],
      });
    },
  };

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  var notify = {
    /**
     * Show a toast notification in the ModevI shell.
     * Dispatches a `modevi-toast` CustomEvent to the parent window.
     *
     * @param {string} message
     * @param {'info'|'success'|'warning'|'error'} [type='info']
     * @param {number} [duration=3000]  Milliseconds to show the toast
     */
    toast: function (message, type, duration) {
      var detail = {
        message: message,
        type: type || 'info',
        duration: duration || 3000,
        appId: installedAppId,
      };
      // Dispatch to self (caught by the iframe wrapper via postMessage or listener)
      var event = new CustomEvent('modevi-toast', { detail: detail, bubbles: true });
      document.dispatchEvent(event);

      // Also post to parent so the React shell can catch it
      try {
        window.parent.postMessage({ type: 'modevi-toast', detail: detail }, '*');
      } catch (_) {
        // Cross-origin posting failed — silently ignore
      }
    },
  };

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  var ModevI = {
    version: '1.1.0',
    appId: installedAppId,
    system: system,
    data: data,
    db: db,
    hardware: hardware,
    notify: notify,
  };

  // Expose globally
  global.ModevI = ModevI;
})(window);
"""
