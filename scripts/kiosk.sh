#!/bin/bash
# ModevI - Kiosk Mode
# Opens the active app in fullscreen on the Pi's display

APP_URL="${1:-http://localhost:8000}"

echo "[ModevI] Opening kiosk mode at $APP_URL"

# Wait for server to be ready
for i in $(seq 1 30); do
    if curl -s "$APP_URL/api/apps/" > /dev/null 2>&1; then
        break
    fi
    echo "[ModevI] Waiting for server... ($i/30)"
    sleep 1
done

# Launch Chromium in kiosk mode
chromium --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --start-fullscreen \
    "$APP_URL" 2>/dev/null &

echo "[ModevI] Kiosk mode started (PID: $!)"
