# Database Implementation: ModevI

## Files Modified

- `backend/models.py` — reescrito completo con SQLAlchemy 2.0 (Mapped/mapped_column)
- `backend/seed.py` — reescrito con datos semilla completos
- `backend/requirements.txt` — añadido bcrypt==4.2.0
- `backend/database.py` — sin cambios (ya compatible)

## Tables Implemented (12)

**Platform domain**: users, categories, hardware_tags, store_apps, store_app_hardware (M2M), app_ratings

**Device domain**: installed_apps, app_data, activity_log, notes, device_settings, registered_sensors

## Seed Data

- 2 usuarios: admin (admin123), devuser (dev123) — passwords bcrypt
- 8 categorías: Utilidades, Multimedia, Productividad, Sistema, Educación, Juegos, IoT, Social
- 9 hardware tags: GPIO, I2C, SPI, DHT22, BMP280, HC-SR04, Camera, OLED, NeoPixel
- 4 store apps publicadas (clock, photoframe, sysmonitor, notes) → vinculadas a devuser
- 4 installed_apps correspondientes + activity_log entries
- 3 device_settings: display_brightness=80, timezone=Europe/Madrid, kiosk_url=http://localhost:8000

## Breaking Change

Los routers existentes (`routers/apps.py`, `routers/system.py`) importan los modelos viejos (`App`, `AppSetting`) que ya no existen. Deben reescribirse en el paso de implementación del backend.
